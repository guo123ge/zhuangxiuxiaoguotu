/**
 * 风格库。
 *
 * 在旧项目 16 风格基础上扩展「结构化联动规则」：
 *   - paletteJson       色板（base/accent/neutral/wood/metal）
 *   - materialRulesJson 材质规则（按 target + roomType 匹配，priority 小者优先）
 *   - colorRulesJson    颜色规则
 *   - lightingJson      灯光（昼/夜色温与强度、灯具类型）
 *   - furnitureRulesJson 家具材质提示
 *
 * 风格切换只改材质/颜色/家具/灯光，不改几何，因此是毫秒级操作。
 */

export type MaterialRule = {
  target: "FLOOR" | "WALL" | "CEILING" | "CABINET";
  roomType: string | "*";
  materialId: string;
  priority: number;
};

export type ColorRule = {
  target: "FLOOR" | "WALL" | "CEILING" | "CABINET";
  roomType: string | "*";
  colorHex: string;
};

export type LightingRule = {
  cctK: number;
  ambientIntensity: number;
  keyIntensity: number;
  lampTypes: string[];
  night: { cctK: number; ambientIntensity: number; keyIntensity: number };
};

export type FurnitureRule = {
  roomType: string;
  kind: string;
  styleHint: string;
  materialHint: string;
};

export type StyleSeed = {
  id: string;
  name: string;
  summary: string;
  keywords: string;
  palette: string;
  materials: string;
  lighting: string;
  negative: string;
  roomTips: string;
  paletteJson: {
    base: string[];
    accent: string[];
    neutral: string[];
    wood: string;
    metal: string;
  };
  materialRulesJson: MaterialRule[];
  colorRulesJson: ColorRule[];
  lightingJson: LightingRule;
  furnitureRulesJson: FurnitureRule[];
  sortOrder: number;
};

const L = {
  LINEAR: "LINEAR", // 线性灯 / 灯带
  DOWNLIGHT: "DOWNLIGHT", // 筒灯
  SPOT: "SPOT", // 射灯
  PENDANT: "PENDANT", // 吊灯
  FLOOR_LAMP: "FLOOR_LAMP", // 落地灯
  WALL_LAMP: "WALL_LAMP", // 壁灯
  TRACK: "TRACK", // 轨道灯
};

export const designStyles: StyleSeed[] = [
  {
    id: "modern-minimal",
    name: "现代简约",
    summary: "干净利落、收纳友好，适合大多数城市住宅。",
    keywords: "简洁线条,低饱和色,隐藏收纳,无主灯,温和对比",
    palette: "暖白、浅灰、木色、少量黑色线条",
    materials: "哑光柜门、木饰面、微水泥、细框玻璃",
    lighting: "无主灯、线性灯、局部洗墙光",
    negative: "避免复杂吊顶、过度金属、强烈花纹",
    roomTips: "客餐厅强调通透，卧室保持安静柔和。",
    paletteJson: {
      base: ["#F5F3EE", "#EFEAE1"],
      accent: ["#8A8578"],
      neutral: ["#C9C7C2", "#8A8578"],
      wood: "#C9A57A",
      metal: "#3A3A3A",
    },
    materialRulesJson: [
      { target: "FLOOR", roomType: "LIVING_DINING", materialId: "mat-grey-tile-800", priority: 1 },
      { target: "FLOOR", roomType: "LIVING", materialId: "mat-grey-tile-800", priority: 2 },
      { target: "FLOOR", roomType: "MASTER_BED", materialId: "mat-oak-plank", priority: 1 },
      { target: "FLOOR", roomType: "BED", materialId: "mat-oak-plank", priority: 1 },
      { target: "FLOOR", roomType: "CHILD_BED", materialId: "mat-oak-plank", priority: 1 },
      { target: "FLOOR", roomType: "KITCHEN", materialId: "mat-grey-tile-800", priority: 1 },
      { target: "FLOOR", roomType: "BATH", materialId: "mat-anti-slip-tile", priority: 1 },
      { target: "FLOOR", roomType: "*", materialId: "mat-grey-tile-800", priority: 9 },
      { target: "WALL", roomType: "*", materialId: "mat-latex-warm-white", priority: 9 },
      { target: "CEILING", roomType: "*", materialId: "mat-ceiling-white", priority: 9 },
      { target: "CABINET", roomType: "*", materialId: "mat-cabinet-frosted", priority: 9 },
    ],
    colorRulesJson: [
      { target: "WALL", roomType: "*", colorHex: "#F5F2EC" },
      { target: "CEILING", roomType: "*", colorHex: "#FAFAF8" },
    ],
    lightingJson: {
      cctK: 4000,
      ambientIntensity: 0.5,
      keyIntensity: 1.1,
      lampTypes: [L.LINEAR, L.DOWNLIGHT, L.SPOT],
      night: { cctK: 3500, ambientIntensity: 0.2, keyIntensity: 0.5 },
    },
    furnitureRulesJson: [
      { roomType: "LIVING_DINING", kind: "SOFA", styleHint: "straight", materialHint: "mat-fabric-grey" },
      { roomType: "MASTER_BED", kind: "BED", styleHint: "low-profile", materialHint: "mat-fabric-grey" },
      { roomType: "DINING", kind: "DINING_TABLE", styleHint: "rect", materialHint: "mat-cabinet-frosted" },
    ],
    sortOrder: 1,
  },
  {
    id: "italian-minimal",
    name: "意式极简",
    summary: "更高级克制，强调材质比例和低调质感。",
    keywords: "意式极简,高级灰,大板材,悬浮柜,低矮家具",
    palette: "灰咖、米白、炭黑、深木色",
    materials: "岩板、皮革、深色木饰面、金属窄边",
    lighting: "低位氛围光、磁吸轨道灯、局部重点光",
    negative: "避免亮色软装和繁复欧式线脚",
    roomTips: "适合客厅、主卧和开放式餐厨。",
    paletteJson: {
      base: ["#E8E6E2", "#D8D4CE"],
      accent: ["#4A4844"],
      neutral: ["#8C8781", "#4A4844"],
      wood: "#6B4A32",
      metal: "#2E2E2E",
    },
    materialRulesJson: [
      { target: "FLOOR", roomType: "LIVING_DINING", materialId: "mat-grey-tile-800", priority: 1 },
      { target: "FLOOR", roomType: "LIVING", materialId: "mat-grey-tile-800", priority: 1 },
      { target: "FLOOR", roomType: "MASTER_BED", materialId: "mat-walnut-plank", priority: 1 },
      { target: "FLOOR", roomType: "*", materialId: "mat-grey-tile-800", priority: 9 },
      { target: "WALL", roomType: "*", materialId: "mat-latex-grey", priority: 9 },
      { target: "CEILING", roomType: "*", materialId: "mat-ceiling-white", priority: 9 },
      { target: "CABINET", roomType: "*", materialId: "mat-cabinet-dark", priority: 9 },
    ],
    colorRulesJson: [
      { target: "WALL", roomType: "*", colorHex: "#DEDDDA" },
      { target: "CEILING", roomType: "*", colorHex: "#FAFAF8" },
    ],
    lightingJson: {
      cctK: 3200,
      ambientIntensity: 0.4,
      keyIntensity: 1.0,
      lampTypes: [L.TRACK, L.SPOT, L.LINEAR],
      night: { cctK: 2800, ambientIntensity: 0.16, keyIntensity: 0.45 },
    },
    furnitureRulesJson: [
      { roomType: "LIVING_DINING", kind: "SOFA", styleHint: "low", materialHint: "mat-fabric-grey" },
      { roomType: "MASTER_BED", kind: "BED", styleHint: "low-platform", materialHint: "mat-fabric-grey" },
    ],
    sortOrder: 2,
  },
  {
    id: "cream",
    name: "奶油风",
    summary: "柔和温暖，适合小户型和亲子家庭。",
    keywords: "奶油色,圆角,柔软织物,温馨,浅木色",
    palette: "奶油白、燕麦色、浅木色、浅咖",
    materials: "艺术漆、布艺、藤编、浅色木地板",
    lighting: "暖色灯带、柔光吊灯、落地灯",
    negative: "避免冷灰、黑色大面积对比、尖锐线条",
    roomTips: "儿童房和卧室可加入柔和色块。",
    paletteJson: {
      base: ["#F6F0E6", "#EDE4D6"],
      accent: ["#D8B98C"],
      neutral: ["#BFAE97", "#D8B98C"],
      wood: "#CBA97E",
      metal: "#C9A55C",
    },
    materialRulesJson: [
      { target: "FLOOR", roomType: "LIVING_DINING", materialId: "mat-cream-tile-800", priority: 1 },
      { target: "FLOOR", roomType: "MASTER_BED", materialId: "mat-oak-plank", priority: 1 },
      { target: "FLOOR", roomType: "BED", materialId: "mat-oak-plank", priority: 1 },
      { target: "FLOOR", roomType: "CHILD_BED", materialId: "mat-oak-plank", priority: 1 },
      { target: "FLOOR", roomType: "*", materialId: "mat-cream-tile-800", priority: 9 },
      { target: "WALL", roomType: "*", materialId: "mat-latex-cream", priority: 9 },
      { target: "CEILING", roomType: "*", materialId: "mat-ceiling-white", priority: 9 },
      { target: "CABINET", roomType: "*", materialId: "mat-cabinet-frosted", priority: 9 },
    ],
    colorRulesJson: [
      { target: "WALL", roomType: "*", colorHex: "#F0E6D8" },
      { target: "CEILING", roomType: "*", colorHex: "#FAFAF8" },
    ],
    lightingJson: {
      cctK: 3200,
      ambientIntensity: 0.55,
      keyIntensity: 0.95,
      lampTypes: [L.PENDANT, L.LINEAR, L.FLOOR_LAMP],
      night: { cctK: 2700, ambientIntensity: 0.24, keyIntensity: 0.5 },
    },
    furnitureRulesJson: [
      { roomType: "LIVING_DINING", kind: "SOFA", styleHint: "curved", materialHint: "mat-fabric-cream" },
      { roomType: "MASTER_BED", kind: "BED", styleHint: "soft", materialHint: "mat-fabric-cream" },
    ],
    sortOrder: 3,
  },
  {
    id: "natural-wood",
    name: "原木风",
    summary: "自然舒适，强调木质纹理和生活气息。",
    keywords: "原木,自然光,白墙,绿植,温润",
    palette: "白色、浅木、亚麻、少量绿色",
    materials: "橡木、藤编、棉麻、白色乳胶漆",
    lighting: "自然采光、暖白筒灯、纸灯",
    negative: "避免深色压抑、镜面材质和复杂造型",
    roomTips: "适合全屋统一风格，厨房注意耐污材质。",
    paletteJson: {
      base: ["#FAF7F1", "#F1EADF"],
      accent: ["#8A9A7B"],
      neutral: ["#B8A88F", "#8A9A7B"],
      wood: "#C9A57A",
      metal: "#8C8C8C",
    },
    materialRulesJson: [
      { target: "FLOOR", roomType: "LIVING_DINING", materialId: "mat-oak-plank", priority: 1 },
      { target: "FLOOR", roomType: "LIVING", materialId: "mat-oak-plank", priority: 1 },
      { target: "FLOOR", roomType: "MASTER_BED", materialId: "mat-oak-plank", priority: 1 },
      { target: "FLOOR", roomType: "BED", materialId: "mat-oak-plank", priority: 1 },
      { target: "FLOOR", roomType: "CHILD_BED", materialId: "mat-oak-plank", priority: 1 },
      { target: "FLOOR", roomType: "STUDY", materialId: "mat-oak-plank", priority: 1 },
      { target: "FLOOR", roomType: "KITCHEN", materialId: "mat-wood-tile-1200", priority: 1 },
      { target: "FLOOR", roomType: "*", materialId: "mat-oak-plank", priority: 9 },
      { target: "WALL", roomType: "*", materialId: "mat-latex-warm-white", priority: 9 },
      { target: "CEILING", roomType: "*", materialId: "mat-ceiling-white", priority: 9 },
      { target: "CABINET", roomType: "*", materialId: "mat-cabinet-wood", priority: 9 },
    ],
    colorRulesJson: [
      { target: "WALL", roomType: "*", colorHex: "#F7F3EC" },
      { target: "CEILING", roomType: "*", colorHex: "#FAFAF8" },
    ],
    lightingJson: {
      cctK: 3800,
      ambientIntensity: 0.6,
      keyIntensity: 1.05,
      lampTypes: [L.PENDANT, L.DOWNLIGHT, L.FLOOR_LAMP],
      night: { cctK: 3000, ambientIntensity: 0.22, keyIntensity: 0.5 },
    },
    furnitureRulesJson: [
      { roomType: "LIVING_DINING", kind: "SOFA", styleHint: "straight", materialHint: "mat-fabric-linen" },
      { roomType: "MASTER_BED", kind: "BED", styleHint: "wood-frame", materialHint: "mat-fabric-linen" },
    ],
    sortOrder: 4,
  },
  {
    id: "new-chinese",
    name: "新中式",
    summary: "东方秩序与现代生活结合，适合改善型住宅。",
    keywords: "东方留白,木格栅,山水意境,对称,雅致",
    palette: "米白、胡桃木、墨色、暖灰",
    materials: "木饰面、石材、宣纸纹理、金属细节",
    lighting: "暖色重点光、壁灯、隐藏灯带",
    negative: "避免仿古堆砌、红木过重、复杂雕花",
    roomTips: "客厅可做端景，卧室保持轻中式。",
    paletteJson: {
      base: ["#F2EEE7", "#E2DBD0"],
      accent: ["#3A3632"],
      neutral: ["#8C8175", "#3A3632"],
      wood: "#6B4A32",
      metal: "#8A6E3C",
    },
    materialRulesJson: [
      { target: "FLOOR", roomType: "LIVING_DINING", materialId: "mat-walnut-plank", priority: 1 },
      { target: "FLOOR", roomType: "MASTER_BED", materialId: "mat-walnut-plank", priority: 1 },
      { target: "FLOOR", roomType: "*", materialId: "mat-walnut-plank", priority: 9 },
      { target: "WALL", roomType: "LIVING_DINING", materialId: "mat-wood-veneer", priority: 2 },
      { target: "WALL", roomType: "*", materialId: "mat-latex-warm-white", priority: 9 },
      { target: "CEILING", roomType: "*", materialId: "mat-ceiling-white", priority: 9 },
      { target: "CABINET", roomType: "*", materialId: "mat-cabinet-wood", priority: 9 },
    ],
    colorRulesJson: [
      { target: "WALL", roomType: "*", colorHex: "#F0EBE3" },
      { target: "CEILING", roomType: "*", colorHex: "#FAFAF8" },
    ],
    lightingJson: {
      cctK: 3000,
      ambientIntensity: 0.42,
      keyIntensity: 1.0,
      lampTypes: [L.WALL_LAMP, L.LINEAR, L.PENDANT],
      night: { cctK: 2700, ambientIntensity: 0.18, keyIntensity: 0.55 },
    },
    furnitureRulesJson: [
      { roomType: "LIVING_DINING", kind: "SOFA", styleHint: "symmetric", materialHint: "mat-fabric-linen" },
      { roomType: "MASTER_BED", kind: "BED", styleHint: "wood-frame", materialHint: "mat-fabric-linen" },
    ],
    sortOrder: 5,
  },
  {
    id: "light-luxury",
    name: "轻奢",
    summary: "有精致感但不过度张扬，适合展示型空间。",
    keywords: "轻奢,精致,金属线条,石材纹理,高级软装",
    palette: "米白、香槟金、暖灰、咖色",
    materials: "岩板、金属线条、皮革、丝绒",
    lighting: "水晶感吊灯、灯带、重点射灯",
    negative: "避免土豪金、大面积镜面、过度装饰",
    roomTips: "客餐厅强化仪式感，卧室控制金属比例。",
    paletteJson: {
      base: ["#F3EFE9", "#E4DCCF"],
      accent: ["#C9A55C"],
      neutral: ["#9C8E7C", "#C9A55C"],
      wood: "#6B4A32",
      metal: "#C9A55C",
    },
    materialRulesJson: [
      { target: "FLOOR", roomType: "LIVING_DINING", materialId: "mat-marble-1200", priority: 1 },
      { target: "FLOOR", roomType: "LIVING", materialId: "mat-marble-1200", priority: 1 },
      { target: "FLOOR", roomType: "MASTER_BED", materialId: "mat-walnut-plank", priority: 1 },
      { target: "FLOOR", roomType: "*", materialId: "mat-cream-tile-800", priority: 9 },
      { target: "WALL", roomType: "*", materialId: "mat-latex-cream", priority: 9 },
      { target: "CEILING", roomType: "*", materialId: "mat-ceiling-white", priority: 9 },
      { target: "CABINET", roomType: "*", materialId: "mat-cabinet-dark", priority: 9 },
    ],
    colorRulesJson: [
      { target: "WALL", roomType: "*", colorHex: "#EFE7DA" },
      { target: "CEILING", roomType: "*", colorHex: "#FAFAF8" },
    ],
    lightingJson: {
      cctK: 3000,
      ambientIntensity: 0.4,
      keyIntensity: 1.15,
      lampTypes: [L.PENDANT, L.SPOT, L.LINEAR],
      night: { cctK: 2700, ambientIntensity: 0.18, keyIntensity: 0.6 },
    },
    furnitureRulesJson: [
      { roomType: "LIVING_DINING", kind: "SOFA", styleHint: "tufted", materialHint: "mat-fabric-velvet" },
      { roomType: "MASTER_BED", kind: "BED", styleHint: "upholstered", materialHint: "mat-fabric-velvet" },
    ],
    sortOrder: 6,
  },
  {
    id: "wabi-sabi",
    name: "侘寂风",
    summary: "安静、质朴、低饱和，强调肌理和留白。",
    keywords: "侘寂,微水泥,自然肌理,低饱和,留白",
    palette: "灰米、砂岩、泥土色、淡褐",
    materials: "微水泥、艺术漆、亚麻、粗陶",
    lighting: "柔和漫反射、壁龛灯、低亮度灯带",
    negative: "避免高亮金属、强色彩和复杂图案",
    roomTips: "适合卧室、书房和静谧客厅。",
    paletteJson: {
      base: ["#EDEAE4", "#DDD8CE"],
      accent: ["#8E8375"],
      neutral: ["#A9A29A", "#8E8375"],
      wood: "#A08155",
      metal: "#7A7A72",
    },
    materialRulesJson: [
      { target: "FLOOR", roomType: "LIVING_DINING", materialId: "mat-micro-cement", priority: 1 },
      { target: "FLOOR", roomType: "MASTER_BED", materialId: "mat-micro-cement", priority: 1 },
      { target: "FLOOR", roomType: "*", materialId: "mat-micro-cement", priority: 9 },
      { target: "WALL", roomType: "*", materialId: "mat-latex-grey", priority: 9 },
      { target: "CEILING", roomType: "*", materialId: "mat-ceiling-white", priority: 9 },
      { target: "CABINET", roomType: "*", materialId: "mat-cabinet-wood", priority: 9 },
    ],
    colorRulesJson: [
      { target: "WALL", roomType: "*", colorHex: "#E2DDD4" },
      { target: "CEILING", roomType: "*", colorHex: "#F7F5F1" },
    ],
    lightingJson: {
      cctK: 2900,
      ambientIntensity: 0.55,
      keyIntensity: 0.7,
      lampTypes: [L.LINEAR, L.WALL_LAMP, L.FLOOR_LAMP],
      night: { cctK: 2600, ambientIntensity: 0.2, keyIntensity: 0.35 },
    },
    furnitureRulesJson: [
      { roomType: "LIVING_DINING", kind: "SOFA", styleHint: "low", materialHint: "mat-fabric-linen" },
      { roomType: "MASTER_BED", kind: "BED", styleHint: "low-platform", materialHint: "mat-fabric-linen" },
    ],
    sortOrder: 7,
  },
  {
    id: "french",
    name: "法式",
    summary: "浪漫精致，以线条、比例和柔和色彩为主。",
    keywords: "法式线条,拱门,石膏线,复古,浪漫",
    palette: "象牙白、浅粉灰、奶咖、黄铜",
    materials: "石膏线、鱼骨拼地板、绒布、黄铜",
    lighting: "复古吊灯、壁灯、暖色氛围光",
    negative: "避免过多雕花、浓重宫廷感",
    roomTips: "小户型可用轻法式，减少厚重造型。",
    paletteJson: {
      base: ["#F7F1EA", "#EDE0D4"],
      accent: ["#C9A55C"],
      neutral: ["#B9A794", "#C9A55C"],
      wood: "#CBA97E",
      metal: "#C9A55C",
    },
    materialRulesJson: [
      { target: "FLOOR", roomType: "LIVING_DINING", materialId: "mat-herringbone-oak", priority: 1 },
      { target: "FLOOR", roomType: "MASTER_BED", materialId: "mat-herringbone-oak", priority: 1 },
      { target: "FLOOR", roomType: "*", materialId: "mat-cream-tile-800", priority: 9 },
      { target: "WALL", roomType: "*", materialId: "mat-latex-cream", priority: 9 },
      { target: "CEILING", roomType: "*", materialId: "mat-ceiling-white", priority: 9 },
      { target: "CABINET", roomType: "*", materialId: "mat-cabinet-frosted", priority: 9 },
    ],
    colorRulesJson: [
      { target: "WALL", roomType: "*", colorHex: "#F5ECE2" },
      { target: "CEILING", roomType: "*", colorHex: "#FAFAF8" },
    ],
    lightingJson: {
      cctK: 3000,
      ambientIntensity: 0.48,
      keyIntensity: 1.0,
      lampTypes: [L.PENDANT, L.WALL_LAMP, L.LINEAR],
      night: { cctK: 2700, ambientIntensity: 0.2, keyIntensity: 0.5 },
    },
    furnitureRulesJson: [
      { roomType: "LIVING_DINING", kind: "SOFA", styleHint: "curved", materialHint: "mat-fabric-velvet" },
      { roomType: "MASTER_BED", kind: "BED", styleHint: "upholstered", materialHint: "mat-fabric-velvet" },
    ],
    sortOrder: 8,
  },
  {
    id: "nordic",
    name: "北欧",
    summary: "清爽实用，色彩轻快，家具尺度友好。",
    keywords: "北欧,浅木,白墙,功能家具,清爽",
    palette: "白色、浅灰、浅木、低饱和蓝绿",
    materials: "木地板、棉麻、白色柜体、简洁瓷砖",
    lighting: "自然光、简洁吊灯、功能台灯",
    negative: "避免厚重深色和复杂吊顶",
    roomTips: "适合小户型和年轻家庭。",
    paletteJson: {
      base: ["#FBF9F5", "#F0EDE6"],
      accent: ["#7C9AA6"],
      neutral: ["#B5B2AC", "#7C9AA6"],
      wood: "#CBA97E",
      metal: "#9A9A9A",
    },
    materialRulesJson: [
      { target: "FLOOR", roomType: "LIVING_DINING", materialId: "mat-oak-plank", priority: 1 },
      { target: "FLOOR", roomType: "MASTER_BED", materialId: "mat-oak-plank", priority: 1 },
      { target: "FLOOR", roomType: "*", materialId: "mat-oak-plank", priority: 9 },
      { target: "WALL", roomType: "*", materialId: "mat-latex-warm-white", priority: 9 },
      { target: "CEILING", roomType: "*", materialId: "mat-ceiling-white", priority: 9 },
      { target: "CABINET", roomType: "*", materialId: "mat-cabinet-frosted", priority: 9 },
    ],
    colorRulesJson: [
      { target: "WALL", roomType: "*", colorHex: "#FAF8F4" },
      { target: "CEILING", roomType: "*", colorHex: "#FFFFFF" },
    ],
    lightingJson: {
      cctK: 4200,
      ambientIntensity: 0.62,
      keyIntensity: 1.0,
      lampTypes: [L.PENDANT, L.DOWNLIGHT, L.FLOOR_LAMP],
      night: { cctK: 3200, ambientIntensity: 0.24, keyIntensity: 0.5 },
    },
    furnitureRulesJson: [
      { roomType: "LIVING_DINING", kind: "SOFA", styleHint: "straight", materialHint: "mat-fabric-linen" },
      { roomType: "MASTER_BED", kind: "BED", styleHint: "wood-frame", materialHint: "mat-fabric-linen" },
    ],
    sortOrder: 9,
  },
  {
    id: "japanese",
    name: "日式",
    summary: "低矮、克制、温和，强调收纳和秩序。",
    keywords: "日式,榻榻米,移门,低矮家具,收纳",
    palette: "米白、浅木、草编色、暖灰",
    materials: "木格栅、障子门、榻榻米、棉麻",
    lighting: "纸灯、暖光、低位照明",
    negative: "避免高反光材料和强对比",
    roomTips: "适合书房、卧室和多功能房。",
    paletteJson: {
      base: ["#F6F2EA", "#E8E0D2"],
      accent: ["#8E7F68"],
      neutral: ["#B0A48E", "#8E7F68"],
      wood: "#BE9B72",
      metal: "#8A8272",
    },
    materialRulesJson: [
      { target: "FLOOR", roomType: "LIVING_DINING", materialId: "mat-oak-plank", priority: 1 },
      { target: "FLOOR", roomType: "MASTER_BED", materialId: "mat-oak-plank", priority: 1 },
      { target: "FLOOR", roomType: "STUDY", materialId: "mat-oak-plank", priority: 1 },
      { target: "FLOOR", roomType: "*", materialId: "mat-oak-plank", priority: 9 },
      { target: "WALL", roomType: "*", materialId: "mat-latex-warm-white", priority: 9 },
      { target: "CEILING", roomType: "*", materialId: "mat-ceiling-white", priority: 9 },
      { target: "CABINET", roomType: "*", materialId: "mat-cabinet-wood", priority: 9 },
    ],
    colorRulesJson: [
      { target: "WALL", roomType: "*", colorHex: "#F4EFE6" },
      { target: "CEILING", roomType: "*", colorHex: "#FAFAF7" },
    ],
    lightingJson: {
      cctK: 3200,
      ambientIntensity: 0.55,
      keyIntensity: 0.85,
      lampTypes: [L.PENDANT, L.LINEAR, L.FLOOR_LAMP],
      night: { cctK: 2800, ambientIntensity: 0.22, keyIntensity: 0.4 },
    },
    furnitureRulesJson: [
      { roomType: "LIVING_DINING", kind: "SOFA", styleHint: "low", materialHint: "mat-fabric-linen" },
      { roomType: "MASTER_BED", kind: "BED", styleHint: "low-platform", materialHint: "mat-fabric-linen" },
    ],
    sortOrder: 10,
  },
  {
    id: "industrial",
    name: "工业风",
    summary: "粗粝、个性，适合开放式和年轻化空间。",
    keywords: "工业风,裸露管线,水泥,黑铁,复古皮革",
    palette: "水泥灰、黑色、锈红、深木",
    materials: "水泥漆、黑铁、砖墙、皮革",
    lighting: "轨道灯、复古灯泡、重点照明",
    negative: "避免过暗压抑和过多硬质材料",
    roomTips: "小户型需提高亮度和收纳比例。",
    paletteJson: {
      base: ["#E4E2DE", "#C9C6C0"],
      accent: ["#7A4A38"],
      neutral: ["#8A8A85", "#7A4A38"],
      wood: "#6B4A32",
      metal: "#2E2E2E",
    },
    materialRulesJson: [
      { target: "FLOOR", roomType: "LIVING_DINING", materialId: "mat-micro-cement", priority: 1 },
      { target: "FLOOR", roomType: "*", materialId: "mat-micro-cement", priority: 9 },
      { target: "WALL", roomType: "*", materialId: "mat-cement-paint", priority: 9 },
      { target: "CEILING", roomType: "*", materialId: "mat-ceiling-white", priority: 9 },
      { target: "CABINET", roomType: "*", materialId: "mat-cabinet-dark", priority: 9 },
    ],
    colorRulesJson: [
      { target: "WALL", roomType: "*", colorHex: "#A9A6A1" },
      { target: "CEILING", roomType: "*", colorHex: "#D6D4D0" },
    ],
    lightingJson: {
      cctK: 3000,
      ambientIntensity: 0.38,
      keyIntensity: 1.2,
      lampTypes: [L.TRACK, L.SPOT, L.PENDANT],
      night: { cctK: 2600, ambientIntensity: 0.16, keyIntensity: 0.7 },
    },
    furnitureRulesJson: [
      { roomType: "LIVING_DINING", kind: "SOFA", styleHint: "leather", materialHint: "mat-fabric-grey" },
      { roomType: "MASTER_BED", kind: "BED", styleHint: "iron-frame", materialHint: "mat-fabric-grey" },
    ],
    sortOrder: 11,
  },
  {
    id: "american",
    name: "美式",
    summary: "舒适稳重，强调家具体量和生活感。",
    keywords: "美式,壁炉感,护墙板,舒适沙发,复古",
    palette: "米色、咖色、橄榄绿、深木",
    materials: "护墙板、实木家具、布艺、仿古砖",
    lighting: "吊灯、壁灯、台灯多层照明",
    negative: "避免家具过大导致动线拥挤",
    roomTips: "适合面积较大的客餐厅和主卧。",
    paletteJson: {
      base: ["#F1EBE0", "#E0D5C2"],
      accent: ["#6E6A4E"],
      neutral: ["#A2907A", "#6E6A4E"],
      wood: "#6B4A32",
      metal: "#8A6E3C",
    },
    materialRulesJson: [
      { target: "FLOOR", roomType: "LIVING_DINING", materialId: "mat-walnut-plank", priority: 1 },
      { target: "FLOOR", roomType: "MASTER_BED", materialId: "mat-walnut-plank", priority: 1 },
      { target: "FLOOR", roomType: "*", materialId: "mat-walnut-plank", priority: 9 },
      { target: "WALL", roomType: "*", materialId: "mat-wood-veneer", priority: 9 },
      { target: "CEILING", roomType: "*", materialId: "mat-ceiling-white", priority: 9 },
      { target: "CABINET", roomType: "*", materialId: "mat-cabinet-wood", priority: 9 },
    ],
    colorRulesJson: [
      { target: "WALL", roomType: "*", colorHex: "#E6DCCB" },
      { target: "CEILING", roomType: "*", colorHex: "#FAF8F4" },
    ],
    lightingJson: {
      cctK: 3000,
      ambientIntensity: 0.45,
      keyIntensity: 1.05,
      lampTypes: [L.PENDANT, L.WALL_LAMP, L.FLOOR_LAMP],
      night: { cctK: 2700, ambientIntensity: 0.2, keyIntensity: 0.6 },
    },
    furnitureRulesJson: [
      { roomType: "LIVING_DINING", kind: "SOFA", styleHint: "oversized", materialHint: "mat-fabric-velvet" },
      { roomType: "MASTER_BED", kind: "BED", styleHint: "wood-frame", materialHint: "mat-fabric-velvet" },
    ],
    sortOrder: 12,
  },
  {
    id: "smart-tech",
    name: "智能科技",
    summary: "整洁、未来感，强调智能家居和灯光控制。",
    keywords: "智能家居,科技感,隐藏设备,灯光场景,简洁",
    palette: "白色、深灰、黑色、少量蓝色光感",
    materials: "玻璃、金属、哑光柜体、科技面板",
    lighting: "可调色温灯带、感应灯、场景灯光",
    negative: "避免过度蓝光和冰冷机房感",
    roomTips: "适合客厅、影音房和全屋智能展示。",
    paletteJson: {
      base: ["#F0F2F4", "#DFE3E8"],
      accent: ["#3B82F6"],
      neutral: ["#8A8F96", "#3B82F6"],
      wood: "#7A7A7A",
      metal: "#B8BCC2",
    },
    materialRulesJson: [
      { target: "FLOOR", roomType: "LIVING_DINING", materialId: "mat-grey-tile-800", priority: 1 },
      { target: "FLOOR", roomType: "*", materialId: "mat-grey-tile-800", priority: 9 },
      { target: "WALL", roomType: "*", materialId: "mat-latex-grey", priority: 9 },
      { target: "CEILING", roomType: "*", materialId: "mat-ceiling-white", priority: 9 },
      { target: "CABINET", roomType: "*", materialId: "mat-cabinet-dark", priority: 9 },
    ],
    colorRulesJson: [
      { target: "WALL", roomType: "*", colorHex: "#E6E9ED" },
      { target: "CEILING", roomType: "*", colorHex: "#F5F7F9" },
    ],
    lightingJson: {
      cctK: 4500,
      ambientIntensity: 0.5,
      keyIntensity: 1.1,
      lampTypes: [L.LINEAR, L.DOWNLIGHT, L.TRACK],
      night: { cctK: 3000, ambientIntensity: 0.2, keyIntensity: 0.55 },
    },
    furnitureRulesJson: [
      { roomType: "LIVING_DINING", kind: "SOFA", styleHint: "straight", materialHint: "mat-fabric-grey" },
      { roomType: "MASTER_BED", kind: "BED", styleHint: "low-profile", materialHint: "mat-fabric-grey" },
    ],
    sortOrder: 13,
  },
  {
    id: "family-warm",
    name: "亲子温馨",
    summary: "安全、柔和、耐用，适合有儿童的家庭。",
    keywords: "亲子,圆角,安全,耐污,活泼温暖",
    palette: "暖白、浅木、浅黄、低饱和彩色",
    materials: "环保板材、软包、耐污涂料、防滑地面",
    lighting: "柔光、夜灯、均匀照明",
    negative: "避免尖锐家具、玻璃过多和难清洁材质",
    roomTips: "儿童活动区重视安全边界和收纳。",
    paletteJson: {
      base: ["#FAF6EE", "#F0E7D4"],
      accent: ["#E0B878"],
      neutral: ["#B6A98F", "#E0B878"],
      wood: "#CBA97E",
      metal: "#9A9A9A",
    },
    materialRulesJson: [
      { target: "FLOOR", roomType: "LIVING_DINING", materialId: "mat-oak-plank", priority: 1 },
      { target: "FLOOR", roomType: "CHILD_BED", materialId: "mat-oak-plank", priority: 1 },
      { target: "FLOOR", roomType: "BATH", materialId: "mat-anti-slip-tile", priority: 1 },
      { target: "FLOOR", roomType: "*", materialId: "mat-oak-plank", priority: 9 },
      { target: "WALL", roomType: "*", materialId: "mat-latex-warm-white", priority: 9 },
      { target: "CEILING", roomType: "*", materialId: "mat-ceiling-white", priority: 9 },
      { target: "CABINET", roomType: "*", materialId: "mat-cabinet-frosted", priority: 9 },
    ],
    colorRulesJson: [
      { target: "WALL", roomType: "*", colorHex: "#F8F3E9" },
      { target: "CEILING", roomType: "*", colorHex: "#FFFFFF" },
    ],
    lightingJson: {
      cctK: 4000,
      ambientIntensity: 0.68,
      keyIntensity: 0.9,
      lampTypes: [L.DOWNLIGHT, L.PENDANT, L.LINEAR],
      night: { cctK: 3000, ambientIntensity: 0.28, keyIntensity: 0.4 },
    },
    furnitureRulesJson: [
      { roomType: "LIVING_DINING", kind: "SOFA", styleHint: "rounded", materialHint: "mat-fabric-cream" },
      { roomType: "CHILD_BED", kind: "BED", styleHint: "rounded", materialHint: "mat-fabric-cream" },
    ],
    sortOrder: 14,
  },
  {
    id: "senior-friendly",
    name: "适老舒适",
    summary: "安全、明亮、易维护，适合长辈居住。",
    keywords: "适老化,防滑,明亮,扶手,无障碍",
    palette: "暖白、浅木、米色、柔和灰",
    materials: "防滑地材、圆角家具、易清洁墙面",
    lighting: "高显色照明、夜间感应灯、无眩光",
    negative: "避免地面高差、强反光和过暗色调",
    roomTips: "卫生间、卧室和过道优先考虑安全。",
    paletteJson: {
      base: ["#F7F4EE", "#EAE3D6"],
      accent: ["#A89478"],
      neutral: ["#B3AB9C", "#A89478"],
      wood: "#CBA97E",
      metal: "#9A9A9A",
    },
    materialRulesJson: [
      { target: "FLOOR", roomType: "BATH", materialId: "mat-anti-slip-tile", priority: 1 },
      { target: "FLOOR", roomType: "KITCHEN", materialId: "mat-anti-slip-tile", priority: 1 },
      { target: "FLOOR", roomType: "*", materialId: "mat-wood-tile-1200", priority: 9 },
      { target: "WALL", roomType: "*", materialId: "mat-latex-warm-white", priority: 9 },
      { target: "CEILING", roomType: "*", materialId: "mat-ceiling-white", priority: 9 },
      { target: "CABINET", roomType: "*", materialId: "mat-cabinet-frosted", priority: 9 },
    ],
    colorRulesJson: [
      { target: "WALL", roomType: "*", colorHex: "#F5F1E8" },
      { target: "CEILING", roomType: "*", colorHex: "#FFFFFF" },
    ],
    lightingJson: {
      cctK: 4200,
      ambientIntensity: 0.8,
      keyIntensity: 0.95,
      lampTypes: [L.DOWNLIGHT, L.LINEAR, L.WALL_LAMP],
      night: { cctK: 3200, ambientIntensity: 0.3, keyIntensity: 0.45 },
    },
    furnitureRulesJson: [
      { roomType: "LIVING_DINING", kind: "SOFA", styleHint: "firm", materialHint: "mat-fabric-cream" },
      { roomType: "ELDER_BED", kind: "BED", styleHint: "firm", materialHint: "mat-fabric-cream" },
    ],
    sortOrder: 15,
  },
  {
    id: "boutique-hotel",
    name: "精品酒店风",
    summary: "有度假感和仪式感，强调灯光、材质和软装。",
    keywords: "精品酒店,度假感,套房,精致灯光,高级床品",
    palette: "暖灰、米咖、深木、黄铜点缀",
    materials: "石材、木饰面、织物硬包、金属细节",
    lighting: "多层灯光、床头吊灯、氛围灯带",
    negative: "避免商业感过重和维护困难材料",
    roomTips: "主卧、卫生间和客厅可增强酒店式体验。",
    paletteJson: {
      base: ["#EFEBE4", "#DED5C8"],
      accent: ["#C9A55C"],
      neutral: ["#94897A", "#C9A55C"],
      wood: "#6B4A32",
      metal: "#C9A55C",
    },
    materialRulesJson: [
      { target: "FLOOR", roomType: "LIVING_DINING", materialId: "mat-marble-1200", priority: 1 },
      { target: "FLOOR", roomType: "MASTER_BED", materialId: "mat-walnut-plank", priority: 1 },
      { target: "FLOOR", roomType: "BATH", materialId: "mat-stone-dark", priority: 1 },
      { target: "FLOOR", roomType: "*", materialId: "mat-walnut-plank", priority: 9 },
      { target: "WALL", roomType: "MASTER_BED", materialId: "mat-fabric-wall", priority: 2 },
      { target: "WALL", roomType: "*", materialId: "mat-latex-grey", priority: 9 },
      { target: "CEILING", roomType: "*", materialId: "mat-ceiling-white", priority: 9 },
      { target: "CABINET", roomType: "*", materialId: "mat-cabinet-dark", priority: 9 },
    ],
    colorRulesJson: [
      { target: "WALL", roomType: "*", colorHex: "#E7E1D7" },
      { target: "CEILING", roomType: "*", colorHex: "#FAF8F5" },
    ],
    lightingJson: {
      cctK: 2900,
      ambientIntensity: 0.38,
      keyIntensity: 1.1,
      lampTypes: [L.PENDANT, L.WALL_LAMP, L.LINEAR, L.SPOT],
      night: { cctK: 2600, ambientIntensity: 0.16, keyIntensity: 0.6 },
    },
    furnitureRulesJson: [
      { roomType: "LIVING_DINING", kind: "SOFA", styleHint: "upholstered", materialHint: "mat-fabric-velvet" },
      { roomType: "MASTER_BED", kind: "BED", styleHint: "upholstered", materialHint: "mat-fabric-velvet" },
    ],
    sortOrder: 16,
  },
];

export const styleById = new Map(designStyles.map((s) => [s.id, s]));

/** 取某风格下、某目标+房间的推荐材质，priority 小者优先；无匹配返回 null */
export function matchMaterial(
  styleId: string,
  target: MaterialRule["target"],
  roomType: string,
): string | null {
  const style = styleById.get(styleId);
  if (!style) return null;
  const hits = style.materialRulesJson
    .filter((r) => r.target === target && (r.roomType === roomType || r.roomType === "*"))
    .sort((a, b) => {
      // 精确房间规则优先于通配规则
      const sa = a.roomType === "*" ? 1 : 0;
      const sb = b.roomType === "*" ? 1 : 0;
      if (sa !== sb) return sa - sb;
      return a.priority - b.priority;
    });
  return hits.length > 0 ? hits[0].materialId : null;
}

/** 取某风格下、某目标+房间的推荐颜色 */
export function matchColor(
  styleId: string,
  target: ColorRule["target"],
  roomType: string,
): string | null {
  const style = styleById.get(styleId);
  if (!style) return null;
  const hits = style.colorRulesJson
    .filter((r) => r.target === target && (r.roomType === roomType || r.roomType === "*"))
    .sort((a, b) => {
      const sa = a.roomType === "*" ? 1 : 0;
      const sb = b.roomType === "*" ? 1 : 0;
      if (sa !== sb) return sa - sb;
      return 0;
    });
  return hits.length > 0 ? hits[0].colorHex : null;
}
