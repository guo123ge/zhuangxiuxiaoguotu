import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeQuantities, type QtyRoom, type QtyOpening } from "@/lib/quantity";

export const runtime = "nodejs";

/** 从 DB 读取已确认房间与开口，转成工程量输入 */
async function buildInput(projectId: string) {
  const [rooms, openings] = await Promise.all([
    prisma.detectedRoom.findMany({ where: { projectId }, orderBy: { order: "asc" } }),
    prisma.opening.findMany({ where: { projectId } }),
  ]);

  const qtyRooms: QtyRoom[] = rooms.map((r) => ({
    id: r.id,
    name: r.name,
    roomType: r.roomType,
    polygonMm: safePolygon(r.polygonJson),
    heightMm: r.heightMm,
  }));

  const qtyOpenings: QtyOpening[] = openings.map((o) => {
    let swing: { centerMm?: [number, number]; roomA?: string | null; roomB?: string | null } = {};
    try { swing = JSON.parse(o.swingJson || "{}"); } catch { /* ignore */ }
    return {
      kind: o.kind,
      widthMm: o.widthMm,
      heightMm: o.heightMm,
      sillMm: o.sillMm,
      centerMm: swing.centerMm ?? [0, 0],
      roomAId: swing.roomA ?? null,
      roomBId: swing.roomB ?? null,
    };
  });

  return { qtyRooms, qtyOpenings };
}

function safePolygon(json: string): [number, number][] {
  try {
    const p = JSON.parse(json);
    if (Array.isArray(p)) return p;
  } catch { /* ignore */ }
  return [];
}

/** POST /api/projects/[id]/quantities — 生成并落库工程量 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const { qtyRooms, qtyOpenings } = await buildInput(params.id);
  if (qtyRooms.length === 0) {
    return NextResponse.json({ error: "请先完成户型识别并确认" }, { status: 400 });
  }

  const lines = computeQuantities(qtyRooms, qtyOpenings);
  await prisma.$transaction(async (tx) => {
    await tx.quantityLine.deleteMany({ where: { projectId: params.id } });
    for (const l of lines) {
      await tx.quantityLine.create({
        data: {
          projectId: params.id,
          roomId: l.roomId,
          category: l.category,
          itemName: l.itemName,
          formulaJson: JSON.stringify({ formula: l.formula }),
          quantity: l.quantity,
          unit: l.unit,
        },
      });
    }
  });
  return NextResponse.json({ lines }, { status: 201 });
}

/** GET /api/projects/[id]/quantities — 读取工程量 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const lines = await prisma.quantityLine.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ lines });
}
