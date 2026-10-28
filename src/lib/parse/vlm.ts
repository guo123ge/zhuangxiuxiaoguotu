/**
 * VLM 增强识别（可选链路，无 Key 时整体跳过）。
 *
 * 两个用途：
 *   1. 读尺寸链：直接读图四边的毫米标注，给出总长 → 比例候选（VLM_DIM）
 *   2. 房间精分类：根据家具陈设推断每个房间核的功能类型
 *
 * 所有输出仅作为「候选/参考」，与本地 CV 结果按置信度融合；
 * 冲突时降置信度并进入人工确认队列。
 */
import { z } from "zod";
import { visionJson } from "../ai/client.ts";
import { ROOM_TYPE } from "../enums.ts";

const dimSchema = z.object({
  topMm: z.number().nullable(),
  bottomMm: z.number().nullable(),
  leftMm: z.number().nullable(),
  rightMm: z.number().nullable(),
  note: z.string().optional(),
});

/** 读四边尺寸链总长（毫米）。读不出返回 null */
export async function vlmReadDimensionChains(imageBytes: Buffer) {
  const r = await visionJson({
    images: [imageBytes],
    system:
      "你是建筑图纸识别助手。只输出 JSON，不要输出任何解释。",
    prompt: `这是一张住宅户型平面图，图的上下左右四边通常有尺寸标注链（单位毫米）。
请读出四条边的尺寸链总长（各段数字之和）：
{"topMm": 数字或null, "bottomMm": 数字或null, "leftMm": 数字或null, "rightMm": 数字或null, "note": "可选备注"}
读不清的边填 null，不要猜。`,
    schema: dimSchema,
    maxTokens: 500,
  });
  return r?.data ?? null;
}

const roomClassSchema = z.object({
  rooms: z.array(
    z.object({
      index: z.number(), // 与传入的房间编号一致
      type: z.enum([
        ROOM_TYPE.LIVING_DINING, ROOM_TYPE.LIVING, ROOM_TYPE.DINING,
        ROOM_TYPE.KITCHEN, ROOM_TYPE.BATH, ROOM_TYPE.MASTER_BED,
        ROOM_TYPE.BED, ROOM_TYPE.CHILD_BED, ROOM_TYPE.ELDER_BED,
        ROOM_TYPE.STUDY, ROOM_TYPE.CLOAK, ROOM_TYPE.STORAGE,
        ROOM_TYPE.BALCONY, ROOM_TYPE.ENTRY, ROOM_TYPE.HALLWAY,
        ROOM_TYPE.MULTI, ROOM_TYPE.OTHER,
      ]),
      name: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

export type VlmRoomClass = z.infer<typeof roomClassSchema>["rooms"][number];

/**
 * 房间精分类。输入原图 + 每个房间核的编号/面积/质心（归一化坐标），
 * 输出每个房间的功能类型。失败返回 null。
 */
export async function vlmClassifyRooms(
  imageBytes: Buffer,
  roomHints: { index: number; areaM2: number; cxNorm: number; cyNorm: number }[],
): Promise<VlmRoomClass[] | null> {
  if (roomHints.length === 0) return null;
  const hintText = roomHints
    .map(
      (h) =>
        `${h.index}. 面积约${h.areaM2.toFixed(1)}㎡，中心位于图宽${(h.cxNorm * 100).toFixed(0)}%、图高${(h.cyNorm * 100).toFixed(0)}%处`,
    )
    .join("\n");
  const r = await visionJson({
    images: [imageBytes],
    system:
      "你是住宅户型识别专家。根据家具陈设（床/沙发/餐桌/马桶/灶台/浴缸等）推断房间功能。只输出 JSON。",
    prompt: `这张户型图被自动分割成了 ${roomHints.length} 个区域，请为每个区域判断功能类型。
区域列表（编号/面积/位置）：
${hintText}

类型只能从以下选择：客餐厅LIVING_DINING、客厅LIVING、餐厅DINING、厨房KITCHEN、卫生间BATH、主卧MASTER_BED、次卧BED、儿童房CHILD_BED、老人房ELDER_BED、书房STUDY、衣帽间CLOAK、储藏间STORAGE、阳台BALCONY、玄关ENTRY、走道HALLWAY、多功能房MULTI、其他OTHER。

判断依据：床→卧室类（带独立卫生间/面积大的是主卧）；马桶浴缸→卫生间；灶台橱柜→厨房；沙发茶几电视→客厅；餐桌→餐厅；绿植且在建筑边缘→阳台；狭长连接区→走道；入户处小空间→玄关。

输出格式：
{"rooms": [{"index": 编号, "type": "类型枚举", "name": "中文名（如 主卧）", "confidence": 0-1}]}`,
    schema: roomClassSchema,
    maxTokens: 1500,
  });
  return r?.data.rooms ?? null;
}
