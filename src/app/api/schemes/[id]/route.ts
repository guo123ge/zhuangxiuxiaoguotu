import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/** PATCH /api/schemes/[id] — 更新方案（改名 / 覆盖集 / 设为主方案） */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const scheme = await prisma.designScheme.findUnique({ where: { id: params.id } });
  if (!scheme) return NextResponse.json({ error: "方案不存在" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.slice(0, 60);
  if (body.styleId !== undefined) data.styleId = body.styleId;
  if (body.overlay !== undefined) data.overlayJson = JSON.stringify(body.overlay);
  if (body.isPrimary === true) {
    data.isPrimary = true;
    await prisma.designScheme.updateMany({
      where: { projectId: scheme.projectId, id: { not: params.id } },
      data: { isPrimary: false },
    });
  }
  const updated = await prisma.designScheme.update({ where: { id: params.id }, data });
  return NextResponse.json({ scheme: updated });
}

/** DELETE /api/schemes/[id] — 删除方案 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.designScheme.deleteMany({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
