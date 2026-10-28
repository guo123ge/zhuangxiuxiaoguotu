import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeBudget, budgetTotal } from "@/lib/budget";
import type { QuantityLine as QLine } from "@/lib/quantity";

export const runtime = "nodejs";

type DbLine = {
  id: string;
  projectId: string;
  roomId: string | null;
  category: string;
  itemName: string;
  formulaJson: string;
  quantity: number;
  unit: string;
  createdAt: Date;
};

function toQLine(l: DbLine): QLine {
  return {
    category: l.category,
    itemName: l.itemName,
    roomId: l.roomId,
    quantity: l.quantity,
    unit: l.unit,
    formula: safeFormula(l.formulaJson),
  };
}

function safeFormula(json: string): string {
  try { const f = JSON.parse(json); return f.formula ?? ""; } catch { return ""; }
}

/** 取主方案风格，用于按材质库解析主材单价 */
async function primaryStyleId(projectId: string): Promise<string | null> {
  const primary = await prisma.designScheme.findFirst({ where: { projectId, isPrimary: true } });
  return primary?.styleId ?? null;
}

/** GET /api/projects/[id]/budget — 预算（若未生成则现场计算，不落库） */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const lines = await prisma.quantityLine.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: "asc" },
  });
  if (lines.length === 0) {
    return NextResponse.json({ error: "请先生成工程量" }, { status: 400 });
  }
  const styleId = await primaryStyleId(params.id);
  const rows = computeBudget(lines.map(toQLine), { styleId });
  return NextResponse.json({ rows, total: budgetTotal(rows), styleId });
}

/** POST /api/projects/[id]/budget — 生成预算并落库 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const lines = await prisma.quantityLine.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: "asc" },
  });
  if (lines.length === 0) {
    return NextResponse.json({ error: "请先生成工程量" }, { status: 400 });
  }
  const qLines = lines.map(toQLine);
  const styleId = await primaryStyleId(params.id);
  const rows = computeBudget(qLines, { styleId });

  await prisma.$transaction(async (tx) => {
    await tx.budgetItem.deleteMany({ where: { projectId: params.id } });
    for (const r of rows) {
      await tx.budgetItem.create({
        data: {
          projectId: params.id,
          name: r.itemName,
          unitPrice: r.unitPrice,
          laborPrice: r.laborPrice,
          wasteRate: r.wasteRate,
          quantity: r.quantity,
          unit: r.unit,
          amount: r.amount,
        },
      });
    }
  });
  return NextResponse.json({ rows, total: budgetTotal(rows) }, { status: 201 });
}
