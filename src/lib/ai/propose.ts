/**
 * AI 变更提案：自然语言 → 结构化参数补丁（方案覆盖集 overlay）。
 *
 * 输入用户的一句话诉求（如「把主卧墙面换成奶油白、地面换浅色木地板」），
 * 输出 overlay 补丁（roomId → 各面颜色/材质），供用户确认后应用到方案。
 * 无 Key 时返回 null，由上层提示不可用并降级为手动编辑。
 */
import { z } from "zod";
import { chatJson } from "./client.ts";

export type ProposalPatch = {
  overlay: Record<string, Partial<Record<"floor" | "wall" | "ceiling" | "cabinet", string>>>;
  summary: string;
};

const schema = z.object({
  summary: z.string(),
  overlay: z.record(
    z.object({
      floor: z.string().optional(),
      wall: z.string().optional(),
      ceiling: z.string().optional(),
      cabinet: z.string().optional(),
    }),
  ),
});

/** 房间清单（id/名称/类型/面积）→ 文本，供模型理解 */
function roomsContext(rooms: { id: string; name: string; roomType: string; areaM2: number }[]): string {
  return rooms.map((r) => `${r.name}(${r.roomType}, ${r.areaM2.toFixed(1)}m², id=${r.id})`).join("、");
}

export async function proposePatch(
  rooms: { id: string; name: string; roomType: string; areaM2: number }[],
  request: string,
): Promise<ProposalPatch | null> {
  const system =
    "你是室内设计助手。根据用户的一句话诉求，输出对指定房间的材质/颜色覆盖补丁。" +
    "颜色必须是 #RRGGBB 十六进制色值。只改用户明确提到的房间与面，其余不要动。" +
    "返回严格 JSON：{\"summary\":\"一句话总结\",\"overlay\":{\"<roomId>\":{\"floor\":\"#hex\",\"wall\":\"#hex\",\"ceiling\":\"#hex\",\"cabinet\":\"#hex\"}}}。";
  const prompt =
    `房间清单：${roomsContext(rooms)}\n\n用户诉求：${request}\n` +
    `请把诉求转化为 overlay 覆盖补丁（floor/wall/ceiling/cabinet 四面的颜色）。`;

  const res = await chatJson({ system, prompt, schema });
  if (!res) return null;
  return { overlay: res.data.overlay, summary: res.data.summary };
}
