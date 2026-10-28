import type { RgbImage } from "./preprocess.ts";

export type ColorMasks = {
  width: number;
  height: number;
  /** 纸张亮度（第 99 百分位），用于自适应阈值 */
  paperLum: number;
  /** 深色实心墙带 —— 墙体主特征。自适应：lum < paper - 0.42 且去饱和 */
  dark: Uint8Array;
  /** 一切非纸面墨迹：墙体 + 细线 + 文字 + 弧。用于细线/尺寸线检测 */
  ink: Uint8Array;
  /** 蓝绿 —— 外圈玻璃幕墙 */
  blue: Uint8Array;
  /** 米色 —— 地毯 / 床品 / 卧室区域 */
  beige: Uint8Array;
  /** 绿色 —— 植物点缀（阳台 / 景观） */
  green: Uint8Array;
  /** 纯白 */
  white: Uint8Array;
};

/**
 * 颜色分层。
 *
 * 实测画法（用 ViewImage + 像素探测确认）：
 *   - 墙体是深色实心填充带（lum 约 0.25-0.5，宽 10-13px ≈ 200-240mm），带细密横向纹理
 *   - 尺寸线是连续直线（1-2px，lum 约 0.4-0.7），竖刻度在段边界，数字居中在段上方
 *   - 门是四分之一圆弧（细灰线）
 *   - 外圈玻璃是蓝绿色带
 *   - 家具是浅米色/浅绿填充
 *
 * 阈值必须基于纸张亮度自适应，因为不同图的白底亮度有差异。
 */
export function buildColorMasks(image: RgbImage): ColorMasks {
  const { width, height, data } = image;
  const total = width * height;

  // 第一趟：亮度直方图，求纸张亮度
  const lum = new Float32Array(total);
  const hist = new Int32Array(256);
  for (let i = 0; i < total; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    const L = 0.299 * r + 0.587 * g + 0.114 * b;
    lum[i] = L / 255;
    hist[Math.min(255, Math.floor(L))]++;
  }
  let cum = 0;
  let paper = 255;
  for (let v = 255; v >= 0; v--) {
    cum += hist[v];
    if (cum > total * 0.01) {
      paper = v;
      break;
    }
  }
  const paperLum = paper / 255; // 约 0.97-1.0

  const darkTh = paperLum - 0.42; // 墙体
  const inkTh = paperLum - 0.18; // 一切墨迹

  const dark = new Uint8Array(total);
  const ink = new Uint8Array(total);
  const blue = new Uint8Array(total);
  const beige = new Uint8Array(total);
  const green = new Uint8Array(total);
  const white = new Uint8Array(total);

  for (let i = 0; i < total; i++) {
    const r = data[i * 3] / 255;
    const g = data[i * 3 + 1] / 255;
    const b = data[i * 3 + 2] / 255;
    const L = lum[i];

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;
    if (delta > 0) {
      if (max === r) h = 60 * (((g - b) / delta) % 6);
      else if (max === g) h = 60 * ((b - r) / delta + 2);
      else h = 60 * ((r - g) / delta + 4);
    }
    if (h < 0) h += 360;
    const s = max > 0 ? delta / max : 0;

    if (L < darkTh) dark[i] = 1;
    if (L < inkTh) ink[i] = 1;
    if (L > paperLum - 0.03) white[i] = 1;
    if (h >= 165 && h <= 215 && s >= 0.06 && s < 0.5 && L > 0.5 && L < paperLum - 0.04) blue[i] = 1;
    if (h >= 25 && h <= 55 && s >= 0.06 && s <= 0.4 && L > 0.78 && L < paperLum - 0.03) beige[i] = 1;
    if (h >= 70 && h <= 165 && s > 0.12 && L < paperLum - 0.04) green[i] = 1;
  }

  return { width, height, paperLum, dark, ink, blue, beige, green, white };
}

export function maskStats(masks: ColorMasks) {
  const total = masks.width * masks.height;
  const ratio = (m: Uint8Array) => {
    let c = 0;
    for (let i = 0; i < total; i++) if (m[i]) c++;
    return c / total;
  };
  return {
    dark: ratio(masks.dark),
    ink: ratio(masks.ink),
    blue: ratio(masks.blue),
    beige: ratio(masks.beige),
    green: ratio(masks.green),
    white: ratio(masks.white),
  };
}

/** 形态学膨胀：半径 r 内只要有 1 即置 1。用于闭墙、补缺口 */
export function dilate(mask: Uint8Array, width: number, height: number, r: number): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) out[ny * width + nx] = 1;
        }
      }
    }
  }
  return out;
}

/** 形态学腐蚀：半径 r 内有 0 即置 0。用于细化 */
export function erode(mask: Uint8Array, width: number, height: number, r: number): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let ok = true;
      outer: for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || !mask[ny * width + nx]) {
            ok = false;
            break outer;
          }
        }
      }
      if (ok) out[y * width + x] = 1;
    }
  }
  return out;
}

/** 开运算：先腐蚀后膨胀。去小噪点、去细线、保大块 */
export function open(mask: Uint8Array, width: number, height: number, r: number): Uint8Array {
  return dilate(erode(mask, width, height, r), width, height, r);
}

/** 闭运算：先膨胀后腐蚀。补小缺口 */
export function close(mask: Uint8Array, width: number, height: number, r: number): Uint8Array {
  return erode(dilate(mask, width, height, r), width, height, r);
}
