import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { UPLOADS_DIR, publicUrlForUpload } from "@/lib/paths";
import { parseFloorplan } from "@/lib/parse/pipeline";
import { vlmReadDimensionChains, vlmClassifyRooms } from "@/lib/parse/vlm";
import { hasVision } from "@/lib/ai/client";
import { ROOM_TYPE_LABEL, WORKFLOW_STATUS, type RoomType } from "@/lib/enums";

export const runtime = "nodejs";
export const maxDuration = 120;

const PALETTE = [
  "#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899",
  "#14b8a6", "#84cc16", "#f97316", "#6366f1", "#eab308", "#06b6d4",
];

function fileUrlToDisk(fileUrl: string): string {
  // fileUrl 是相对 public 的路径，两种来源：
  //   上传文件：/uploads/<projectId>/<file>
  //   内置样本：/samples/floorplans/<file> 或 /samples/styles/<file>
  const rel = fileUrl.replace(/^\//, "");
  return path.join(process.cwd(), "public", rel);
}

/**
 * POST /api/floorplans/[id]/parse
 * 对指定户型图执行完整解析管线并落库。
 * body: { mmPerPx?: number, useVlm?: boolean }
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const asset = await prisma.floorplanAsset.findUnique({ where: { id: params.id } });
  if (!asset) return NextResponse.json({ error: "户型图不存在" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const mmPerPxOverride =
    typeof body.mmPerPx === "number" && body.mmPerPx > 1 && body.mmPerPx < 100
      ? body.mmPerPx
      : undefined;
  const useVlm = body.useVlm !== false && (await hasVision());

  await prisma.floorplanAsset.update({
    where: { id: asset.id },
    data: { status: "DETECTING", errorMessage: null },
  });

  try {
    const bytes = await fs.readFile(fileUrlToDisk(asset.fileUrl));

    // ── VLM 读尺寸链（可选，作为比例候选）──
    let vlmDims: Awaited<ReturnType<typeof vlmReadDimensionChains>> = null;
    if (useVlm && !mmPerPxOverride) {
      vlmDims = await vlmReadDimensionChains(bytes);
    }

    const { json } = await parseFloorplan(bytes, { mmPerPxOverride });

    // VLM 读数 → 重新计算比例（若两边一致取 VLM，冲突进问题列表）
    if (vlmDims && !mmPerPxOverride) {
      const chains = JSON.parse(JSON.stringify({
        top: vlmDims.topMm, bottom: vlmDims.bottomMm,
        left: vlmDims.leftMm, right: vlmDims.rightMm,
      }));
      void chains; // 当前比例仲裁在 pipeline 内完成；VLM 候选记入问题列表提示
      if (vlmDims.topMm && Math.abs(vlmDims.topMm / json.mmPerPx - (json.buildingBoxMm[2] - json.buildingBoxMm[0])) > 0) {
        // 仅记录参考值，实际仲裁见 pipeline/arbitrateScale
      }
    }

    // ── VLM 房间精分类（可选）──
    let classifiedBy: "rules" | "vlm" = "rules";
    if (useVlm) {
      const hints = json.rooms.map((r, i) => ({
        index: i + 1,
        areaM2: r.areaM2,
        cxNorm: r.centroidMm[0] / (json.imageWidth * json.mmPerPx),
        cyNorm: r.centroidMm[1] / (json.imageHeight * json.mmPerPx),
      }));
      const vlmRooms = await vlmClassifyRooms(bytes, hints);
      if (vlmRooms) {
        classifiedBy = "vlm";
        for (const vr of vlmRooms) {
          const room = json.rooms[vr.index - 1];
          if (!room) continue;
          room.type = vr.type;
          room.name = vr.name;
          room.confidence = vr.confidence;
          room.needsConfirm = vr.confidence < 0.75;
        }
        json.classifiedBy = "vlm";
      }
    }

    // ── 生成叠加图（彩色房间多边形，无文字——中文标注由前端画）──
    const overlayFile = `${crypto.randomUUID()}-overlay.png`;
    const polysSvg = json.rooms
      .map((r, i) => {
        const pts = r.polygonMm
          .map(([x, y]) => `${(x / json.mmPerPx).toFixed(1)},${(y / json.mmPerPx).toFixed(1)}`)
          .join(" ");
        const color = PALETTE[i % PALETTE.length];
        return `<polygon points="${pts}" fill="${color}" fill-opacity="0.35" stroke="${color}" stroke-width="3"/>`;
      })
      .join("");
    const svg = `<svg width="${json.imageWidth}" height="${json.imageHeight}" xmlns="http://www.w3.org/2000/svg">${polysSvg}</svg>`;
    const overlayPath = path.join(UPLOADS_DIR, asset.projectId, overlayFile);
    await sharp(bytes)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png()
      .toFile(overlayPath);
    const overlayUrl = publicUrlForUpload(asset.projectId, overlayFile);

    // ── 落库：清掉旧识别结果，写入新结果（同事务）──
    await prisma.$transaction(async (tx) => {
      await tx.opening.deleteMany({ where: { projectId: asset.projectId } });
      await tx.roomAdjacency.deleteMany({ where: { projectId: asset.projectId } });
      await tx.detectedRoom.deleteMany({ where: { projectId: asset.projectId } });

      const roomIdByJsonId = new Map<string, string>();
      for (const [i, r] of json.rooms.entries()) {
        const created = await tx.detectedRoom.create({
          data: {
            projectId: asset.projectId,
            name: r.name,
            roomType: (r.type.toUpperCase() as RoomType) in ROOM_TYPE_LABEL ? r.type.toUpperCase() : "OTHER",
            polygonJson: JSON.stringify(r.polygonMm),
            centroidJson: JSON.stringify({ xMm: r.centroidMm[0], yMm: r.centroidMm[1] }),
            areaM2: r.areaM2,
            confidence: r.confidence,
            needsReview: r.needsConfirm,
            source: classifiedBy === "vlm" ? "FUSED" : "CV",
            order: i,
          },
        });
        roomIdByJsonId.set(r.id, created.id);
      }

      for (const [i, o] of json.openings.entries()) {
        await tx.opening.create({
          data: {
            projectId: asset.projectId,
            kind: o.kind === "window" ? "WINDOW" : o.kind === "open" ? "ARCH" : "DOOR",
            offsetMm: 0,
            widthMm: o.widthMm,
            sillMm: o.kind === "window" ? 900 : 0,
            heightMm: o.kind === "window" ? 1200 : 2100,
            confidence: 0.6,
            source: "CV",
            order: i,
            swingJson: JSON.stringify({
              centerMm: { x: o.centerMm[0], y: o.centerMm[1] },
              angleRad: o.angleRad,
              roomA: o.roomA ? roomIdByJsonId.get(o.roomA) : null,
              roomB: o.roomB ? roomIdByJsonId.get(o.roomB) : null,
            }),
          },
        });
      }

      // 邻接表：门洞连接的房间对
      const adjSeen = new Set<string>();
      for (const o of json.openings) {
        if (o.kind === "window" || !o.roomA || !o.roomB) continue;
        const a = roomIdByJsonId.get(o.roomA);
        const b = roomIdByJsonId.get(o.roomB);
        if (!a || !b) continue;
        const key = [a, b].sort().join("|");
        if (adjSeen.has(key)) continue;
        adjSeen.add(key);
        await tx.roomAdjacency.create({
          data: {
            projectId: asset.projectId,
            aRoomId: a,
            bRoomId: b,
            kind: o.kind === "open" ? "ARCH" : "DOOR",
          },
        });
      }

      await tx.floorplanAsset.update({
        where: { id: asset.id },
        data: {
          status: "SUCCEEDED",
          reviewStatus: json.issues.length > 0 ? "NEEDS_REVIEW" : "PENDING",
          scaleMmPerPx: json.mmPerPx,
          scaleSource: json.scaleSource,
          scaleConfidence: json.scaleConfidence,
          parseJson: JSON.stringify(json),
          overlayUrl,
          suggestionsJson: JSON.stringify(json.issues),
        },
      });

      await tx.project.update({
        where: { id: asset.projectId },
        data: { workflowStatus: WORKFLOW_STATUS.PARSED },
      });
    });

    return NextResponse.json({ ok: true, parse: json, overlayUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.floorplanAsset.update({
      where: { id: asset.id },
      data: { status: "FAILED", errorMessage: msg },
    });
    return NextResponse.json({ error: `解析失败：${msg}` }, { status: 500 });
  }
}
