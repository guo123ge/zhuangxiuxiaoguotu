/**
 * 预算引擎：工程量 × 主材单价 × (1 + 损耗率) → 金额。
 * 主材单价优先从材质库（Material.pricePerSqm）按风格解析，
 * 无匹配时回退到内置参考价。
 */
import type { QuantityLine } from "./quantity.ts";
import { preferredMaterial } from "./materials.ts";
import { MATERIAL_CATEGORY } from "./enums.ts";

export type BudgetRow = {
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  laborPrice: number;
  wasteRate: number;
  amount: number;
};

/** 兜底参考单价（元），key 为 category */
export const DEFAULT_PRICE: Record<string, { unitPrice: number; laborPrice: number; wasteRate: number }> = {
  FLOOR: { unitPrice: 180, laborPrice: 65, wasteRate: 0.05 },
  WALL: { unitPrice: 45, laborPrice: 28, wasteRate: 0.05 },
  CEILING: { unitPrice: 40, laborPrice: 35, wasteRate: 0.03 },
  SKIRTING: { unitPrice: 25, laborPrice: 12, wasteRate: 0.05 },
  DOOR: { unitPrice: 1500, laborPrice: 200, wasteRate: 0 },
  WINDOW: { unitPrice: 680, laborPrice: 120, wasteRate: 0 },
  CABINET: { unitPrice: 1600, laborPrice: 300, wasteRate: 0 },
};

/** 工程量类别 → 材质库类别（用于取主材价） */
const CATEGORY_TO_MATERIAL: Record<string, string> = {
  FLOOR: MATERIAL_CATEGORY.FLOOR,
  WALL: MATERIAL_CATEGORY.WALL,
  CEILING: MATERIAL_CATEGORY.CEILING,
  CABINET: MATERIAL_CATEGORY.CABINET,
};

/**
 * 解析某类别的单价：优先按风格取材质库 pricePerSqm，否则用兜底价。
 */
export function resolveUnitPrice(styleId: string | null, category: string) {
  const fallback = DEFAULT_PRICE[category] ?? { unitPrice: 0, laborPrice: 0, wasteRate: 0 };
  const matCat = CATEGORY_TO_MATERIAL[category];
  if (matCat && styleId) {
    const mat = preferredMaterial(styleId, matCat);
    if (mat) {
      return { unitPrice: mat.pricePerSqm, laborPrice: fallback.laborPrice, wasteRate: fallback.wasteRate };
    }
  }
  return fallback;
}

export function computeBudget(
  lines: QuantityLine[],
  opts: { styleId?: string | null } = {},
): BudgetRow[] {
  return lines.map((l) => {
    const p = resolveUnitPrice(opts.styleId ?? null, l.category);
    const qty = l.quantity * (1 + p.wasteRate);
    const amount = qty * p.unitPrice + l.quantity * p.laborPrice;
    return {
      itemName: l.itemName,
      category: l.category,
      quantity: Number(qty.toFixed(2)),
      unit: l.unit,
      unitPrice: p.unitPrice,
      laborPrice: p.laborPrice,
      wasteRate: p.wasteRate,
      amount: Number(amount.toFixed(2)),
    };
  });
}

export function budgetTotal(rows: BudgetRow[]): number {
  return Number(rows.reduce((s, r) => s + r.amount, 0).toFixed(2));
}

/** 工程量/预算 → CSV 字符串 */
export function toCsv(lines: QuantityLine[], rows: BudgetRow[]): string {
  const header = "项目,类别,工程量,单位,主材单价,人工单价,损耗率,金额(元)";
  const body = rows
    .map((r, i) => {
      const q = lines[i];
      return [
        r.itemName, q.category, r.quantity, r.unit, r.unitPrice, r.laborPrice,
        `${(r.wasteRate * 100).toFixed(0)}%`, r.amount,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
    })
    .join("\n");
  const total = `"合计","","","","","","",${budgetTotal(rows)}`;
  return [header, ...body.split("\n"), total].join("\n");
}
