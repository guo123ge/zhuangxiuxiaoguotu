import type { PageMetrics } from "./preprocess.ts";
import { PAGE_KIND, type PageKind } from "../enums.ts";

function inRange(v: number, lo: number, hi: number) {
  return v >= lo && v <= hi;
}

/**
 * 页面类型判别：区分「户型平面图」与「营销鉴赏页」。
 *
 * 两类页面在同一份 PDF 认购书里交替出现，若不分流，
 * 营销页会被误当成户型图送进识别管线，产出完全错误的墙体与房间。
 *
 * 判别量实测分布：
 *                  户型图            营销页
 *   whiteRatio     0.64 ~ 0.68      0.41 ~ 0.43
 *   grayRatio      0.83 ~ 0.88      低（照片色彩丰富）
 *   satMean        < 0.12           0.20 ~ 0.28
 *   thinLineDensity 0.05 ~ 0.15     低且分散
 *   maxColorBlock  0（仅小色块）     大（整幅照片）
 */
export function routePage(m: PageMetrics): PageKind {
  let s = 0;

  if (inRange(m.whiteRatio, 0.55, 0.92)) s += 2;
  else if (m.whiteRatio < 0.55) s -= 1;

  if (m.grayRatio > 0.75) s += 2;
  else if (m.grayRatio < 0.45) s -= 2;

  if (m.satMean < 0.15) s += 1;
  else if (m.satMean > 0.25) s -= 2;

  if (m.thinLineDensity > 0.03) s += 2;
  else s -= 1;

  // 大面积饱和色块 = 照片区域 = 营销页的强特征
  if (m.maxColorBlock > 0.05) s -= 3;
  else s += 1;

  // 营销页的"照片+文字"覆盖率高，户型图线稿墨迹稀疏
  if (m.inkRatio > 0.4) s -= 2;
  else if (m.inkRatio < 0.35) s += 1;

  if (s >= 3) return PAGE_KIND.BLUEPRINT;
  if (s <= -2) return PAGE_KIND.MARKETING;
  return PAGE_KIND.UNKNOWN;
}

/** 判别明细，供 UI 与调试展示 */
export function routePageDetail(m: PageMetrics) {
  const reasons: string[] = [];
  if (inRange(m.whiteRatio, 0.5, 0.85)) reasons.push("白底比例符合线稿特征");
  else if (m.whiteRatio < 0.35) reasons.push("白底比例偏低，疑似照片页");

  if (m.grayRatio > 0.75) reasons.push("近灰度像素占比高");
  else if (m.grayRatio < 0.45) reasons.push("彩色像素占比高，疑似照片页");

  if (m.satMean < 0.15) reasons.push("整体饱和度低");
  else if (m.satMean > 0.25) reasons.push("整体饱和度高，疑似照片页");

  if (m.thinLineDensity > 0.03) reasons.push("细线密度高，符合图纸特征");
  else reasons.push("细线密度低");

  if (m.maxColorBlock > 0.05) reasons.push("存在大面积照片区域");

  return {
    kind: routePage(m),
    reasons,
    metrics: {
      whiteRatio: Number(m.whiteRatio.toFixed(3)),
      grayRatio: Number(m.grayRatio.toFixed(3)),
      satMean: Number(m.satMean.toFixed(3)),
      thinLineDensity: Number(m.thinLineDensity.toFixed(3)),
      maxColorBlock: Number(m.maxColorBlock.toFixed(3)),
      inkRatio: Number(m.inkRatio.toFixed(3)),
      skewDeg: Number(m.estimatedSkewDeg.toFixed(2)),
    },
  };
}
