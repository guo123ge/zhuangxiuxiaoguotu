/**
 * 户型几何派生量计算（纯函数，前后端复用）。
 *
 * 输入坐标统一为毫米（图纸坐标系：原点左上角，x 右、y 下），
 * 与 FloorplanJson 的 polygonMm / centroidMm 保持一致。
 */

export type Pt = [number, number];

/** 多边形面积（平方毫米，取绝对值；鞋带公式） */
export function polygonAreaMm2(poly: Pt[]): number {
  const n = poly.length;
  if (n < 3) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % n];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

/** 面积换算为平方米 */
export function polygonAreaM2(poly: Pt[]): number {
  return polygonAreaMm2(poly) / 1_000_000;
}

/** 多边形质心（毫米） */
export function polygonCentroidMm(poly: Pt[]): Pt {
  const n = poly.length;
  if (n === 0) return [0, 0];
  if (n < 3) {
    // 退化为点/线段：取平均
    let sx = 0;
    let sy = 0;
    for (const [x, y] of poly) {
      sx += x;
      sy += y;
    }
    return [sx / n, sy / n];
  }
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % n];
    const cross = x1 * y2 - x2 * y1;
    a += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(a) < 1e-6) {
    // 退化：返回平均
    let sx = 0;
    let sy = 0;
    for (const [x, y] of poly) {
      sx += x;
      sy += y;
    }
    return [sx / n, sy / n];
  }
  a *= 0.5;
  return [cx / (6 * a), cy / (6 * a)];
}

/** 多边形周长（毫米） */
export function polygonPerimeterMm(poly: Pt[]): number {
  const n = poly.length;
  if (n < 2) return 0;
  let p = 0;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % n];
    p += Math.hypot(x2 - x1, y2 - y1);
  }
  return p;
}

/** 轴对齐包围盒 [x0, y0, x1, y1]（毫米） */
export function polygonBBoxMm(poly: Pt[]): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of poly) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}

/** 包围盒长宽（毫米，长边为 lengthMm） */
export function polygonLengthWidthMm(poly: Pt[]): { lengthMm: number; widthMm: number } {
  const [x0, y0, x1, y1] = polygonBBoxMm(poly);
  const w = x1 - x0;
  const h = y1 - y0;
  return w >= h ? { lengthMm: w, widthMm: h } : { lengthMm: h, widthMm: w };
}

/**
 * 重新计算一个房间的派生几何量（质心 / 面积 / 周长 / 包围盒），
 * 原地风格地返回新对象，避免调用方忘记同步多字段。
 */
export function recomputeRoomGeometry<T extends { polygonMm: Pt[] }>(room: T): T {
  const area = polygonAreaM2(room.polygonMm);
  const centroid = polygonCentroidMm(room.polygonMm);
  const perimeter = polygonPerimeterMm(room.polygonMm);
  const { lengthMm, widthMm } = polygonLengthWidthMm(room.polygonMm);
  return {
    ...room,
    areaM2: area,
    centroidMm: centroid,
    perimeterMm: perimeter,
    lengthMm,
    widthMm,
  } as T & { areaM2: number; centroidMm: Pt; perimeterMm: number; lengthMm: number; widthMm: number };
}
