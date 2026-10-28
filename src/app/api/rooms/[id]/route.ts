import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ROOM_TYPE_LABEL } from "@/lib/enums";

export const runtime = "nodejs";

const patchSchema = z.object({
  name: z.string().min(1).max(20).optional(),
  roomType: z
    .enum(Object.keys(ROOM_TYPE_LABEL) as [string, ...string[]])
    .optional(),
  isConfirmed: z.boolean().optional(),
});

/** PATCH /api/rooms/[id] — 人工修正房间名称/类型 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const room = await prisma.detectedRoom.findUnique({ where: { id: params.id } });
  if (!room) return NextResponse.json({ error: "房间不存在" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "参数错误" }, { status: 400 });
  }
  const updated = await prisma.detectedRoom.update({
    where: { id: room.id },
    data: {
      ...parsed.data,
      source: "MANUAL",
      needsReview: false,
    },
  });
  return NextResponse.json({ room: updated });
}
