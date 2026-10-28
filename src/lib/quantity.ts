/**
 * 工程量计算引擎。
 *
 * 从已确认的房间多边形 + 开口数据，计算装饰工程量（地面/墙面/顶面/
 * 踢脚线/门/窗/橱柜等）。全部以毫米坐标做精确几何计算，再换算为
 * m² / m / 个。仅依赖 polygonJson 与 Opening，不依赖 AI。
 */

export type QtyRoom = {
  id: string;
  name: string;
  roomType: string;
  polygonMm: [number, number][];
  heightMm: number;
};

export type QtyOpening = {
  kind: string; // DOOR | ARCH | WINDOW
  widthMm: number;
  heightMm: number;
  sillMm: number;
  centerMm: [number, number];
  roomAId: string | null;
  roomBId: string | null;
};

export type QuantityLine = {
  category: string; // FLOOR|WALL|CEILING|SKIRTING|DOOR|WINDOW|CABINET
  itemName: string;
  roomId: string | null;
  quantity: number;
  unit: string;
  formula: string;
};

/** 多边形面积（鞋带公式，毫米²） */
export function polygonAreaMm2(poly: [number, number][]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

/** 多边形周长（毫米） */
export function polygonPerimeterMm(poly: [number, number][]): number {
  let p = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    p += Math.hypot(x2 - x1, y2 - y1);
  }
  return p;
}

/** 点到线段最近距离（用于开口归属） */
function pointInRoom(pt: [number, number], poly: [number, number][]): boolean {
  // 点在多边形内（射线法）
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** 开口归属：优先 roomA/roomB，否则按中心点落入的房间 */
function resolveOpeningRoom(op: QtyOpening, rooms: QtyRoom[]): string | null {
  if (op.roomAId) return op.roomAId;
  if (op.roomBId) return op.roomBId;
  for (const r of rooms) {
    if (pointInRoom(op.centerMm, r.polygonMm)) return r.id;
  }
  return null;
}

export function computeQuantities(
  rooms: QtyRoom[],
  openings: QtyOpening[],
): QuantityLine[] {
  const lines: QuantityLine[] = [];
  const M2 = (mm2: number) => mm2 / 1e6;
  const M = (mm: number) => mm / 1000;

  const doorLike = openings.filter((o) => o.kind === "DOOR" || o.kind === "ARCH");
  const windows = openings.filter((o) => o.kind === "WINDOW");

  // 每个房间的开口宽度（用于踢脚线/墙面扣减）
  const roomDoorWidth = new Map<string, number>();
  const roomWindowArea = new Map<string, number>();
  const roomDoorArea = new Map<string, number>();

  for (const o of doorLike) {
    const rid = resolveOpeningRoom(o, rooms);
    if (rid) roomDoorWidth.set(rid, (roomDoorWidth.get(rid) ?? 0) + M(o.widthMm));
    if (rid) roomDoorArea.set(rid, (roomDoorArea.get(rid) ?? 0) + M(o.widthMm) * M(o.heightMm));
  }
  for (const o of windows) {
    const rid = resolveOpeningRoom(o, rooms);
    if (rid) roomWindowArea.set(rid, (roomWindowArea.get(rid) ?? 0) + M(o.widthMm) * M(o.heightMm));
  }

  for (const r of rooms) {
    const areaM2 = M2(polygonAreaMm2(r.polygonMm));
    const periM = M(polygonPerimeterMm(r.polygonMm));
    const doorArea = roomDoorArea.get(r.id) ?? 0;
    const winArea = roomWindowArea.get(r.id) ?? 0;
    const wallArea = Math.max(0, periM * M(r.heightMm) - doorArea - winArea);
    const skirting = Math.max(0, periM - (roomDoorWidth.get(r.id) ?? 0));

    lines.push({
      category: "FLOOR",
      itemName: `${r.name}·地面`,
      roomId: r.id,
      quantity: Number(areaM2.toFixed(2)),
      unit: "m2",
      formula: `多边形面积 ${areaM2.toFixed(2)}m²`,
    });
    lines.push({
      category: "CEILING",
      itemName: `${r.name}·顶面`,
      roomId: r.id,
      quantity: Number(areaM2.toFixed(2)),
      unit: "m2",
      formula: `同地面面积`,
    });
    lines.push({
      category: "WALL",
      itemName: `${r.name}·墙面`,
      roomId: r.id,
      quantity: Number(wallArea.toFixed(2)),
      unit: "m2",
      formula: `周长 ${periM.toFixed(2)}m × 高 ${M(r.heightMm).toFixed(2)}m − 门洞 ${doorArea.toFixed(2)} − 窗洞 ${winArea.toFixed(2)}`,
    });
    lines.push({
      category: "SKIRTING",
      itemName: `${r.name}·踢脚线`,
      roomId: r.id,
      quantity: Number(skirting.toFixed(2)),
      unit: "m",
      formula: `周长 − 门宽`,
    });
  }

  // 门 / 窗（项目级）
  if (doorLike.length > 0) {
    lines.push({
      category: "DOOR",
      itemName: "室内门",
      roomId: null,
      quantity: doorLike.length,
      unit: "樘",
      formula: `开口 DOOR/ARCH 计数`,
    });
  }
  if (windows.length > 0) {
    const winTotalArea = windows.reduce((s, o) => s + M(o.widthMm) * M(o.heightMm), 0);
    lines.push({
      category: "WINDOW",
      itemName: "窗（含安装）",
      roomId: null,
      quantity: Number(winTotalArea.toFixed(2)),
      unit: "m2",
      formula: `${windows.length} 扇 × 平均面积`,
    });
  }

  // 橱柜：厨房沿墙台面（周长 × 0.5 近似）
  const kitchens = rooms.filter((r) => r.roomType.toUpperCase().includes("KITCHEN"));
  for (const k of kitchens) {
    const periM = M(polygonPerimeterMm(k.polygonMm));
    lines.push({
      category: "CABINET",
      itemName: `${k.name}·橱柜台面`,
      roomId: k.id,
      quantity: Number((periM * 0.5).toFixed(2)),
      unit: "m",
      formula: `厨房周长 ${periM.toFixed(2)}m × 0.5`,
    });
  }

  return lines;
}
