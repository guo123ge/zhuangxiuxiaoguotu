/**
 * 内置标准户型图库。
 *
 * 对应需求「支持用户上传或下载标准户型图」：
 *   - 下载：用户可直接下载这些标准户型图作为测试素材
 *   - 加载：一键加载进项目，无需先有户型图即可体验全流程
 *
 * referenceScaleMmPerPx 是实测标定值（由尺寸链像素跨度 ÷ 标注毫米数得出），
 * 仅用于回归测试验证识别算法的比例标定精度，不参与实际识别流程
 * （实际识别必须独立标定，否则算法等于作弊）。
 */

export type SampleFloorplan = {
  id: string;
  name: string;
  /** 户型编号 */
  unitNo: string;
  /** 建筑面积（m2，认购书口径） */
  grossAreaM2: number;
  fileUrl: string;
  previewUrl: string;
  width: number;
  height: number;
  /** 实测参考比例，仅用于回归测试 */
  referenceScaleMmPerPx: number;
  /** 外轮廓尺寸链标注总和（mm），用于闭合误差回归断言 */
  chainTopMm: number;
  chainBottomMm: number;
  chainLeftMm: number;
  chainRightMm: number;
  note: string;
};

export const sampleFloorplans: SampleFloorplan[] = [
  {
    id: "yunkun",
    name: "雲崑",
    unitNo: "A户型",
    grossAreaM2: 143,
    fileUrl: "/samples/floorplans/yunkun.png",
    previewUrl: "/samples/floorplans/yunkun.png",
    width: 1195,
    height: 1323,
    referenceScaleMmPerPx: 19.85,
    chainTopMm: 18600,
    chainBottomMm: 18600,
    chainLeftMm: 14950,
    chainRightMm: 18650,
    note: "四房两厅，含中西双厨与总统级主卧套房",
  },
  {
    id: "yunlang",
    name: "雲琅",
    unitNo: "B户型",
    grossAreaM2: 128,
    fileUrl: "/samples/floorplans/yunlang.png",
    previewUrl: "/samples/floorplans/yunlang.png",
    width: 1346,
    height: 1060,
    referenceScaleMmPerPx: 16.19,
    chainTopMm: 17400,
    chainBottomMm: 17700,
    chainLeftMm: 12800,
    chainRightMm: 12800,
    note: "三房两厅，动静分区",
  },
  {
    id: "yunque",
    name: "雲阙",
    unitNo: "C户型",
    grossAreaM2: 138,
    fileUrl: "/samples/floorplans/yunque.png",
    previewUrl: "/samples/floorplans/yunque.png",
    width: 1338,
    height: 1158,
    referenceScaleMmPerPx: 16.65,
    chainTopMm: 18400,
    chainBottomMm: 18200,
    chainLeftMm: 14850,
    chainRightMm: 13650,
    note: "四房两厅，仪式中轴玄关",
  },
  {
    id: "yao-a",
    name: "雲曜A",
    unitNo: "D1户型",
    grossAreaM2: 118,
    fileUrl: "/samples/floorplans/yao-a.png",
    previewUrl: "/samples/floorplans/yao-a.png",
    width: 1303,
    height: 1049,
    referenceScaleMmPerPx: 15.27,
    chainTopMm: 16200,
    chainBottomMm: 16450,
    chainLeftMm: 12100,
    chainRightMm: 11900,
    note: "三房两厅，超极全景舱",
  },
  {
    id: "yao-b",
    name: "雲曜B",
    unitNo: "D2户型",
    grossAreaM2: 116,
    fileUrl: "/samples/floorplans/yao-b.png",
    previewUrl: "/samples/floorplans/yao-b.png",
    width: 1268,
    height: 1042,
    referenceScaleMmPerPx: 15.33,
    chainTopMm: 16200,
    chainBottomMm: 16200,
    chainLeftMm: 12100,
    chainRightMm: 11900,
    note: "三房两厅，超级可变空间",
  },
];

/** 内置风格情绪板素材（营销鉴赏页，仅作风格参考，不参与识别） */
export type SampleStyleImage = {
  id: string;
  name: string;
  fileUrl: string;
};

export const sampleStyleImages: SampleStyleImage[] = [
  { id: "mkt-yunkun", name: "雲崑 鉴赏页", fileUrl: "/samples/styles/yunkun-2.png" },
  { id: "mkt-yunque", name: "雲阙 鉴赏页", fileUrl: "/samples/styles/yunque-2.png" },
  { id: "mkt-yao-a", name: "雲曜A 鉴赏页", fileUrl: "/samples/styles/yao-a-2.png" },
  { id: "mkt-yao-b", name: "雲曜B 鉴赏页", fileUrl: "/samples/styles/yao-b-2.png" },
];
