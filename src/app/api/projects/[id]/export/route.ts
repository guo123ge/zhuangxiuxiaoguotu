import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeBudget, budgetTotal, toCsv } from "@/lib/budget";
import type { QuantityLine as QLine } from "@/lib/quantity";

export const runtime = "nodejs";

function toQLine(l: { category: string; itemName: string; roomId: string | null; quantity: number; unit: string; formulaJson: string }): QLine {
  let formula = "";
  try { formula = (JSON.parse(l.formulaJson) as { formula?: string }).formula ?? ""; } catch { /* ignore */ }
  return { category: l.category, itemName: l.itemName, roomId: l.roomId, quantity: l.quantity, unit: l.unit, formula };
}

/** GET /api/projects/[id]/export?format=csv|json — 导出工程量与预算 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "csv";
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const lines = await prisma.quantityLine.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: "asc" },
  });
  if (lines.length === 0) {
    return NextResponse.json({ error: "请先生成工程量" }, { status: 400 });
  }
  const qLines = lines.map(toQLine);
  const primary = await prisma.designScheme.findFirst({ where: { projectId: params.id, isPrimary: true } });
  const rows = computeBudget(qLines, { styleId: primary?.styleId ?? null });

  if (format === "json") {
    return NextResponse.json({
      project: { title: project.title, unitNo: project.unitNo },
      quantities: qLines,
      budget: rows,
      total: budgetTotal(rows),
    });
  }

  const csv = "\uFEFF" + toCsv(qLines, rows); // BOM 使 Excel 正确识别 UTF-8
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="预算-${project.title || "项目"}.csv"`,
    },
  });
}
