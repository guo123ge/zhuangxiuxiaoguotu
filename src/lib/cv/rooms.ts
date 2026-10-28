import { close, dilate, open } from "./colorLayer.ts";
import { labelComponents } from "./components.ts";
import type { ChainSet } from "./scale.ts";

export type RoomRegion = {
  /** 房间标签（1..K） */
  label: number;
  /** 像素面积（回填后） */
  sizePx: number;
  /** 包围盒 [x0, y0, x1, y1] */
  box: [number, number, number, number];
  /** 质心 */
  centroid: [number, number];
  /** 房间核内最大净空距离（px），越大说明空间越开阔 */
  maxDistPx: number;
};

export type SegmentOptions = {
  chains?: ChainSet;
  minAreaM2?: number;
  /** 房间分隔阈值（mm）：净空距离小于此值的通道视为门洞/窄道，会把两侧分成不同房间 */
  roomBarrierMm?: number;
  /** 高门槛分隔阈值（mm）：用于拆分经宽颈合并的大房间（层级拆分） */
  roomBarrierHighMm?: number;
  /** 密封半径（mm）：墙体膨胀该距离后从图边泛洪判定室外。
   *  需 ≥ 入户门宽的一半（0.95m 门 → 0.6m），且 ≤ 窄房间半宽（1.8m 卫生间 → 0.9m） */
  sealRadiusMm?: number;
};

export type SegmentResult = {
  /** 每个像素所属房间标签，0 = 墙/外部/未分配 */
  roomLabels: Int32Array;
  rooms: RoomRegion[];
  /** 清洗后的实体墙掩膜 */
  wallBase: Uint8Array;
  /** 净空距离场（px），供后续可视覆盖/路径规划复用 */
  distPx: Float32Array;
  /** 室内掩膜（含墙体），0 = 室外 */
  insideMask: Uint8Array;
  /** 分析区域（建筑包围盒） */
  region: { x0: number; y0: number; x1: number; y1: number };
  /** 被剔除的外部吸附连通块数（诊断用） */
  droppedComponents: number;
  /** 层级拆分记录（诊断用）：哪个房间被拆成了几个 */
  splits: { room: number; parts: number }[];
};

/**
 * 房间分割（膨胀密封泛洪法，实测五图验证后选定）。
 *
 * 原理：
 *   1. 墙掩膜 = open(dark,3) 去细线 + close(_,5) 填纹理缝 ∪ 蓝色玻璃（封外窗）。
 *      五张样图实测：墙带连续、窗带由玻璃线封死、门是墙体上的真实缺口。
 *   2. 室外判定：墙体膨胀 R≈0.6m 后从图像边界泛洪。R 桥接入户门（~1.0m）
 *      等外墙缺口；膨胀只用于室外判定，不参与房间量测，因此不会
 *      侵蚀小房间（被吞像素既非室外也非自由，只是不参与）。
 *   3. 膨胀会在建筑外围留一圈 0.6m 的「吸附带」（泛洪被墙挡在 0.6m 外），
 *      该带自由空间与室外连通 → 按连通块剔除：凡与室外相邻的自由
 *      连通块整块判为外部，室内房间被墙体隔开、永不与室外相邻。
 *   4. 房间核 = 室内自由空间中净空距离 ≥ 0.5m 的连通块（门洞鞍部
 *      距离 ~0.45m 天然断开，无需找门弧）；窄道/门口按多源 BFS 回填。
 *   5. 层级拆分：低门槛(0.5m)保窄房间，高门槛(0.6m)核拆分宽颈合并。
 */
export function segmentRooms(
  masks: { dark: Uint8Array; blue: Uint8Array; width: number; height: number },
  mmPerPx: number,
  opts: SegmentOptions = {},
): SegmentResult {
  const { width, height } = masks;
  const total = width * height;
  const minAreaM2 = opts.minAreaM2 ?? 1.2;
  const roomBarrierPx = (opts.roomBarrierMm ?? 500) / mmPerPx;
  const sealR = Math.max(12, Math.round((opts.sealRadiusMm ?? 600) / mmPerPx));

  // ── 1. 实体墙掩膜 ──
  const thin = open(masks.dark, width, height, 3);
  const wallBase = close(thin, width, height, 5);
  const glass = dilate(masks.blue, width, height, 2);
  for (let i = 0; i < total; i++) if (glass[i]) wallBase[i] = 1;

  // ── 2. 室外泛洪：膨胀密封后从图边灌入 ──
  const sealed = dilateBox(wallBase, width, height, sealR);
  const outside = floodOutside(sealed, width, height);

  // ── 3. 室内：¬outside 再腐蚀掉外围吸附带 ──
  // 泛洪被密封带挡在墙外 sealR 处，因此 ¬outside = 建筑 ∪ 外围 0.6m 吸附带。
  // 吸附带经入户门与室内连通（合法开口），不能按连通块剔除；
  // 改用腐蚀：erode(¬outside, sealR + 墙厚余量) 恰好剥掉吸附带与外墙外皮，
  // 室内仅在外墙内侧损失约 0.3-0.4m 一条窄带（后续墙体会回填该区域）。
  const insideMask = erodeBoxInPlace(outside, width, height, sealR + 15);
  const freeMask = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (insideMask[i] && !wallBase[i]) freeMask[i] = 1;
  }
  let droppedComponents = 0; // 腐蚀法下无逐块剔除，保留字段兼容

  // ── 4. 建筑包围盒 ──
  let rx0 = width - 1, ry0 = height - 1, rx1 = 0, ry1 = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!insideMask[y * width + x]) continue;
      if (x < rx0) rx0 = x;
      if (y < ry0) ry0 = y;
      if (x > rx1) rx1 = x;
      if (y > ry1) ry1 = y;
    }
  }
  if (rx1 < rx0) { rx0 = ry0 = 0; rx1 = width - 1; ry1 = height - 1; }
  const region = { x0: rx0, y0: ry0, x1: rx1, y1: ry1 };

  // ── 5. 净空距离场（在室内范围上）──
  const distPx = distanceTransform(wallBase, insideMask, width, height);

  // ── 6. 房间核（层级式）──
  const roomBarrierHighPx = (opts.roomBarrierHighMm ?? 600) / mmPerPx;
  const wideLow = new Uint8Array(total);
  const wideHigh = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (!freeMask[i]) continue;
    if (distPx[i] >= roomBarrierPx) wideLow[i] = 1;
    if (distPx[i] >= roomBarrierHighPx) wideHigh[i] = 1;
  }
  const comps = labelComponents(wideLow, width, height);
  const compsHigh = labelComponents(wideHigh, width, height);
  const minAreaPx = (minAreaM2 * 1e6) / (mmPerPx * mmPerPx);
  const minHighAreaPx = (3.0 * 1e6) / (mmPerPx * mmPerPx);
  const order = Array.from({ length: comps.count }, (_, i) => i)
    .filter((i) => comps.sizes[i] >= minAreaPx)
    .sort((a, b) => comps.sizes[b] - comps.sizes[a]);
  const labelOf = new Map<number, number>();
  order.forEach((ci, idx) => labelOf.set(ci + 1, idx + 1));

  const roomCores = new Int32Array(total);
  for (let p = 0; p < total; p++) {
    if (wideLow[p] === 1) {
      const l = labelOf.get(comps.labels[p]);
      if (l) roomCores[p] = l;
    }
  }

  // ── 7. 回填：室内自由像素多源 BFS 分配给最近房间核 ──
  const filledLabels = multiSourceBfs(freeMask, roomCores, width, height);

  // ── 8. 层级拆分：含 ≥2 个高门槛核的房间按高门槛核再分 ──
  const roomLabels = filledLabels;
  const highVote = new Map<number, Map<number, number>>();
  for (let p = 0; p < total; p++) {
    const hc = compsHigh.labels[p];
    if (hc === 0) continue;
    const rl = roomLabels[p];
    if (rl <= 0) continue;
    let m = highVote.get(hc);
    if (!m) { m = new Map(); highVote.set(hc, m); }
    m.set(rl, (m.get(rl) ?? 0) + 1);
  }
  const highOfRoom = new Map<number, { comp: number; size: number }[]>();
  for (const [hc, votes] of highVote) {
    const ci = hc - 1;
    if (compsHigh.sizes[ci] < minHighAreaPx) continue;
    let owner = 0;
    let best = 0;
    for (const [rl, cnt] of votes) {
      if (cnt > best) { best = cnt; owner = rl; }
    }
    if (owner <= 0 || best < compsHigh.sizes[ci] * 0.6) continue;
    const arr = highOfRoom.get(owner) ?? [];
    arr.push({ comp: ci, size: compsHigh.sizes[ci] });
    highOfRoom.set(owner, arr);
  }

  let nextLabel = order.length;
  const splitSeeds: { seedLabel: number; comp: number }[] = [];
  const splits: { room: number; parts: number }[] = [];
  const splitRooms = new Set<number>();
  for (const [room, highs] of highOfRoom) {
    if (highs.length < 2) continue;
    splits.push({ room, parts: highs.length });
    splitRooms.add(room);
    for (const h of highs) {
      nextLabel++;
      splitSeeds.push({ seedLabel: nextLabel, comp: h.comp });
    }
  }
  if (splitSeeds.length > 0) {
    const seedMask = new Int32Array(total);
    for (const s of splitSeeds) {
      for (let p = 0; p < total; p++) {
        if (compsHigh.labels[p] === s.comp + 1) seedMask[p] = s.seedLabel;
      }
    }
    const queue: number[] = [];
    for (let p = 0; p < total; p++) {
      if (seedMask[p] > 0) {
        roomLabels[p] = seedMask[p];
        queue.push(p);
      } else if (splitRooms.has(roomLabels[p])) {
        roomLabels[p] = -1;
      }
    }
    let head = 0;
    while (head < queue.length) {
      const i = queue[head++];
      const x = i % width;
      const y = (i - x) / width;
      const l = roomLabels[i];
      const trySet = (nx: number, ny: number) => {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
        const ni = ny * width + nx;
        if (roomLabels[ni] !== -1) return;
        roomLabels[ni] = l;
        queue.push(ni);
      };
      trySet(x + 1, y);
      trySet(x - 1, y);
      trySet(x, y + 1);
      trySet(x, y - 1);
    }
    for (let p = 0; p < total; p++) if (roomLabels[p] === -1) roomLabels[p] = 0;
  }

  // ── 9. 标签重排 + 统计 ──
  const present = new Set<number>();
  for (let p = 0; p < total; p++) if (roomLabels[p] > 0) present.add(roomLabels[p]);
  const finalOrder = Array.from(present).sort((a, b) => a - b);
  const finalRemap = new Int32Array(nextLabel + 1);
  finalOrder.forEach((l, i) => { finalRemap[l] = i + 1; });
  for (let p = 0; p < total; p++) roomLabels[p] = roomLabels[p] > 0 ? finalRemap[roomLabels[p]] : 0;

  const K = finalOrder.length;
  const finalSizes = new Int32Array(K + 1);
  const finalBox = new Int32Array((K + 1) * 4);
  const cxSum = new Float64Array(K + 1);
  const cySum = new Float64Array(K + 1);
  const finalMaxDist = new Float32Array(K + 1);
  for (let i = 1; i <= K; i++) {
    finalBox[i * 4] = Number.MAX_SAFE_INTEGER;
    finalBox[i * 4 + 1] = Number.MAX_SAFE_INTEGER;
    finalBox[i * 4 + 2] = -1;
    finalBox[i * 4 + 3] = -1;
  }
  for (let p = 0; p < total; p++) {
    const l = roomLabels[p];
    if (l === 0) continue;
    finalSizes[l]++;
    const x = p % width;
    const y = (p - x) / width;
    cxSum[l] += x;
    cySum[l] += y;
    if (distPx[p] > finalMaxDist[l]) finalMaxDist[l] = distPx[p];
    const b = l * 4;
    if (x < finalBox[b]) finalBox[b] = x;
    if (y < finalBox[b + 1]) finalBox[b + 1] = y;
    if (x > finalBox[b + 2]) finalBox[b + 2] = x;
    if (y > finalBox[b + 3]) finalBox[b + 3] = y;
  }
  const rooms: RoomRegion[] = [];
  for (let l = 1; l <= K; l++) {
    if (finalSizes[l] < minAreaPx * 0.5) continue;
    rooms.push({
      label: l,
      sizePx: finalSizes[l],
      box: [finalBox[l * 4], finalBox[l * 4 + 1], finalBox[l * 4 + 2], finalBox[l * 4 + 3]],
      centroid: finalSizes[l] > 0 ? [cxSum[l] / finalSizes[l], cySum[l] / finalSizes[l]] : [0, 0],
      maxDistPx: finalMaxDist[l],
    });
  }

  return { roomLabels, rooms, wallBase, distPx, insideMask, region, droppedComponents, splits };
}

/**
 * 盒式腐蚀：out = erode(¬mask, r) = ¬dilate(mask, r)。
 * 即「到 mask 区域距离 ≥ r」的像素。用于从 ¬outside 中剥掉建筑外围吸附带。
 */
function erodeBoxInPlace(
  mask: Uint8Array,
  width: number,
  height: number,
  r: number,
): Uint8Array {
  const dil = dilateBox(mask, width, height, r);
  const out = new Uint8Array(width * height);
  for (let i = 0; i < out.length; i++) out[i] = dil[i] ? 0 : 1;
  return out;
}

/** 快速盒式膨胀（可分离两趟），用于大半径密封 */
function dilateBox(mask: Uint8Array, width: number, height: number, r: number): Uint8Array {  const tmp = new Uint8Array(width * height);
  // 横向
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let count = 0;
    for (let x = 0; x <= Math.min(r, width - 1); x++) count += mask[row + x];
    for (let x = 0; x < width; x++) {
      if (count > 0) tmp[row + x] = 1;
      const add = x + r + 1;
      const sub = x - r;
      if (add < width) count += mask[row + add];
      if (sub >= 0) count -= mask[row + sub];
    }
  }
  // 纵向
  const out = new Uint8Array(width * height);
  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let y = 0; y <= Math.min(r, height - 1); y++) count += tmp[y * width + x];
    for (let y = 0; y < height; y++) {
      if (count > 0) out[y * width + x] = 1;
      const add = y + r + 1;
      const sub = y - r;
      if (add < height) count += tmp[add * width + x];
      if (sub >= 0) count -= tmp[sub * width + x];
    }
  }
  return out;
}

/** 从图像边界泛洪标记室外。obstacle=1 为障碍 */
function floodOutside(obstacle: Uint8Array, width: number, height: number): Uint8Array {
  const total = width * height;
  const outside = new Uint8Array(total);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (obstacle[i] || outside[i]) return;
    outside[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y); }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % width;
    const y = (i - x) / width;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  return outside;
}

/** Chamfer 两遍距离变换：像素到最近墙的距离（px）。区域外视为墙。 */
export function distanceTransform(
  wall: Uint8Array,
  region: Uint8Array,
  width: number,
  height: number,
): Float32Array {
  const INF = 1e9;
  const d = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    d[i] = wall[i] || !region[i] ? 0 : INF;
  }
  const D1 = 1;
  const D2 = Math.SQRT2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (d[i] === 0) continue;
      let m = d[i];
      if (x > 0) m = Math.min(m, d[i - 1] + D1);
      if (y > 0) m = Math.min(m, d[i - width] + D1);
      if (x > 0 && y > 0) m = Math.min(m, d[i - width - 1] + D2);
      if (x < width - 1 && y > 0) m = Math.min(m, d[i - width + 1] + D2);
      d[i] = m;
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (d[i] === 0) continue;
      let m = d[i];
      if (x < width - 1) m = Math.min(m, d[i + 1] + D1);
      if (y < height - 1) m = Math.min(m, d[i + width] + D1);
      if (x < width - 1 && y < height - 1) m = Math.min(m, d[i + width + 1] + D2);
      if (x > 0 && y < height - 1) m = Math.min(m, d[i + width - 1] + D2);
      d[i] = m;
    }
  }
  return d;
}

/** 多源 BFS：把每个自由像素分配给最近的房间核 */
function multiSourceBfs(
  freeMask: Uint8Array,
  roomCores: Int32Array,
  width: number,
  height: number,
): Int32Array {
  const labels = new Int32Array(width * height);
  const queue: number[] = [];
  let head = 0;
  for (let p = 0; p < width * height; p++) {
    if (roomCores[p] > 0 && freeMask[p]) {
      labels[p] = roomCores[p];
      queue.push(p);
    }
  }
  while (head < queue.length) {
    const i = queue[head++];
    const x = i % width;
    const y = (i - x) / width;
    const l = labels[i];
    const trySet = (nx: number, ny: number) => {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
      const ni = ny * width + nx;
      if (!freeMask[ni] || labels[ni] !== 0) return;
      labels[ni] = l;
      queue.push(ni);
    };
    trySet(x + 1, y);
    trySet(x - 1, y);
    trySet(x, y + 1);
    trySet(x, y - 1);
  }
  return labels;
}
