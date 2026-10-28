/**
 * 掩膜矢量化为多边形集合（含孔洞）。
 *
 * 复用边界有向边图：收集全部「1|0」分界边，逐条未用边出发行走，
 * 每次得到一个闭环。外环与孔环通过有向面积区分：
 *   内部在右的定向下，外环为顺时针（像素 y 向下坐标系中带符号面积为正），
 *   孔环为逆时针（面积为负）。
 */
import type { Polygon } from "./contour.ts";
import { polygonArea, simplifyPolygon } from "./contour.ts";

export type MaskLoops = {
  /** 外环列表 */
  outers: Polygon[];
  /** 孔环列表（归属由调用方做点包含判断） */
  holes: Polygon[];
};

export function vectorizeMask(
  mask: Uint8Array,
  width: number,
  height: number,
  tolerancePx = 1.5,
): MaskLoops {
  const isOn = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1;

  const LW = width + 1;
  const LH = height + 1;
  const outEdges = new Map<number, { to: number; dir: number }[]>();
  const addEdge = (fx: number, fy: number, tx: number, ty: number, dir: number) => {
    const from = fy * LW + fx;
    const to = ty * LW + tx;
    let arr = outEdges.get(from);
    if (!arr) { arr = []; outEdges.set(from, arr); }
    arr.push({ to, dir });
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] !== 1) continue;
      if (!isOn(x, y - 1)) addEdge(x, y, x + 1, y, 0);       // 顶边 →
      if (!isOn(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1, 2); // 底边 ←
      if (!isOn(x - 1, y)) addEdge(x, y + 1, x, y, 3);       // 左边 ↑
      if (!isOn(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1, 1); // 右边 ↓
    }
  }

  const used = new Uint8Array(LW * LH * 4); // 每条有向边: from * 4 + dir … 用 from+to 组合键更稳
  const edgeKey = (from: number, to: number) => from * (LW * LH) + to;
  const usedSet = new Set<number>();
  void used;

  const outers: Polygon[] = [];
  const holes: Polygon[] = [];

  // 每条未用边都可能是一个环的起点
  for (const [from, cands] of outEdges) {
    for (const e of cands) {
      if (usedSet.has(edgeKey(from, e.to))) continue;
      // 行走一个闭环
      const loop: Polygon = [];
      let curFrom = from;
      let curDir = e.dir;
      const startV = from;
      let steps = 0;
      const maxSteps = 8 * width * height;
      loop.push([curFrom % LW, Math.floor(curFrom / LW)]);
      let ok = true;
      while (steps++ < maxSteps) {
        const cs = outEdges.get(curFrom);
        if (!cs) { ok = false; break; }
        let best: { to: number; dir: number } | null = null;
        let bestScore = Number.MAX_SAFE_INTEGER;
        for (const c of cs) {
          if (usedSet.has(edgeKey(curFrom, c.to))) continue;
          const turn = ((c.dir - curDir) % 4 + 4) % 4; // 0直 1右 2掉头 3左
          const score = [0, 1, 3, 2][turn]; // 直 > 右 > 左 > 掉头
          if (score < bestScore) { bestScore = score; best = c; }
        }
        if (!best) break; // 回到起点后无可用边
        usedSet.add(edgeKey(curFrom, best.to));
        curFrom = best.to;
        curDir = best.dir;
        if (curFrom === startV) break;
        loop.push([curFrom % LW, Math.floor(curFrom / LW)]);
      }
      if (!ok || loop.length < 3) continue;
      if (Math.abs(polygonArea(loop)) < 2) continue; // 退化环
      const simplified = simplifyPolygon(loop, tolerancePx);
      if (simplified.length < 3) continue;
      if (polygonArea(simplified) > 0) outers.push(simplified);
      else holes.push(simplified);
    }
  }

  return { outers, holes };
}

/** 点是否在多边形内（射线法） */
export function pointInPolygon(x: number, y: number, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** 把孔环分配给包含它的外环 */
export function assignHoles(loops: MaskLoops): { outer: Polygon; holes: Polygon[] }[] {
  return loops.outers.map((outer) => ({
    outer,
    holes: loops.holes.filter((h) => pointInPolygon(h[0][0], h[0][1], outer)),
  }));
}
