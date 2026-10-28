/**
 * 值域常量。
 *
 * SQLite 不支持原生枚举，Prisma schema 中所有枚举字段以 String 存储，
 * 这里提供同名的 TS 联合类型作为编译期保证。
 */

// 页面类型
export const PAGE_KIND = {
  BLUEPRINT: "BLUEPRINT", // 户型平面图 → 进入识别管线
  MARKETING: "MARKETING", // 营销鉴赏页 → 转为风格情绪板素材
  UNKNOWN: "UNKNOWN", // 需人工点选
} as const;
export type PageKind = (typeof PAGE_KIND)[keyof typeof PAGE_KIND];

// 房间类型
export const ROOM_TYPE = {
  LIVING_DINING: "LIVING_DINING",
  LIVING: "LIVING",
  DINING: "DINING",
  KITCHEN: "KITCHEN",
  BATH: "BATH",
  MASTER_BED: "MASTER_BED",
  BED: "BED",
  CHILD_BED: "CHILD_BED",
  ELDER_BED: "ELDER_BED",
  STUDY: "STUDY",
  CLOAK: "CLOAK",
  STORAGE: "STORAGE",
  BALCONY: "BALCONY",
  ENTRY: "ENTRY",
  HALLWAY: "HALLWAY",
  MULTI: "MULTI",
  OTHER: "OTHER",
} as const;
export type RoomType = (typeof ROOM_TYPE)[keyof typeof ROOM_TYPE];

export const ROOM_TYPE_LABEL: Record<RoomType, string> = {
  LIVING_DINING: "客餐厅",
  LIVING: "客厅",
  DINING: "餐厅",
  KITCHEN: "厨房",
  BATH: "卫生间",
  MASTER_BED: "主卧",
  BED: "次卧",
  CHILD_BED: "儿童房",
  ELDER_BED: "老人房",
  STUDY: "书房",
  CLOAK: "衣帽间",
  STORAGE: "储藏间",
  BALCONY: "阳台",
  ENTRY: "玄关",
  HALLWAY: "走道",
  MULTI: "多功能房",
  OTHER: "其他",
};

/** VLM 分类提示词里使用的中文类型名（与 ROOM_TYPE_LABEL 一一对应） */
export const ROOM_TYPE_VLM_LIST = Object.values(ROOM_TYPE_LABEL).join("|");

// 开口类型
export const OPENING_KIND = {
  DOOR: "DOOR",
  WINDOW: "WINDOW",
  ARCH: "ARCH",
} as const;
export type OpeningKind = (typeof OPENING_KIND)[keyof typeof OPENING_KIND];

// 比例标定来源
export const SCALE_SOURCE = {
  VLM_DIM: "VLM_DIM",
  MODULE_SEARCH: "MODULE_SEARCH",
  DPI_META: "DPI_META",
  MANUAL: "MANUAL",
} as const;
export type ScaleSource = (typeof SCALE_SOURCE)[keyof typeof SCALE_SOURCE];

// 识别来源
export const RECOG_SOURCE = {
  OCR: "OCR",
  VLM: "VLM",
  CV: "CV",
  DXF: "DXF",
  MANUAL: "MANUAL",
} as const;
export type RecogSource = (typeof RECOG_SOURCE)[keyof typeof RECOG_SOURCE];

// 空间对象类型
export const ELEMENT_KIND = {
  WALL: "WALL",
  FLOOR: "FLOOR",
  CEILING: "CEILING",
  SKIRTING: "SKIRTING",
  DOOR: "DOOR",
  WINDOW: "WINDOW",
  CABINET: "CABINET",
  FURNITURE: "FURNITURE",
  LIGHT: "LIGHT",
  SANITARY: "SANITARY",
  PIER: "PIER",
} as const;
export type ElementKind = (typeof ELEMENT_KIND)[keyof typeof ELEMENT_KIND];

// 装饰构造层
export const LAYER_KIND = {
  STRUCTURE: "STRUCTURE",
  BASE: "BASE",
  DECOR: "DECOR",
  FINISH: "FINISH",
} as const;
export type LayerKind = (typeof LAYER_KIND)[keyof typeof LAYER_KIND];

// 材质类别
export const MATERIAL_CATEGORY = {
  FLOOR: "FLOOR",
  WALL: "WALL",
  CEILING: "CEILING",
  CABINET: "CABINET",
  FABRIC: "FABRIC",
  STONE: "STONE",
  METAL: "METAL",
  GLASS: "GLASS",
  PAINT: "PAINT",
} as const;
export type MaterialCategory =
  (typeof MATERIAL_CATEGORY)[keyof typeof MATERIAL_CATEGORY];

// 铺装样式
export const PATTERN = {
  PLAIN: "PLAIN",
  TILE: "TILE",
  PLANK: "PLANK",
  HERRINGBONE: "HERRINGBONE",
  BRICK: "BRICK",
} as const;
export type Pattern = (typeof PATTERN)[keyof typeof PATTERN];

// 项目工作流状态
export const WORKFLOW_STATUS = {
  CREATED: "CREATED",
  FLOORPLAN_UPLOADED: "FLOORPLAN_UPLOADED",
  PARSED: "PARSED",
  CONFIRMED: "CONFIRMED",
  MODELED: "MODELED",
  DESIGNED: "DESIGNED",
  TOUR_READY: "TOUR_READY",
  PUBLISHED: "PUBLISHED",
} as const;
export type WorkflowStatus =
  (typeof WORKFLOW_STATUS)[keyof typeof WORKFLOW_STATUS];

export const WORKFLOW_LABEL: Record<WorkflowStatus, string> = {
  CREATED: "已创建",
  FLOORPLAN_UPLOADED: "已上传户型图",
  PARSED: "识别完成",
  CONFIRMED: "人工已确认",
  MODELED: "三维已建模",
  DESIGNED: "方案已设计",
  TOUR_READY: "漫游已生成",
  PUBLISHED: "已发布",
};

/** 工作流四步进度条（对应四个核心模块） */
export const WORKFLOW_STEPS: { key: string; label: string; statuses: WorkflowStatus[] }[] = [
  { key: "parse", label: "户型识别", statuses: ["CREATED", "FLOORPLAN_UPLOADED"] },
  { key: "model", label: "三维建模", statuses: ["PARSED", "CONFIRMED"] },
  { key: "design", label: "方案设计", statuses: ["MODELED"] },
  { key: "tour", label: "全景漫游", statuses: ["DESIGNED", "TOUR_READY", "PUBLISHED"] },
];
