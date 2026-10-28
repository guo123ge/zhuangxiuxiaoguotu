import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { UPLOADS_DIR, publicUrlForUpload } from "@/lib/paths";
import { sampleFloorplans } from "@/lib/samples";
import { routePage } from "@/lib/cv/pageRouter";
import { loadAndMeasure, computePageMetrics } from "@/lib/cv/preprocess";
import { PAGE_KIND } from "@/lib/enums";

export const runtime = "nodejs";

const MAX_SIZE = 30 * 1024 * 1024; // 30MB

/**
 * POST /api/projects/[id]/floorplans
 * 两种用法：
 *   1. multipart 上传文件（图片或 PDF，PDF 逐页栅格化并逐页分流）
 *   2. JSON { sampleId } 从内置样本创建
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    const sample = sampleFloorplans.find((s) => s.id === body.sampleId);
    if (!sample) return NextResponse.json({ error: "样本不存在" }, { status: 404 });
    const srcPath = path.join(process.cwd(), "public", sample.fileUrl);
    const bytes = await fs.readFile(srcPath);
    const asset = await persistImage(project.id, bytes, sample.name);
    return NextResponse.json({ asset }, { status: 201 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少文件" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "文件超过 30MB 限制" }, { status: 413 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const name = file.name || "未命名";

  if (file.type === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
    const assets = await persistPdf(project.id, bytes, name);
    return NextResponse.json({ assets }, { status: 201 });
  }

  const asset = await persistImage(project.id, bytes, name);
  return NextResponse.json({ asset }, { status: 201 });
}

/** 保存图片为 FloorplanAsset，同时跑页面分流 */
async function persistImage(projectId: string, bytes: Buffer, originalName: string) {
  const id = crypto.randomUUID();
  const relDir = path.join(UPLOADS_DIR, projectId);
  await fs.mkdir(relDir, { recursive: true });
  const fileName = `${id}.png`;
  const absPath = path.join(relDir, fileName);

  // 统一转 PNG（去 alpha 之外的色彩空间差异）
  const png = await sharp(bytes).png().toBuffer();
  await fs.writeFile(absPath, png);

  const { image } = await loadAndMeasure(png);
  const pageKind = routePage(computePageMetrics(image));

  return prisma.floorplanAsset.create({
    data: {
      projectId,
      fileType: "IMAGE",
      pageKind,
      originalName,
      fileUrl: publicUrlForUpload(projectId, fileName),
      size: bytes.length,
      width: image.width,
      height: image.height,
      pageCount: 1,
      selectedPage: pageKind === PAGE_KIND.BLUEPRINT ? 1 : null,
      status: "UPLOADED",
    },
  });
}

/** PDF 逐页栅格化（200 DPI）+ 逐页分流 */
async function persistPdf(projectId: string, bytes: Buffer, originalName: string) {
  // pdfjs-dist 在 Node 下需要 legacy 构建 + canvas
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("@napi-rs/canvas");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;

  const assets = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 200 / 72 }); // 200 DPI
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");
    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    const png = canvas.toBuffer("image/png");
    const asset = await persistImage(projectId, png, `${originalName} 第${p}页`);
    assets.push(await prisma.floorplanAsset.update({
      where: { id: asset.id },
      data: { fileType: "PDF", pageCount: doc.numPages, selectedPage: p },
    }));
  }
  return assets;
}

/** GET：项目的户型图列表 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const assets = await prisma.floorplanAsset.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ assets });
}
