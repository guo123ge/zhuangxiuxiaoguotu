/**
 * 户型解析编排：像素 → 结构化户型 JSON。
 *
 * 流程：
 *   1. 预处理（加载/测量）
 *   2. 颜色分层 + 尺寸链检测 + 比例仲裁
 *   3. 房间分割（距离场 + 层级拆分 + 外部口袋剔除）
 *   4. 房间轮廓矢量化（Pav…边界有向边图 + DP 简化）
 *   5. 门洞检测：房间标签的 4-邻接接触段 = 无墙开口（BFS 只经自由像素
 *      生长，故两个房间的直接接触只可能发生在门洞/连通口）
 *   6. 窗检测：蓝色玻璃线连通块 → 外窗开口（默认窗台 900 / 窗顶 2100）
 *   7. 规则初分类（面积/位置/米色寝具/绿色植栽），全部标记待确认
 *   8. 组装 FloorplanJson（毫米单位、图纸左上原点、x 右 y 下）
 */
import { loadAndMeasure, type RgbImage } from "../cv/preprocess.ts";
import { buildColorMasks, close, open, dilate } from "../cv/colorLayer.ts";
import { detectChains, moduleSearch, arbitrateScale, type ScaleCandidate } from "../cv/scale.ts";
import { segmentRooms } from "../cv/rooms.ts";
import { labelComponents } from "../cv/components.ts";
import { extractRoomPolygons, polygonArea, type Polygon } from "../geom/contour.ts";
import { vectorizeMask, assignHoles } from "../geom/walls.ts";

export type RoomJson = {
  id: string;
  name: string;
  type: string; // living/bedroom/master/kitchen/bath/balcony/corridor/unknown
  areaM2: number;
  /** 多边形轮廓，毫米，图纸坐标系（x 右 y 下） */
  polygonMm: [number, number][];
  centroidMm: [number, number];
  maxClearMm: number;
  confidence: number;
  needsConfirm: boolean;
};

export type OpeningJson = {
  id: string;
  kind: "door" | "open" | "window" | "entrance";
  /** 开口中心（毫米） */
  centerMm: [number, number];
  /** 开口宽度（毫米） */
  widthMm: number;
  /** 开口方向（弧度，沿墙走向） */
  angleRad: number;
  /** 两侧房间 id（window 时 in 为房间，out 为 null） */
  roomA: string | null;
  roomB: string | null;
};

export type WallLoopJson = {
  outer: [number, number][];
  holes: [number, number][][];
};

export type FloorplanJson = {
  version: 1;
  imageWidth: number;
  imageHeight: number;
  mmPerPx: number;
  scaleSource: string;
  scaleConfidence: number;
  buildingBoxMm: [number, number, number, number];
  rooms: RoomJson[];
  openings: OpeningJson[];
  wallLoops: WallLoopJson[]; // 毫米
  issues: string[];
  classifiedBy: "rules" | "vlm" | "manual";
};

function pxPolyToMm(poly: Polygon, mmPerPx: number): [number, number][] {
  return poly.map(([x, y]) => [x * mmPerPx, y * mmPerPx]);
}

/**
 * 由可靠的房间分割结果推导墙体掩膜（替代脆弱的「深色墨迹」掩膜）。
 *
 * 做法：以房间并集为种子，向外包半墙厚得到建筑外壳，再用外壳减去房间内部
 * 得到连续的「墙环」。每个房间因此自带一圈墙，相邻房间之间的墙（两环在
 * 间隙处重叠）自然保留为室内隔墙；外扩会桥接门口缺口，使墙片连续成片。
 *
 * 这样墙体必然：① 包围全部房间（与房间地面不再分离）；② 连续成片（不再
 * 被切成一堆零散漂浮的小墙板）。
 *
 * 原因：原方案直接对 masks.dark（含墙体、尺寸线、文字、家具轮廓等所有
 * 深色墨迹）做开/闭运算，带横向纹理的墙带与细线被切碎，且文字家具被误判
 * 为墙，最终 vectorize 出数十个互不相干的碎环。
 */
function buildWallMaskFromRooms(
  roomLabels: Int32Array,
  width: number,
  height: number,
  region: { x0: number; y0: number; x1: number; y1: number },
  padPx: number,
): Uint8Array {
  const total = width * height;
  const roomMask = new Uint8Array(total);
  for (let i = 0; i < total; i++) if (roomLabels[i] !== 0) roomMask[i] = 1;
  // 两遍膨胀（≈ 半径 padPx 的圆盘），桥接门口并保证外墙连续
  const half = Math.max(1, Math.ceil(padPx / 2));
  let envelope = dilate(roomMask, width, height, half);
  envelope = dilate(envelope, width, height, half);
  const wall = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (envelope[i] && !roomMask[i]) wall[i] = 1;
  }
  // 裁剪到建筑区域
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < region.x0 || x > region.x1 || y < region.y0 || y > region.y1) wall[y * width + x] = 0;
    }
  }
  return wall;
}

/** 规则初分类：全部低置信、待确认；VLM 可用时会被覆盖 */
function classifyRoom(
  areaM2: number,
  beigeRatio: number,
  greenRatio: number,
  isLargest: boolean,
  touchesExterior: boolean,
): { type: string; name: string } {
  // 最大连通空间必是客餐厅（开放厨房/走廊并入是预期行为）
  if (isLargest) return { type: "living", name: "客餐厅" };
  // 阳台：绿植 + 贴外墙 + 面积不大（大空间带绿化是客厅的景观特征）
  if (greenRatio > 0.01 && touchesExterior && areaM2 < 30) return { type: "balcony", name: "阳台" };
  if (areaM2 < 5.5) return { type: "bath", name: "卫生间/储藏" };
  if (beigeRatio > 0.04) return { type: "bedroom", name: "卧室" };
  if (areaM2 < 9) return { type: "unknown", name: "小房间" };
  return { type: "bedroom", name: "卧室?" };
}

export async function parseFloorplan(
  bytes: Buffer,
  opts: { mmPerPxOverride?: number } = {},
): Promise<{ json: FloorplanJson; image: RgbImage }> {
  const issues: string[] = [];
  const { image } = await loadAndMeasure(bytes);
  const { width, height } = image;
  const masks = buildColorMasks(image);
  const chains = detectChains(masks);

  // ── 比例标定 ──
  let scale: ScaleCandidate | null = null;
  if (opts.mmPerPxOverride) {
    scale = {
      mmPerPx: opts.mmPerPxOverride,
      source: "MANUAL",
      confidence: 1,
      note: "人工标定",
    };
  } else {
    scale = arbitrateScale([moduleSearch(chains, masks)].filter(Boolean) as ScaleCandidate[]);
  }
  if (!scale) {
    // 无尺寸链可读：给一个保守默认并显著标记
    scale = { mmPerPx: 17, source: "MODULE_SEARCH", confidence: 0.1, note: "无尺寸链，默认 17mm/px" };
    issues.push("未检测到尺寸链，比例为默认值，必须人工标定");
  }
  if (chains.hClosureError > 0.03 || chains.vClosureError > 0.03) {
    issues.push(`尺寸链闭合误差偏大（横 ${(chains.hClosureError * 100).toFixed(1)}% / 纵 ${(chains.vClosureError * 100).toFixed(1)}%），比例需人工复核`);
  }
  const mm = scale.mmPerPx;

  // ── 房间分割 ──
  const seg = segmentRooms(masks, mm, { chains });

  // ── 房间轮廓 ──
  const polys = extractRoomPolygons(
    seg.roomLabels, width, height,
    seg.rooms.map((r) => r.label),
    2.5,
  );

  // ── 掩膜分区统计（米色=寝具/地毯，绿色=植栽）──
  const roomStats = seg.rooms.map((r) => {
    let beige = 0, green = 0, total = 0;
    for (let y = r.box[1]; y <= r.box[3]; y++) {
      for (let x = r.box[0]; x <= r.box[2]; x++) {
        const i = y * width + x;
        if (seg.roomLabels[i] !== r.label) continue;
        total++;
        if (masks.beige[i]) beige++;
        if (masks.green[i]) green++;
      }
    }
    return { label: r.label, beigeRatio: total ? beige / total : 0, greenRatio: total ? green / total : 0 };
  });

  const maxArea = Math.max(...seg.rooms.map((r) => r.sizePx));
  const rooms: RoomJson[] = [];
  const labelToId = new Map<number, string>();
  seg.rooms.forEach((r, idx) => {
    const poly = polys.get(r.label);
    if (!poly) return;
    const areaM2 = Math.abs(polygonArea(poly)) * mm * mm / 1e6;
    const st = roomStats.find((s) => s.label === r.label)!;
    const touchesExterior =
      r.box[0] <= seg.region.x0 + 2 || r.box[2] >= seg.region.x1 - 2 ||
      r.box[1] <= seg.region.y0 + 2 || r.box[3] >= seg.region.y1 - 2;
    const cls = classifyRoom(
      areaM2, st.beigeRatio, st.greenRatio,
      r.sizePx === maxArea, touchesExterior,
    );
    const id = `room-${idx + 1}`;
    labelToId.set(r.label, id);
    rooms.push({
      id,
      name: cls.name,
      type: cls.type,
      areaM2: Number(areaM2.toFixed(2)),
      polygonMm: pxPolyToMm(poly, mm),
      centroidMm: [r.centroid[0] * mm, r.centroid[1] * mm],
      maxClearMm: Math.round(r.maxDistPx * mm),
      confidence: 0.4,
      needsConfirm: true,
    });
  });

  // ── 门洞：房间标签的 4-邻接接触段 ──
  // 接触对收集：(minLabel, maxLabel) -> 接触像素列表
  const contacts = new Map<string, number[]>();
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const a = seg.roomLabels[y * width + x];
      if (a === 0) continue;
      const right = seg.roomLabels[y * width + x + 1];
      const down = seg.roomLabels[(y + 1) * width + x];
      for (const b of [right, down]) {
        if (b === 0 || b === a) continue;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        let arr = contacts.get(key);
        if (!arr) { arr = []; contacts.set(key, arr); }
        arr.push(y * width + x);
      }
    }
  }

  const openings: OpeningJson[] = [];
  let doorIdx = 0;
  for (const [key, pixels] of contacts) {
    const [la, lb] = key.split("|").map(Number);
    // 接触像素聚成连续段（简单起见：用接触点云的主轴投影长度作为开口宽度）
    const xs = pixels.map((p) => p % width);
    const ys = pixels.map((p) => Math.floor(p / width));
    const cx = xs.reduce((s, v) => s + v, 0) / xs.length;
    const cy = ys.reduce((s, v) => s + v, 0) / ys.length;
    // 主方向：x 跨度大 → 横向开口
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    const span = Math.max(spanX, spanY);
    const widthMm = Math.max(span * mm, 600); // 至少按 600mm 门宽
    // 开口宽度取距离场鞍部的 2 倍（更准）
    let maxDist = 0;
    for (const p of pixels) if (seg.distPx[p] > maxDist) maxDist = seg.distPx[p];
    const saddleWidthMm = Math.min(Math.max(maxDist * 2 * mm, 600), 3000);
    const kind = saddleWidthMm > 1500 ? "open" : "door";
    openings.push({
      id: `door-${++doorIdx}`,
      kind,
      centerMm: [cx * mm, cy * mm],
      widthMm: Math.round(Math.max(widthMm, saddleWidthMm)),
      angleRad: spanX >= spanY ? 0 : Math.PI / 2,
      roomA: labelToId.get(la) ?? null,
      roomB: labelToId.get(lb) ?? null,
    });
  }

  // ── 窗：蓝色玻璃连通块 ──
  const glassComps = labelComponents(masks.blue, width, height);
  let winIdx = 0;
  for (let i = 0; i < glassComps.count; i++) {
    if (glassComps.sizes[i] < 40) continue; // 滤噪
    const x0 = glassComps.boxes[i * 4];
    const y0 = glassComps.boxes[i * 4 + 1];
    const x1 = glassComps.boxes[i * 4 + 2];
    const y1 = glassComps.boxes[i * 4 + 3];
    const wMm = (x1 - x0) * mm;
    const hMm = (y1 - y0) * mm;
    const widthMm = Math.max(wMm, hMm);
    if (widthMm < 400) continue; // 太小的不是窗
    // 归属房间：离组件中心最近的房间
    const cx = ((x0 + x1) / 2) * mm;
    const cy = ((y0 + y1) / 2) * mm;
    let bestRoom: string | null = null;
    let bestD = Number.MAX_VALUE;
    for (const r of rooms) {
      const d = Math.hypot(r.centroidMm[0] - cx, r.centroidMm[1] - cy);
      if (d < bestD) { bestD = d; bestRoom = r.id; }
    }
    openings.push({
      id: `win-${++winIdx}`,
      kind: "window",
      centerMm: [cx, cy],
      widthMm: Math.round(widthMm),
      angleRad: wMm >= hMm ? 0 : Math.PI / 2,
      roomA: bestRoom,
      roomB: null,
    });
  }

  // ── 墙体矢量化（优先由可靠的房间分割推导，保证连续且包围房间）──
  // 墙厚按 240mm 估算；若尚未识别到房间，则回退到深色墨迹掩膜。
  const wallThicknessMm = 240;
  const padPx = Math.max(4, Math.round(wallThicknessMm / 2 / mm));
  let wallMaskForVec: Uint8Array;
  if (rooms.length > 0) {
    wallMaskForVec = buildWallMaskFromRooms(seg.roomLabels, width, height, seg.region, padPx);
  } else {
    wallMaskForVec = close(open(masks.dark, width, height, 2), width, height, 2);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (x < seg.region.x0 || x > seg.region.x1 || y < seg.region.y0 || y > seg.region.y1) {
          wallMaskForVec[y * width + x] = 0;
        }
      }
    }
  }
  const loops = vectorizeMask(wallMaskForVec, width, height, 2);
  let wallLoops: WallLoopJson[] = assignHoles(loops).map((l) => ({
    outer: pxPolyToMm(l.outer, mm),
    holes: l.holes.map((h) => pxPolyToMm(h, mm)),
  }));
  // 安全过滤：丢弃过小的碎环（理论上已无文字/家具噪声，再加一道保险）
  const loopAreaMm2 = (p: [number, number][]) => Math.abs(polygonArea(p)) * mm * mm;
  const maxLoopArea = Math.max(0, ...wallLoops.map((l) => loopAreaMm2(l.outer)));
  if (maxLoopArea > 0) {
    const minArea = Math.max(0.4, maxLoopArea * 0.02);
    wallLoops = wallLoops.filter((l) => loopAreaMm2(l.outer) >= minArea);
  }

  const json: FloorplanJson = {
    version: 1,
    imageWidth: width,
    imageHeight: height,
    mmPerPx: Number(mm.toFixed(4)),
    scaleSource: scale.source,
    scaleConfidence: scale.confidence,
    buildingBoxMm: [
      seg.region.x0 * mm, seg.region.y0 * mm,
      seg.region.x1 * mm, seg.region.y1 * mm,
    ],
    rooms,
    openings,
    wallLoops,
    issues,
    classifiedBy: "rules",
  };
  return { json, image };
}
