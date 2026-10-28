/**
 * 数据库初始化：写入系统材质库与 16 套风格。
 *
 * 数据源直接复用 src/lib 下的 TS 定义，避免同一份数据在 JSON 与 TS 之间重复维护。
 * Node 22.18+ 原生支持 TypeScript 类型剥离，因此可以直接以 .ts 运行。
 */
import { PrismaClient } from "@prisma/client";
import { systemMaterials } from "../src/lib/materials.ts";
import { designStyles } from "../src/lib/styles.ts";

const prisma = new PrismaClient();

async function main() {
  // ---- 材质库 ----
  for (const m of systemMaterials) {
    await prisma.material.upsert({
      where: { id: m.id },
      update: {
        name: m.name,
        category: m.category,
        colorHex: m.colorHex,
        roughness: m.roughness,
        metallic: m.metallic,
        tileSizeUMm: m.tileSizeUMm,
        tileSizeVMm: m.tileSizeVMm,
        pattern: m.pattern,
        groutMm: m.groutMm,
        pricePerSqm: m.pricePerSqm,
        unit: m.unit,
        brand: m.brand ?? null,
        spec: m.spec ?? null,
        styleTagsJson: JSON.stringify(m.styleTags),
        isSystem: true,
        sortOrder: m.sortOrder,
      },
      create: {
        id: m.id,
        name: m.name,
        category: m.category,
        colorHex: m.colorHex,
        roughness: m.roughness,
        metallic: m.metallic,
        tileSizeUMm: m.tileSizeUMm,
        tileSizeVMm: m.tileSizeVMm,
        pattern: m.pattern,
        groutMm: m.groutMm,
        pricePerSqm: m.pricePerSqm,
        unit: m.unit,
        brand: m.brand ?? null,
        spec: m.spec ?? null,
        styleTagsJson: JSON.stringify(m.styleTags),
        isSystem: true,
        sortOrder: m.sortOrder,
      },
    });
  }

  // ---- 风格库 ----
  for (const s of designStyles) {
    const data = {
      name: s.name,
      summary: s.summary,
      keywords: s.keywords,
      palette: s.palette,
      materials: s.materials,
      lighting: s.lighting,
      negative: s.negative,
      roomTips: s.roomTips,
      paletteJson: JSON.stringify(s.paletteJson),
      materialRulesJson: JSON.stringify(s.materialRulesJson),
      colorRulesJson: JSON.stringify(s.colorRulesJson),
      lightingJson: JSON.stringify(s.lightingJson),
      furnitureRulesJson: JSON.stringify(s.furnitureRulesJson),
      sortOrder: s.sortOrder,
      isSystem: true,
      projectId: null,
    };
    await prisma.designStyle.upsert({
      where: { id: s.id },
      update: data,
      create: { id: s.id, ...data },
    });
  }

  const [materialCount, styleCount] = await Promise.all([
    prisma.material.count(),
    prisma.designStyle.count(),
  ]);

  console.log(`[seed] 材质库 ${materialCount} 项，风格库 ${styleCount} 套`);
}

main()
  .catch((err) => {
    console.error("[seed] 失败：", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
