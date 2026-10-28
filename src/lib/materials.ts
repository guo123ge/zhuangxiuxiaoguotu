import { MATERIAL_CATEGORY, PATTERN } from "./enums.ts";

export type MaterialSeed = {
  id: string;
  name: string;
  category: string;
  colorHex: string;
  roughness: number;
  metallic: number;
  tileSizeUMm: number;
  tileSizeVMm: number;
  pattern: string;
  groutMm: number;
  pricePerSqm: number;
  unit: string;
  brand?: string;
  spec?: string;
  styleTags: string[];
  sortOrder: number;
};

/**
 * 系统材质库。
 *
 * tileSizeUMm / tileSizeVMm 是"真实规格"——三维渲染时 UV 按此平铺，
 * 因此 800×800 的瓷砖在房间内会呈现为真实的 800mm 见方，而非拉伸到整面。
 * 这是"尺寸可信"的基础数据。
 */
export const systemMaterials: MaterialSeed[] = [
  // ---- 地面 ----
  { id: "mat-oak-plank", name: "浅橡木地板", category: MATERIAL_CATEGORY.FLOOR, colorHex: "#C9A57A", roughness: 0.62, metallic: 0, tileSizeUMm: 1200, tileSizeVMm: 190, pattern: PATTERN.PLANK, groutMm: 1, pricePerSqm: 260, unit: "m2", spec: "1200×190×15mm", styleTags: ["modern-minimal", "natural-wood", "nordic", "japanese", "cream", "family-warm", "senior-friendly"], sortOrder: 1 },
  { id: "mat-walnut-plank", name: "胡桃木地板", category: MATERIAL_CATEGORY.FLOOR, colorHex: "#6B4A32", roughness: 0.58, metallic: 0, tileSizeUMm: 1200, tileSizeVMm: 190, pattern: PATTERN.PLANK, groutMm: 1, pricePerSqm: 420, unit: "m2", spec: "1200×190×15mm", styleTags: ["new-chinese", "american", "light-luxury", "boutique-hotel", "wabi-sabi"], sortOrder: 2 },
  { id: "mat-grey-tile-800", name: "浅灰哑光砖", category: MATERIAL_CATEGORY.FLOOR, colorHex: "#C4C6C8", roughness: 0.45, metallic: 0, tileSizeUMm: 800, tileSizeVMm: 800, pattern: PATTERN.TILE, groutMm: 2, pricePerSqm: 150, unit: "m2", spec: "800×800mm", styleTags: ["modern-minimal", "italian-minimal", "industrial", "smart-tech", "wabi-sabi"], sortOrder: 3 },
  { id: "mat-cream-tile-800", name: "奶油柔光砖", category: MATERIAL_CATEGORY.FLOOR, colorHex: "#EDE4D6", roughness: 0.4, metallic: 0, tileSizeUMm: 800, tileSizeVMm: 800, pattern: PATTERN.TILE, groutMm: 2, pricePerSqm: 180, unit: "m2", spec: "800×800mm", styleTags: ["cream", "french", "light-luxury", "family-warm"], sortOrder: 4 },
  { id: "mat-wood-tile-1200", name: "木纹砖", category: MATERIAL_CATEGORY.FLOOR, colorHex: "#BE9B72", roughness: 0.5, metallic: 0, tileSizeUMm: 1200, tileSizeVMm: 200, pattern: PATTERN.PLANK, groutMm: 2, pricePerSqm: 190, unit: "m2", spec: "1200×200mm", styleTags: ["natural-wood", "nordic", "japanese", "modern-minimal"], sortOrder: 5 },
  { id: "mat-micro-cement", name: "微水泥", category: MATERIAL_CATEGORY.FLOOR, colorHex: "#B9B3AA", roughness: 0.78, metallic: 0, tileSizeUMm: 2000, tileSizeVMm: 2000, pattern: PATTERN.PLAIN, groutMm: 0, pricePerSqm: 320, unit: "m2", spec: "厚度 3mm", styleTags: ["wabi-sabi", "italian-minimal", "industrial"], sortOrder: 6 },
  { id: "mat-anti-slip-tile", name: "防滑地砖", category: MATERIAL_CATEGORY.FLOOR, colorHex: "#D5D2CB", roughness: 0.85, metallic: 0, tileSizeUMm: 300, tileSizeVMm: 300, pattern: PATTERN.TILE, groutMm: 2, pricePerSqm: 130, unit: "m2", spec: "300×300mm 防滑", styleTags: ["senior-friendly", "family-warm", "modern-minimal"], sortOrder: 7 },
  { id: "mat-herringbone-oak", name: "鱼骨拼橡木", category: MATERIAL_CATEGORY.FLOOR, colorHex: "#CBA97E", roughness: 0.6, metallic: 0, tileSizeUMm: 600, tileSizeVMm: 120, pattern: PATTERN.HERRINGBONE, groutMm: 1, pricePerSqm: 480, unit: "m2", spec: "600×120mm 鱼骨拼", styleTags: ["french", "light-luxury", "boutique-hotel"], sortOrder: 8 },

  // ---- 墙面 ----
  { id: "mat-latex-warm-white", name: "暖白乳胶漆", category: MATERIAL_CATEGORY.WALL, colorHex: "#F5F2EC", roughness: 0.92, metallic: 0, tileSizeUMm: 1000, tileSizeVMm: 1000, pattern: PATTERN.PLAIN, groutMm: 0, pricePerSqm: 45, unit: "m2", spec: "五合一哑光", styleTags: ["modern-minimal", "natural-wood", "nordic", "cream", "family-warm", "senior-friendly"], sortOrder: 10 },
  { id: "mat-latex-cream", name: "奶油艺术漆", category: MATERIAL_CATEGORY.WALL, colorHex: "#F0E6D8", roughness: 0.88, metallic: 0, tileSizeUMm: 1000, tileSizeVMm: 1000, pattern: PATTERN.PLAIN, groutMm: 0, pricePerSqm: 120, unit: "m2", spec: "蛋壳光艺术漆", styleTags: ["cream", "french", "light-luxury"], sortOrder: 11 },
  { id: "mat-latex-grey", name: "浅灰艺术漆", category: MATERIAL_CATEGORY.WALL, colorHex: "#DEDDDA", roughness: 0.9, metallic: 0, tileSizeUMm: 1000, tileSizeVMm: 1000, pattern: PATTERN.PLAIN, groutMm: 0, pricePerSqm: 150, unit: "m2", spec: "低饱和艺术漆", styleTags: ["italian-minimal", "wabi-sabi", "industrial", "smart-tech", "boutique-hotel"], sortOrder: 12 },
  { id: "mat-wood-veneer", name: "木饰面", category: MATERIAL_CATEGORY.WALL, colorHex: "#A87A50", roughness: 0.55, metallic: 0, tileSizeUMm: 1220, tileSizeVMm: 2440, pattern: PATTERN.PLANK, groutMm: 1, pricePerSqm: 320, unit: "m2", spec: "1220×2440mm", styleTags: ["new-chinese", "japanese", "natural-wood", "boutique-hotel", "light-luxury"], sortOrder: 13 },
  { id: "mat-fabric-wall", name: "织物硬包", category: MATERIAL_CATEGORY.WALL, colorHex: "#D9D2C6", roughness: 0.95, metallic: 0, tileSizeUMm: 600, tileSizeVMm: 600, pattern: PATTERN.PLAIN, groutMm: 0, pricePerSqm: 280, unit: "m2", spec: "硬包分缝", styleTags: ["boutique-hotel", "light-luxury", "french"], sortOrder: 14 },
  { id: "mat-cement-paint", name: "水泥漆", category: MATERIAL_CATEGORY.WALL, colorHex: "#A9A6A1", roughness: 0.85, metallic: 0, tileSizeUMm: 1000, tileSizeVMm: 1000, pattern: PATTERN.PLAIN, groutMm: 0, pricePerSqm: 90, unit: "m2", spec: "工业风水泥漆", styleTags: ["industrial", "wabi-sabi"], sortOrder: 15 },

  // ---- 顶面 ----
  { id: "mat-ceiling-white", name: "白色顶面涂料", category: MATERIAL_CATEGORY.CEILING, colorHex: "#FAFAF8", roughness: 0.95, metallic: 0, tileSizeUMm: 1000, tileSizeVMm: 1000, pattern: PATTERN.PLAIN, groutMm: 0, pricePerSqm: 40, unit: "m2", spec: "防霉乳胶漆", styleTags: [], sortOrder: 20 },

  // ---- 石材 / 台面 ----
  { id: "mat-marble-1200", name: "浅色岩板", category: MATERIAL_CATEGORY.STONE, colorHex: "#EFEAE3", roughness: 0.25, metallic: 0.02, tileSizeUMm: 1200, tileSizeVMm: 2400, pattern: PATTERN.PLAIN, groutMm: 0, pricePerSqm: 680, unit: "m2", spec: "1200×2400×12mm", styleTags: ["italian-minimal", "light-luxury", "boutique-hotel", "modern-minimal"], sortOrder: 30 },
  { id: "mat-stone-dark", name: "深色石材", category: MATERIAL_CATEGORY.STONE, colorHex: "#4A4844", roughness: 0.3, metallic: 0.02, tileSizeUMm: 1200, tileSizeVMm: 2400, pattern: PATTERN.PLAIN, groutMm: 0, pricePerSqm: 720, unit: "m2", spec: "1200×2400×12mm", styleTags: ["light-luxury", "boutique-hotel", "industrial"], sortOrder: 31 },

  // ---- 柜体 / 家具面料 ----
  { id: "mat-cabinet-frosted", name: "哑光柜门", category: MATERIAL_CATEGORY.CABINET, colorHex: "#F2EFEA", roughness: 0.6, metallic: 0, tileSizeUMm: 600, tileSizeVMm: 900, pattern: PATTERN.PLAIN, groutMm: 1, pricePerSqm: 380, unit: "m2", spec: "PET 哑光门板", styleTags: ["modern-minimal", "cream", "nordic", "family-warm"], sortOrder: 40 },
  { id: "mat-cabinet-wood", name: "木纹柜体", category: MATERIAL_CATEGORY.CABINET, colorHex: "#B08A5E", roughness: 0.58, metallic: 0, tileSizeUMm: 600, tileSizeVMm: 900, pattern: PATTERN.PLANK, groutMm: 1, pricePerSqm: 450, unit: "m2", spec: "双饰面板", styleTags: ["natural-wood", "japanese", "new-chinese"], sortOrder: 41 },
  { id: "mat-cabinet-dark", name: "深色哑光柜体", category: MATERIAL_CATEGORY.CABINET, colorHex: "#3C3B38", roughness: 0.55, metallic: 0, tileSizeUMm: 600, tileSizeVMm: 900, pattern: PATTERN.PLAIN, groutMm: 1, pricePerSqm: 520, unit: "m2", spec: "深色 PET", styleTags: ["italian-minimal", "light-luxury", "industrial", "smart-tech"], sortOrder: 42 },

  { id: "mat-fabric-linen", name: "亚麻布艺", category: MATERIAL_CATEGORY.FABRIC, colorHex: "#DCD5C8", roughness: 0.95, metallic: 0, tileSizeUMm: 400, tileSizeVMm: 400, pattern: PATTERN.PLAIN, groutMm: 0, pricePerSqm: 160, unit: "m2", spec: "棉麻混纺", styleTags: ["natural-wood", "nordic", "japanese", "wabi-sabi", "cream"], sortOrder: 50 },
  { id: "mat-fabric-velvet", name: "丝绒", category: MATERIAL_CATEGORY.FABRIC, colorHex: "#7C5A6E", roughness: 0.88, metallic: 0, tileSizeUMm: 400, tileSizeVMm: 400, pattern: PATTERN.PLAIN, groutMm: 0, pricePerSqm: 280, unit: "m2", spec: "高密丝绒", styleTags: ["light-luxury", "french", "boutique-hotel"], sortOrder: 51 },
  { id: "mat-fabric-grey", name: "灰色织物", category: MATERIAL_CATEGORY.FABRIC, colorHex: "#9A9A97", roughness: 0.92, metallic: 0, tileSizeUMm: 400, tileSizeVMm: 400, pattern: PATTERN.PLAIN, groutMm: 0, pricePerSqm: 200, unit: "m2", spec: "科技布", styleTags: ["modern-minimal", "italian-minimal", "smart-tech", "industrial"], sortOrder: 52 },
  { id: "mat-fabric-cream", name: "米色织物", category: MATERIAL_CATEGORY.FABRIC, colorHex: "#E5DCCB", roughness: 0.93, metallic: 0, tileSizeUMm: 400, tileSizeVMm: 400, pattern: PATTERN.PLAIN, groutMm: 0, pricePerSqm: 190, unit: "m2", spec: "柔软绒布", styleTags: ["cream", "family-warm", "french", "senior-friendly"], sortOrder: 53 },

  // ---- 金属 ----
  { id: "mat-metal-brass", name: "黄铜", category: MATERIAL_CATEGORY.METAL, colorHex: "#C9A55C", roughness: 0.28, metallic: 0.9, tileSizeUMm: 500, tileSizeVMm: 500, pattern: PATTERN.PLAIN, groutMm: 0, pricePerSqm: 420, unit: "m2", spec: "拉丝黄铜", styleTags: ["french", "light-luxury", "boutique-hotel"], sortOrder: 60 },
  { id: "mat-metal-black", name: "黑铁", category: MATERIAL_CATEGORY.METAL, colorHex: "#2E2E2E", roughness: 0.4, metallic: 0.85, tileSizeUMm: 500, tileSizeVMm: 500, pattern: PATTERN.PLAIN, groutMm: 0, pricePerSqm: 260, unit: "m2", spec: "哑光黑铁", styleTags: ["industrial", "italian-minimal", "smart-tech"], sortOrder: 61 },
  { id: "mat-metal-chrome", name: "镀铬", category: MATERIAL_CATEGORY.METAL, colorHex: "#D8DBDE", roughness: 0.15, metallic: 0.95, tileSizeUMm: 500, tileSizeVMm: 500, pattern: PATTERN.PLAIN, groutMm: 0, pricePerSqm: 300, unit: "m2", spec: "镜面镀铬", styleTags: ["smart-tech", "modern-minimal"], sortOrder: 62 },

  // ---- 玻璃 ----
  { id: "mat-glass-clear", name: "清玻璃", category: MATERIAL_CATEGORY.GLASS, colorHex: "#DCE8EC", roughness: 0.05, metallic: 0, tileSizeUMm: 1000, tileSizeVMm: 1000, pattern: PATTERN.PLAIN, groutMm: 0, pricePerSqm: 220, unit: "m2", spec: "8mm 钢化", styleTags: [], sortOrder: 70 },
];

/** 按 ID 快速索引 */
export const materialById = new Map(systemMaterials.map((m) => [m.id, m]));

/** 按类别取材质 */
export function materialsByCategory(category: string) {
  return systemMaterials.filter((m) => m.category === category);
}

/** 某风格下某类别的推荐材质（取该风格下 sortOrder 最小者） */
export function preferredMaterial(styleId: string, category: string) {
  const list = systemMaterials
    .filter((m) => m.category === category && m.styleTags.includes(styleId))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (list.length > 0) return list[0];
  const fallback = systemMaterials
    .filter((m) => m.category === category)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return fallback[0];
}
