import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  polygonAreaM2,
  polygonCentroidMm,
  polygonPerimeterMm,
  polygonLengthWidthMm,
} from "@/lib/parse/geometry";

export const runtime = "nodejs";

/** 轻量校验：只保证关键字段存在且类型正确，细节由下游容错 */
const roomSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.string(),
  roomType: z.string().optional(),
  polygonMm: z.array(z.tuple([z.number(), z.number()])).min(3),
  areaM2: z.number().optional(),
  centroidMm: z.tuple([z.number(), z.number()]).optional(),
  confidence: z.number().optional(),
  needsConfirm: z.boolean().optional(),
});

const openingSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["door", "open", "window", "entrance"]),
  centerMm: z.tuple([z.number(), z.number()]),
  widthMm: z.number(),
  angleRad: z.number(),
  roomA: z.string().nullable().optional(),
  roomB: z.string().nullable().optional(),
});

const jsonSchema = z.object({
  version: z.literal(1).optional(),
  imageWidth: z.number().optional(),
  imageHeight: z.number().optional(),
  mmPerPx: z.number(),
  scaleSource: z.string().optional(),
  scaleConfidence: z.number().optional(),
  buildingBoxMm: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  rooms: z.array(roomSchema),
  openings: z.array(openingSchema),
  wallLoops: z.array(z.any()).optional(),
  issues: z.array(z.string()).optional(),
  classifiedBy: z.string().optional(),
}).passthrough();

const bodySchema = z.object({
  json: jsonSchema,
  reviewStatus: z.enum(["NEEDS_REVIEW", "CONFIRMED"]).optional(),
});

/**
 * PATCH /api/floorplans/[id]/correct
 * 保存人工修正后的户型 JSON：以 parseJson 为权威快照（驱动三维/漫游），
 * 并事务同步 DetectedRoom 表（驱动识别页清单与确认流程）。
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const asset = await prisma.floorplanAsset.findUnique({ where: { id: params.id } });
  if (!asset) return NextResponse.json({ error: "户型图不存在" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "参数错误" },
      { status: 400 },
    );
  }

  const json = parsed.data.json;
  const reviewStatus = parsed.data.reviewStatus ?? "NEEDS_REVIEW";

  // 重新计算房间派生几何，保证 parseJson 与数据库一致
  const rooms = json.rooms.map((r, i) => {
    const areaM2 = polygonAreaM2(r.polygonMm as [number, number][]);
    const centroidMm = polygonCentroidMm(r.polygonMm as [number, number][]);
    const perimeterMm = polygonPerimeterMm(r.polygonMm as [number, number][]);
    const { lengthMm, widthMm } = polygonLengthWidthMm(r.polygonMm as [number, number][]);
    return {
      ...r,
      areaM2,
      centroidMm,
      perimeterMm,
      lengthMm,
      widthMm,
      order: i,
      source: "MANUAL",
      needsConfirm: false,
    };
  });

  const correctedJson = {
    ...json,
    rooms,
    classifiedBy: "manual",
    issues: json.issues ?? [],
  };

  const keptIds = rooms.map((r) => r.id);

  try {
    await prisma.$transaction(async (tx) => {
      // 1. 写回权威快照
      await tx.floorplanAsset.update({
        where: { id: asset.id },
        data: {
          parseJson: JSON.stringify(correctedJson),
          reviewStatus,
        },
      });

      // 2. 同步 DetectedRoom
      for (const r of rooms) {
        await tx.detectedRoom.upsert({
          where: { id: r.id },
          create: {
            id: r.id,
            projectId: asset.projectId,
            name: r.name,
            roomType: r.roomType ?? r.type,
            polygonJson: JSON.stringify(r.polygonMm),
            centroidJson: JSON.stringify(r.centroidMm),
            areaM2: r.areaM2,
            perimeterMm: r.perimeterMm,
            lengthMm: r.lengthMm,
            widthMm: r.widthMm,
            confidence: r.confidence ?? 0.9,
            source: "MANUAL",
            needsReview: false,
            isConfirmed: reviewStatus === "CONFIRMED",
            order: r.order,
          },
          update: {
            name: r.name,
            roomType: r.roomType ?? r.type,
            polygonJson: JSON.stringify(r.polygonMm),
            centroidJson: JSON.stringify(r.centroidMm),
            areaM2: r.areaM2,
            perimeterMm: r.perimeterMm,
            lengthMm: r.lengthMm,
            widthMm: r.widthMm,
            source: "MANUAL",
            needsReview: false,
            isConfirmed: reviewStatus === "CONFIRMED",
            order: r.order,
          },
        });
      }

      // 3. 删除已移除房间
      await tx.detectedRoom.deleteMany({
        where: { projectId: asset.projectId, id: { notIn: keptIds } },
      });
    });
  } catch (e) {
    return NextResponse.json(
      { error: `保存失败：${(e as Error).message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, reviewStatus, rooms: rooms.length });
}
