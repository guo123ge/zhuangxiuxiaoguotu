/**
 * 轮廓提取：把房间标签图的每个区域追踪为矢量多边形。
 *
 * 采用 Moore 邻域边界跟踪 + Douglas-Peucker 简化。
 * 输出坐标为像素坐标（x 右，y 下），由调用方换算成毫米。
 */

export type Polygon = [number, number][];

/** Douglas-Peucker 简化（先去重连续重复点，再去共线点） */
export function simplifyPolygon(points: Polygon, tolerance: number): Polygon {
  // 去连续重复点（原地转向会产生）
  const pts: Polygon = [];
  for (const p of points) {
    const last = pts[pts.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) pts.push(p);
  }
  if (pts.length <= 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    let maxD = 0;
    let maxI = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      const d = len === 0
        ? Math.hypot(px - ax, py - ay)
        : Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (d > maxD) { maxD = d; maxI = i; }
    }
    if (maxD > tolerance && maxI > 0) {
      keep[maxI] = 1;
      stack.push([a, maxI], [maxI, b]);
    }
  }
  const out: Polygon = [];
  for (let i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
  // 去共线点（相邻两边方向相同）
  const dedup: Polygon = [];
  for (let i = 0; i < out.length; i++) {
    const prev = dedup[dedup.length - 1];
    const cur = out[i];
    const next = out[(i + 1) % out.length];
    if (prev) {
      const d1x = Math.sign(cur[0] - prev[0]);
      const d1y = Math.sign(cur[1] - prev[1]);
      const d2x = Math.sign(next[0] - cur[0]);
      const d2y = Math.sign(next[1] - cur[1]);
      if (d1x === d2x && d1y === d2y) continue; // 共线，跳过
    }
    dedup.push(cur);
  }
  return dedup;
}

/** 多边形面积（鞋带公式，带符号；CCW 为正） */
export function polygonArea(poly: Polygon): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

/**
 * 追踪指定标签区域的外轮廓（边界有向边图法）。
 *
 * 思路：收集所有「目标|非目标」之间的像素边，按内部在右侧定向，
 * 得到格点上的有向边图；每个格点出度=入度。从最高点出发沿边行走，
 * 遇岔路按「最右转优先」保持贴外环。每条边只走一次，必然闭合。
 * 对细颈、对角接触、孔洞均鲁棒（Pavlidis 会在 2×2 凹口中死循环，已弃用）。
 *
 * 返回格点坐标多边形（范围 0..width / 0..height，像素边缘）。
 */
export function traceRegionOutline(
  labels: Int32Array,
  width: number,
  height: number,
  target: number,
): Polygon | null {
  const isTarget = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && labels[y * width + x] === target;

  // 1. 收集有向边界边（内部在右）：
  //    顶边（上方非目标）: (x,y)→(x+1,y)   向右
  //    底边（下方非目标）: (x+1,y+1)→(x,y+1) 向左
  //    左边（左方非目标）: (x,y+1)→(x,y)   向上
  //    右边（右方非目标）: (x+1,y)→(x+1,y+1) 向下
  // 格点编码 key = ly*(width+1)+lx
  const LW = width + 1;
  const outEdges = new Map<number, { to: number; dir: number }[]>();
  let startEdge: { from: number; to: number; dir: number } | null = null;
  let startPixelTopY = Number.MAX_SAFE_INTEGER;

  const addEdge = (fx: number, fy: number, tx: number, ty: number, dir: number) => {
    const from = fy * LW + fx;
    const to = ty * LW + tx;
    let arr = outEdges.get(from);
    if (!arr) { arr = []; outEdges.set(from, arr); }
    arr.push({ to, dir });
    return { from, to, dir };
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (labels[y * width + x] !== target) continue;
      if (!isTarget(x, y - 1)) {
        const e = addEdge(x, y, x + 1, y, 0);
        if (y < startPixelTopY) { startPixelTopY = y; startEdge = e; }
      }
      if (!isTarget(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1, 2);
      if (!isTarget(x - 1, y)) addEdge(x, y + 1, x, y, 3);
      if (!isTarget(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1, 1);
    }
  }
  if (!startEdge) return null;

  // 2. 沿边行走：最右转优先（dir: 0右 1下 2左 3上；右转=+1，直行=0，左转=-1）
  const used = new Set<number>(); // from 顶点 + to 顶点编码
  const outline: Polygon = [];
  let curFrom = startEdge.from;
  let curDir = startEdge.dir;
  const maxSteps = 8 * width * height;
  let steps = 0;

  outline.push([curFrom % LW, Math.floor(curFrom / LW)]);
  while (steps++ < maxSteps) {
    const cands = outEdges.get(curFrom);
    if (!cands || cands.length === 0) return null; // 图不守恒，异常
    // 从候选中按转向偏好选：直行(0) > 右转(+1) > 左转(-1) > 掉头(+2)
    // 注意：内部在右的定向下，外环在岔路应「尽可能右转」以贴紧外侧；
    // 但掉头/重复边必须避免，因此先过滤已用边。
    let best: { to: number; dir: number } | null = null;
    let bestScore = Number.MAX_SAFE_INTEGER;
    for (const e of cands) {
      const edgeKey = curFrom * (LW * (height + 1)) + e.to;
      if (used.has(edgeKey)) continue;
      const turn = ((e.dir - curDir) % 4 + 4) % 4; // 0直 1右 2掉头 3左
      const score = [0, 1, 3, 2][turn]; // 优先级：直>右>左>掉头
      if (score < bestScore) { bestScore = score; best = e; }
    }
    if (!best) {
      // 所有出边都已用：若回到起点则闭合，否则异常终止
      break;
    }
    used.add(curFrom * (LW * (height + 1)) + best.to);
    curFrom = best.to;
    curDir = best.dir;
    if (curFrom === startEdge.from) break; // 闭合
    outline.push([curFrom % LW, Math.floor(curFrom / LW)]);
  }

  if (outline.length < 3 || steps >= maxSteps) return null;
  // 面积校验：有效外环面积必须 > 0
  if (Math.abs(polygonArea(outline)) < 1) return null;
  return outline;
}

/**
 * 提取所有房间的简化多边形。
 * @param tolerancePx 简化容差（像素），建议 1.5~2.5
 */
export function extractRoomPolygons(
  labels: Int32Array,
  width: number,
  height: number,
  roomLabels: number[],
  tolerancePx = 2,
): Map<number, Polygon> {
  const out = new Map<number, Polygon>();
  for (const l of roomLabels) {
    const raw = traceRegionOutline(labels, width, height, l);
    if (!raw) continue;
    const simplified = simplifyPolygon(raw, tolerancePx);
    if (simplified.length >= 3 && Math.abs(polygonArea(simplified)) > 4) {
      out.set(l, simplified);
    }
  }
  return out;
}
