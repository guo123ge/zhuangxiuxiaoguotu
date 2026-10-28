import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { UPLOADS_DIR, publicUrlForUpload } from "@/lib/paths";

export const runtime = "nodejs";

const MAX_SIZE = 20 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

/** GET /api/projects/[id]/references — 参考图列表 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const refs = await prisma.referenceImage.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ references: refs });
}

/** POST /api/projects/[id]/references — 上传参考图（multipart 单文件） */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少文件" }, { status: 400 });
  }
  if (!ACCEPTED.includes(file.type)) {
    return NextResponse.json({ error: "仅支持 PNG / JPG / WebP 图片" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "文件超过 20MB 限制" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const id = crypto.randomUUID();
  const dir = path.join(UPLOADS_DIR, params.id);
  await fs.mkdir(dir, { recursive: true });

  const fullName = `ref-${id}.webp`;
  const thumbName = `ref-${id}-thumb.webp`;
  await sharp(bytes).webp({ quality: 88 }).toFile(path.join(dir, fullName));
  await sharp(bytes)
    .resize(480, 360, { fit: "cover", position: "center" })
    .webp({ quality: 78 })
    .toFile(path.join(dir, thumbName));

  const ref = await prisma.referenceImage.create({
    data: {
      projectId: params.id,
      originalName: file.name || "未命名参考图",
      fileUrl: publicUrlForUpload(params.id, fullName),
      thumbnailUrl: publicUrlForUpload(params.id, thumbName),
      kind: "USER",
    },
  });
  return NextResponse.json({ reference: ref }, { status: 201 });
}
