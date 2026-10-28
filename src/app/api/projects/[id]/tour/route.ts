import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { UPLOADS_DIR, publicUrlForUpload } from "@/lib/paths";

export const runtime = "nodejs";

type WpIn = { xMm: number; zMm: number; yaw: number; order: number; label: string; roomId?: string | null };
type SceneIn = { index: number; dataUrl: string; yaw: number };

/** 找某风格下的既有路线 */
async function findRoute(projectId: string, styleId: string) {
  const routes = await prisma.tourRoute.findMany({
    where: { projectId },
    include: { waypoints: { orderBy: { order: "asc" } }, scenes: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  for (const r of routes) {
    try {
      const params = JSON.parse(r.paramsJson || "{}");
      if (params.styleId === styleId) return r;
    } catch { /* ignore */ }
  }
  return null;
}

/** GET /api/projects/[id]/tour?styleId=xxx — 读取缓存（命中则返回场景，未命中 found=false） */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const styleId = url.searchParams.get("styleId") ?? "modern-minimal";

  const route = await findRoute(params.id, styleId);
  if (!route) return NextResponse.json({ found: false });

  const waypoints = route.waypoints.map((w) => ({
    id: w.id,
    roomId: w.roomId,
    xMm: w.xMm,
    zMm: w.zMm,
    yaw: w.yaw,
    order: w.order,
    label: w.label,
  }));
  const scenes = route.scenes.map((s) => ({
    url: s.panoramaUrl,
    name: s.name,
    initialYaw: s.initialYaw,
    order: s.order,
  }));

  return NextResponse.json({ found: true, waypoints, scenes });
}

/** POST /api/projects/[id]/tour — 保存路线与全景图（同风格覆盖旧缓存） */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const styleId = (body.styleId ?? "modern-minimal").toString();
  const waypoints: WpIn[] = body.waypoints ?? [];
  const scenes: SceneIn[] = body.scenes ?? [];
  if (waypoints.length === 0 || scenes.length === 0) {
    return NextResponse.json({ error: "缺少路径或全景数据" }, { status: 400 });
  }

  // 删旧同风格路线
  const old = await findRoute(params.id, styleId);
  if (old) {
    await prisma.tourRoute.delete({ where: { id: old.id } });
  }

  const route = await prisma.tourRoute.create({
    data: {
      projectId: params.id,
      waypointsJson: JSON.stringify(waypoints),
      pathJson: JSON.stringify(body.path ?? []),
      segmentsJson: JSON.stringify(body.segments ?? []),
      paramsJson: JSON.stringify({ styleId }),
    },
  });

  // 全景图转存文件
  const dir = path.join(UPLOADS_DIR, params.id);
  await fs.mkdir(dir, { recursive: true });

  const wpIdByOrder = new Map<number, string>();
  for (const w of waypoints) {
    const wp = await prisma.waypoint.create({
      data: {
        routeId: route.id,
        roomId: w.roomId ?? null,
        xMm: w.xMm,
        zMm: w.zMm,
        yaw: w.yaw,
        order: w.order,
        label: w.label,
      },
    });
    wpIdByOrder.set(w.order, wp.id);
  }

  for (const s of scenes) {
    const fileName = `tour-${styleId}-${s.index}.jpg`;
    await writeDataUrl(dir, fileName, s.dataUrl);
    const wpId = wpIdByOrder.get(s.index);
    if (!wpId) continue;
    await prisma.tourScene.create({
      data: {
        projectId: params.id,
        routeId: route.id,
        waypointId: wpId,
        name: `全景 ${s.index + 1}`,
        panoramaUrl: publicUrlForUpload(params.id, fileName),
        thumbnailUrl: publicUrlForUpload(params.id, fileName),
        width: 1280,
        height: 640,
        initialYaw: s.yaw,
        order: s.index,
        hotspotsJson: "[]",
      },
    });
  }

  return NextResponse.json({ ok: true, routeId: route.id }, { status: 201 });
}

/** dataURL → 文件（base64 部分） */
async function writeDataUrl(dir: string, fileName: string, dataUrl: string) {
  const m = /^data:image\/(?:jpeg|png|webp);base64,(.+)$/.exec(dataUrl);
  if (!m) return;
  const buf = Buffer.from(m[1], "base64");
  await fs.writeFile(path.join(dir, fileName), buf);
}
