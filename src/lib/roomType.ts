/**
 * 房间类型归一化（消费层适配，零依赖、纯函数）。
 *
 * 背景：RoomJson.type 有两个生产者但值域不同——
 *   - 本地 CV 管线输出小写词：living / bedroom / bath / balcony / unknown …
 *   - VLM 路径输出大写枚举：LIVING_DINING / MASTER_BED / …
 * 而三个消费者各用一套：builder 的家具 switch 用小写、styles 的材质/颜色
 * 规则用大写、编辑器下拉用大写，导致「CV 路径材质规则落空、VLM 路径
 * 家具消失、编辑器下拉空白」。
 *
 * 本模块只在「读取/匹配/展示」时归一化，绝不写回 parseJson 或数据库：
 * API 契约、FloorplanJson 形状、DB 落库值域全部保持原样。
 */
import { ROOM_TYPE, ROOM_TYPE_LABEL, type RoomType } from "./enums.ts";

const VALID = new Set<string>(Object.values(ROOM_TYPE));

const CV_ALIASES: Record<string, RoomType> = {
  living: "LIVING_DINING",
  livingroom: "LIVING_DINING",
  living_room: "LIVING_DINING",
  living_dining: "LIVING_DINING",
  dining: "DINING",
  bedroom: "BED",
  bed: "BED",
  bed_room: "BED",
  master: "MASTER_BED",
  master_bed: "MASTER_BED",
  masterbed: "MASTER_BED",
  master_bedroom: "MASTER_BED",
  child_bed: "CHILD_BED",
  children_bed: "CHILD_BED",
  elder_bed: "ELDER_BED",
  kitchen: "KITCHEN",
  bath: "BATH",
  bathroom: "BATH",
  toilet: "BATH",
  balcony: "BALCONY",
  corridor: "HALLWAY",
  hallway: "HALLWAY",
  entry: "ENTRY",
  entrance: "ENTRY",
  study: "STUDY",
  cloak: "CLOAK",
  storage: "STORAGE",
  multi: "MULTI",
  unknown: "OTHER",
  other: "OTHER",
};

/** 任意来源的房间类型 → 大写枚举；未识别值兜底 OTHER。 */
export function canonicalRoomType(raw: string | null | undefined): RoomType {
  if (!raw) return "OTHER";
  const upper = raw.toUpperCase();
  if (VALID.has(upper)) return upper as RoomType;
  const key = raw.toLowerCase().replace(/[\s-]+/g, "_");
  return CV_ALIASES[key] ?? CV_ALIASES[raw.toLowerCase()] ?? "OTHER";
}

export type FurnitureKind = "living" | "bed" | "kitchen" | "bath" | "balcony" | "none";

/** 归一化到家具分支类别，供 builder.placeFurniture 使用。 */
export function furnitureKind(raw: string | null | undefined): FurnitureKind {
  switch (canonicalRoomType(raw)) {
    case "LIVING_DINING":
    case "LIVING":
    case "DINING":
      return "living";
    case "MASTER_BED":
    case "BED":
    case "CHILD_BED":
    case "ELDER_BED":
      return "bed";
    case "KITCHEN":
      return "kitchen";
    case "BATH":
      return "bath";
    case "BALCONY":
      return "balcony";
    default:
      return "none";
  }
}

/** 编辑器房间类型下拉选项，复用唯一的数据源 ROOM_TYPE_LABEL。 */
export const ROOM_TYPE_OPTIONS: [string, string][] = (
  Object.keys(ROOM_TYPE_LABEL) as RoomType[]
).map((k) => [k, ROOM_TYPE_LABEL[k]]);
