import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { UPLOADS_DIR } from "@/lib/paths";

export const runtime = "nodejs";

/** DELETE /api/references/[id] — 删除参考图（含磁盘文件） */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ref = await prisma.referenceImage.findUnique({ where: { id: params.id } });
  if (!ref) return NextResponse.json({ error: "参考图不存在" }, { status: 404 });

  await prisma.referenceImage.delete({ where: { id: params.id } });

  // 尽力删除磁盘文件（路径形如 /uploads/{projectId}/ref-xxx.webp）
  const tryUnlink = async (url: string | null) => {
    if (!url) return;
    const m = /\/uploads\/(.+)$/.exec(url);
    if (!m) return;
    try {
      await fs.unlink(path.join(UPLOADS_DIR, m[1]));
    } catch { /* 文件可能已不存在 */ }
  };
  await tryUnlink(ref.fileUrl);
  await tryUnlink(ref.thumbnailUrl);

  return NextResponse.json({ ok: true });
}
