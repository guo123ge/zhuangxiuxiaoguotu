import sharp from "sharp";
import { decodeImage } from "../image.ts";

export type RgbImage = {
  width: number;
  height: number;
  /** RGB 三通道，长度 = width * height * 3 */
  data: Buffer;
};

export type PageMetrics = {
  width: number;
  height: number;
  /** 亮度 > 0.94 的像素占比 */
  whiteRatio: number;
  /** max(RGB) - min(RGB) < 12 的像素占比（近灰度） */
  grayRatio: number;
  /** HSV 饱和度均值 */
  satMean: number;
  /** 亮度均值 */
  lumMean: number;
  /** 梯度幅值 > 60 的像素占比（细线密度） */
  thinLineDensity: number;
  /** 饱和色块连通域中，最大一块的面积占比 */
  maxColorBlock: number;
  /** 墨迹覆盖率（非白像素占比） */
  inkRatio: number;
  /** 估算倾角（度），用于判断是否需要纠偏 */
  estimatedSkewDeg: number;
};

/**
 * 解码图片并计算页面判别量。
 *
 * 素材实测特征（用于校准阈值）：
 *   户型图：whiteRatio 0.64-0.68、grayRatio 0.83-0.88、satMean < 0.12、倾角 0°
 *   营销页：whiteRatio 0.41-0.43、grayRatio 低、satMean 0.20-0.28
 */
export async function loadAndMeasure(bytes: Buffer): Promise<{
  image: RgbImage;
  metrics: PageMetrics;
}> {
  const image = await decodeImage(bytes);
  const metrics = computePageMetrics(image);
  return { image, metrics };
}

export function computePageMetrics(image: RgbImage): PageMetrics {
  const { width, height, data } = image;
  const total = width * height;

  let white = 0;
  let gray = 0;
  let satSum = 0;
  let lumSum = 0;
  let ink = 0;

  for (let i = 0; i < total; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];

    const max = r > g ? (r > b ? r : b) : g > b ? g : b;
    const min = r < g ? (r < b ? r : b) : g < b ? g : b;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    lumSum += lum;

    if (lum > 0.94) white++;
    else ink++;
    if (max - min < 12) gray++;
    if (max > 0) satSum += (max - min) / max;
  }

  // 细线密度：Sobel 近似（只对亮度做水平+垂直差分）
  let edge = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 3;
      const idxR = (y * width + x + 1) * 3;
      const idxD = ((y + 1) * width + x) * 3;
      const lumC =
        0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const lumR =
        0.299 * data[idxR] + 0.587 * data[idxR + 1] + 0.114 * data[idxR + 2];
      const lumD =
        0.299 * data[idxD] + 0.587 * data[idxD + 1] + 0.114 * data[idxD + 2];
      if (Math.abs(lumC - lumR) + Math.abs(lumC - lumD) > 60) edge++;
    }
  }

  const maxColorBlock = largestColorBlock(image);
  const estimatedSkewDeg = estimateSkew(image);

  return {
    width,
    height,
    whiteRatio: white / total,
    grayRatio: gray / total,
    satMean: satSum / total,
    lumMean: lumSum / total,
    thinLineDensity: edge / total,
    maxColorBlock,
    inkRatio: ink / total,
    estimatedSkewDeg,
  };
}

/**
 * 最大饱和色块面积占比。
 * 在 160×160 降采样网格上做连通域，避免全分辨率的高开销。
 */
function largestColorBlock(image: RgbImage): number {
  const { width, height, data } = image;
  const GW = 160;
  const GH = 160;
  const grid = new Uint8Array(GW * GH);

  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const x = Math.min(width - 1, Math.floor((gx * width) / GW));
      const y = Math.min(height - 1, Math.floor((gy * height) / GH));
      const i = (y * width + x) * 3;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max > 0 ? (max - min) / max : 0;
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      // 饱和且非白 —— 照片区域的特征
      if (sat > 0.3 && lum > 0.12 && lum < 0.97) grid[gy * GW + gx] = 1;
    }
  }

  const visited = new Uint8Array(GW * GH);
  let largest = 0;
  const stack: number[] = [];

  for (let i = 0; i < GW * GH; i++) {
    if (grid[i] === 0 || visited[i]) continue;
    let size = 0;
    stack.push(i);
    visited[i] = 1;
    while (stack.length > 0) {
      const cur = stack.pop()!;
      size++;
      const cx = cur % GW;
      const cy = (cur - cx) / GW;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
          const ni = ny * GW + nx;
          if (grid[ni] === 1 && !visited[ni]) {
            visited[ni] = 1;
            stack.push(ni);
          }
        }
      }
    }
    if (size > largest) largest = size;
  }

  return largest / (GW * GH);
}

/**
 * 估算倾角：对若干条水平扫描线，统计墨迹像素的 y 位置方差最小对应的旋转角。
 * 简化实现：在 ±3° 内以 0.5° 步进，取水平投影清晰度最高的角度。
 */
function estimateSkew(image: RgbImage): number {
  const { width, height, data } = image;
  const rows = 24;
  let bestAngle = 0;
  let bestScore = -1;

  for (let a = -3; a <= 3; a += 0.5) {
    const rad = (a * Math.PI) / 180;
    let score = 0;
    for (let k = 1; k <= rows; k++) {
      const y = Math.floor((k * height) / (rows + 1));
      let variance = 0;
      let sum = 0;
      const vals: number[] = [];
      for (let x = 0; x < width; x++) {
        const yy = Math.round(y + x * Math.tan(rad));
        if (yy < 0 || yy >= height) continue;
        const i = (yy * width + x) * 3;
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        vals.push(lum);
        sum += lum;
      }
      if (vals.length === 0) continue;
      const mean = sum / vals.length;
      for (const v of vals) variance += (v - mean) * (v - mean);
      // 方差越大，说明该角度下墨迹行越"锐利"（黑白分明）
      score += variance / vals.length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestAngle = a;
    }
  }
  return bestAngle;
}

/** 超分预处理：仅用于检测副本，不入库。用于提升低分辨率户型图的细线可检性。 */
export async function upscaleForDetection(
  bytes: Buffer,
  factor = 2,
): Promise<Buffer> {
  return sharp(bytes, { failOn: "none" })
    .resize({
      width: Math.round(
        (await sharp(bytes).metadata()).width! * factor,
      ),
      kernel: "lanczos3",
    })
    .png()
    .toBuffer();
}
