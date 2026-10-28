import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { makeId, uploadDir } from "./paths.ts";

export type DecodedImage = {
  width: number;
  height: number;
  /** RGB 三通道，长度 = width*height*3 */
  data: Buffer;
};

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

/**
 * 解码为原始 RGB。
 * 户型图可能是 RGBA（带全不透明 alpha），统一转为 3 通道便于后续颜色分层处理。
 */
export async function decodeImage(bytes: Buffer): Promise<DecodedImage> {
  const { data, info } = await sharp(bytes)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}

/**
 * 全景图上传：必须严格 2:1 等距圆柱投影。
 * 普通平面效果图不得直接当作全景图发布（需求文档 §4.4 / §11）。
 */
export async function processPanoramaUpload(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const image = sharp(bytes, { failOn: "none" });
  const meta = await image.metadata();
  if (!meta.width || !meta.height) {
    throw new Error("无法读取图片尺寸，请上传 JPG/PNG/WebP 全景图。");
  }
  const ratio = meta.width / meta.height;
  if (Math.abs(ratio - 2) > 0.08) {
    throw new Error(
      `全景图必须为 2:1 等距圆柱投影，当前为 ${meta.width}×${meta.height}（比例 ${ratio.toFixed(2)}）。`,
    );
  }
  if (meta.width < 1800 || meta.height < 900) {
    throw new Error(
      "全景图尺寸过小，建议至少 4096×2048，最低不低于 1800×900。",
    );
  }

  await fs.mkdir(uploadDir, { recursive: true });
  const id = makeId("pano");
  const base = path.join(uploadDir, id);
  const fullPath = `${base}.webp`;
  const thumbPath = `${base}-thumb.webp`;
  const mobilePath = `${base}-mobile.webp`;

  await sharp(bytes)
    .resize({ width: Math.min(meta.width, 8192), withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(fullPath);
  await sharp(bytes)
    .resize(512, 256, { fit: "cover", position: "center" })
    .webp({ quality: 76 })
    .toFile(thumbPath);
  await sharp(bytes)
    .resize({ width: Math.min(meta.width, 2048), withoutEnlargement: true })
    .webp({ quality: 76 })
    .toFile(mobilePath);

  const stat = await fs.stat(fullPath);
  return {
    id,
    name: stripExtension(file.name),
    panoramaUrl: `/uploads/${path.basename(fullPath)}`,
    thumbnailUrl: `/uploads/${path.basename(thumbPath)}`,
    mobileUrl: `/uploads/${path.basename(mobilePath)}`,
    width: meta.width,
    height: meta.height,
    size: stat.size,
  };
}

/** 通用缩略图 */
export async function makeThumbnail(bytes: Buffer, width = 512) {
  return sharp(bytes)
    .resize(width, null, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
}

/** 保存任意字节到上传目录，返回公开 URL */
export async function saveBuffer(
  bytes: Buffer,
  ext: string,
  prefix: string,
): Promise<string> {
  await fs.mkdir(uploadDir, { recursive: true });
  const id = makeId(prefix);
  const fileName = `${id}${ext}`;
  await fs.writeFile(path.join(uploadDir, fileName), bytes);
  return `/uploads/${fileName}`;
}

/**
 * 无缝性检查：比较左右边缘列、上下边缘行的平均像素差。
 * AI 生成的贴图若存在明显接缝，直接贴到三维场景上会出现规则网格，必须拦截。
 */
export async function checkSeamless(bytes: Buffer): Promise<number> {
  const { data, info } = await sharp(bytes)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const avg = (fn: (x: number, y: number) => number) => {
    let sum = 0;
    let count = 0;
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        sum += fn(x, y);
        count++;
      }
    }
    return sum / count;
  };
  const px = (x: number, y: number, c: number) =>
    data[(y * width + x) * channels + c];

  // 左右边缘：x=0 与 x=width-1
  const horizontal = avg((x, y) => {
    let d = 0;
    for (let c = 0; c < 3; c++) {
      d += Math.abs(px(0, y, c) - px(width - 1, y, c));
    }
    return d / 3;
  });
  // 上下边缘：y=0 与 y=height-1
  const vertical = avg((x, y) => {
    let d = 0;
    for (let c = 0; c < 3; c++) {
      d += Math.abs(px(x, 0, c) - px(x, height - 1, c));
    }
    return d / 3;
  });
  return Math.max(horizontal, vertical);
}
