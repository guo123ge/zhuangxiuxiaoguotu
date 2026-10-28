import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { styleById, designStyles } from "@/lib/styles";

export const runtime = "nodejs";

/** GET /api/projects/[id]/schemes — 方案列表 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const schemes = await prisma.designScheme.findMany({
    where: { projectId: params.id },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ schemes });
}

/** POST /api/projects/[id]/schemes — 从风格创建方案（或自定义覆盖） */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const styleId = typeof body.styleId === "string" ? body.styleId : "modern-minimal";
  if (!styleById.has(styleId)) {
    return NextResponse.json({ error: "未知风格" }, { status: 400 });
  }
  const style = styleById.get(styleId)!;
  const count = await prisma.designScheme.count({ where: { projectId: params.id } });
  const isPrimary = count === 0 || !!body.isPrimary;

  const scheme = await prisma.designScheme.create({
    data: {
      projectId: params.id,
      name: body.name?.toString().slice(0, 60) || `${style.name}方案 ${count + 1}`,
      styleId,
      isPrimary,
      order: body.order ?? count,
      overlayJson: JSON.stringify(body.overlay ?? {}),
    },
  });
  if (isPrimary) {
    await prisma.designScheme.updateMany({
      where: { projectId: params.id, id: { not: scheme.id } },
      data: { isPrimary: false },
    });
  }
  return NextResponse.json({ scheme }, { status: 201 });
}
