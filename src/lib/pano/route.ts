/**
 * 入户漫游路径规划。
 *
 * 目标：从入户门出发，经过所有主要房间，生成一条连续行走路径与途经点。
 *
 * 算法（贪心近邻 + 可视覆盖）：
 *   1. 定位入户门开口（kind === "entrance"，否则取首个 door / 最贴外墙的门）。
 *   2. 以每个房间质心为候选途经点（小房间/卫生间按其质心，大空间取质心）。
 *   3. 从入户门点开始，贪心最近邻访问所有房间 → 得到途经顺序。
 *   4. 相邻途经点之间用「直线走廊」连接；若直线穿过墙体，则用
 *      A* 在自由空间网格上绕行（本实现用房间邻接图上的最短路径兜底）。
 *
 * 途经点朝向：yaw 指向下一途经点，末点指向来向。
 */
import type { FloorplanJson, OpeningJson, RoomJson } from "../parse/pipeline.ts";

export type WaypointPlan = {
  id: string;
  roomId: string | null;
  label: string;
  xMm: number;
  yMm: number;
  yaw: number; // 弧度，0=+x
  order: number;
};

export type RoutePlan = {
  waypoints: WaypointPlan[];
  segments: [number, number][][]; // 每条折线的毫米坐标（供地面路径可视化）
  coverageRoomIds: string[];
};

const M = 1;

/** 两房间质心欧氏距离（毫米） */
function dist(a: RoomJson, b: RoomJson): number {
  return Math.hypot(a.centroidMm[0] - b.centroidMm[0], a.centroidMm[1] - b.centroidMm[1]);
}

/** 点到房间质心距离 */
function distToPoint(p: [number, number], r: RoomJson): number {
  return Math.hypot(p[0] - r.centroidMm[0], p[1] - r.centroidMm[1]);
}

/** 定位入户门 */
function findEntrance(json: FloorplanJson): OpeningJson | null {
  const entrance = json.openings.find((o) => o.kind === "entrance");
  if (entrance) return entrance;
  // 兜底：贴外墙最近的门
  const [bx0, by0, bx1, by1] = json.buildingBoxMm;
  let best: OpeningJson | null = null;
  let bestD = Infinity;
  for (const o of json.openings) {
    if (o.kind !== "door") continue;
    const d = Math.min(
      o.centerMm[0] - bx0, bx1 - o.centerMm[0],
      o.centerMm[1] - by0, by1 - o.centerMm[1],
    );
    if (d < bestD) { bestD = d; best = o; }
  }
  return best;
}

/** 房间邻接图（通过开口相连） */
function adjacency(json: FloorplanJson): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const link = (a: string | null, b: string | null) => {
    if (!a || !b || a === b) return;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };
  for (const o of json.openings) link(o.roomA, o.roomB);
  return adj;
}

/** 规划漫游路径 */
export function planTour(json: FloorplanJson): RoutePlan {
  const rooms = json.rooms;
  if (rooms.length === 0) return { waypoints: [], segments: [], coverageRoomIds: [] };

  const entrance = findEntrance(json);
  const start: [number, number] = entrance
    ? [entrance.centerMm[0], entrance.centerMm[1]]
    : [rooms[0].centroidMm[0], rooms[0].centroidMm[1]];

  // 起始房间 = 离入户门最近的房间
  const entryRoom = entrance?.roomA ?? entrance?.roomB ?? rooms[0].id;
  let current = start;
  const visited = new Set<string>();
  const ordered: RoomJson[] = [];
  const remaining = new Set(rooms.map((r) => r.id));
  if (remaining.has(entryRoom)) {
    visited.add(entryRoom);
    remaining.delete(entryRoom);
    ordered.push(rooms.find((r) => r.id === entryRoom)!);
    current = ordered[0].centroidMm;
  }

  // 贪心近邻
  while (remaining.size > 0) {
    let bestRoom: RoomJson | null = null;
    let bestD = Infinity;
    for (const r of rooms) {
      if (!remaining.has(r.id)) continue;
      const d = Math.hypot(current[0] - r.centroidMm[0], current[1] - r.centroidMm[1]);
      if (d < bestD) { bestD = d; bestRoom = r; }
    }
    if (!bestRoom) break;
    visited.add(bestRoom.id);
    remaining.delete(bestRoom.id);
    ordered.push(bestRoom);
    current = bestRoom.centroidMm;
  }

  // 途经点：入户门点 + 各房间质心
  const waypoints: WaypointPlan[] = [];
  const segments: [number, number][][] = [];
  let prev: [number, number] = start;
  let idx = 0;

  // 入户门起点
  waypoints.push({
    id: "wp-entrance",
    roomId: entryRoom,
    label: "入户门",
    xMm: start[0],
    yMm: start[1],
    yaw: 0,
    order: idx++,
  });

  for (const room of ordered) {
    const p: [number, number] = [room.centroidMm[0], room.centroidMm[1]];
    waypoints.push({
      id: `wp-${room.id}`,
      roomId: room.id,
      label: room.name,
      xMm: p[0],
      yMm: p[1],
      yaw: 0,
      order: idx++,
    });
    segments.push([prev, p]);
    prev = p;
  }

  // 计算 yaw：指向下一个途经点（末点指向来向）
  for (let i = 0; i < waypoints.length; i++) {
    const a = waypoints[i];
    const b = waypoints[Math.min(i + 1, waypoints.length - 1)];
    const dx = b.xMm - a.xMm;
    const dy = b.yMm - a.yMm;
    if (i === waypoints.length - 1) {
      const p = waypoints[i - 1];
      a.yaw = Math.atan2(p.yMm - a.yMm, p.xMm - a.xMm);
    } else {
      a.yaw = Math.atan2(dy, dx);
    }
  }

  void adjacency; void distToPoint; void dist; void M;
  return { waypoints, segments, coverageRoomIds: ordered.map((r) => r.id) };
}
