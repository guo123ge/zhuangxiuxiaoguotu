import type { ColorMasks } from "./colorLayer.ts";

/** 一条尺寸线的检测结果 */
export type ChainLine = {
  /** 线的像素长度（即该侧尺寸链的跨度） */
  lengthPx: number;
  /** 线所在的行/列位置 */
  posPx: number;
  /** 线起点坐标（x 或 y，取决于方向） */
  startPx: number;
  /** 该侧找到的候选长线数（用于判断可靠性） */
  candidateCount: number;
};

export type ChainSet = {
  top: ChainLine;
  bottom: ChainLine;
  left: ChainLine;
  right: ChainLine;
  /** 建筑外轮廓包围盒（像素），由四条尺寸线端点推出 */
  buildingBox: { x0: number; y0: number; x1: number; y1: number };
  /** 建筑宽 / 高（像素） */
  widthPx: number;
  heightPx: number;
  /** 横向 / 纵向尺寸链闭合误差（0-1） */
  hClosureError: number;
  vClosureError: number;
};

function longestInkRunInBand(
  masks: ColorMasks,
  side: "top" | "bottom" | "left" | "right",
): ChainLine {
  const { width, height, ink } = masks;
  const horizontal = side === "top" || side === "bottom";
  const frac = 0.34;

  // 收集所有"长线"候选
  const candidates: { len: number; pos: number; start: number }[] = [];
  let bestLen = 0;
  let bestPos = 0;
  let bestStart = 0;

  const minRun = Math.round((horizontal ? width : height) * 0.28);

  if (horizontal) {
    const y0 = side === "top" ? 0 : Math.floor(height * (1 - frac));
    const y1 = side === "top" ? Math.ceil(height * frac) : height;
    for (let y = y0; y < y1; y++) {
      let run = 0;
      let start = 0;
      for (let x = 0; x < width; x++) {
        if (ink[y * width + x]) {
          if (run === 0) start = x;
          run++;
        } else {
          if (run > minRun) candidates.push({ len: run, pos: y, start });
          if (run > bestLen) {
            bestLen = run;
            bestPos = y;
            bestStart = start;
          }
          run = 0;
        }
      }
      if (run > minRun) candidates.push({ len: run, pos: y, start });
      if (run > bestLen) {
        bestLen = run;
        bestPos = y;
        bestStart = start;
      }
    }
  } else {
    const x0 = side === "left" ? 0 : Math.floor(width * (1 - frac));
    const x1 = side === "left" ? Math.ceil(width * frac) : width;
    for (let x = x0; x < x1; x++) {
      let run = 0;
      let start = 0;
      for (let y = 0; y < height; y++) {
        if (ink[y * width + x]) {
          if (run === 0) start = y;
          run++;
        } else {
          if (run > minRun) candidates.push({ len: run, pos: x, start });
          if (run > bestLen) {
            bestLen = run;
            bestPos = x;
            bestStart = start;
          }
          run = 0;
        }
      }
      if (run > minRun) candidates.push({ len: run, pos: x, start });
      if (run > bestLen) {
        bestLen = run;
        bestPos = x;
        bestStart = start;
      }
    }
  }

  return {
    lengthPx: bestLen,
    posPx: bestPos,
    startPx: bestStart,
    candidateCount: candidates.length,
  };
}

/** 检测四边尺寸链并推出建筑包围盒 */
export function detectChains(masks: ColorMasks): ChainSet {
  const top = longestInkRunInBand(masks, "top");
  const bottom = longestInkRunInBand(masks, "bottom");
  const left = longestInkRunInBand(masks, "left");
  const right = longestInkRunInBand(masks, "right");

  const x0 = Math.min(
    top.startPx || Number.MAX_SAFE_INTEGER,
    bottom.startPx || Number.MAX_SAFE_INTEGER,
  );
  const x1 = Math.max(
    top.startPx + top.lengthPx,
    bottom.startPx + bottom.lengthPx,
  );
  const y0 = Math.min(
    left.startPx || Number.MAX_SAFE_INTEGER,
    right.startPx || Number.MAX_SAFE_INTEGER,
  );
  const y1 = Math.max(
    left.startPx + left.lengthPx,
    right.startPx + right.lengthPx,
  );

  const hasH = top.lengthPx > 0 && bottom.lengthPx > 0;
  const hasV = left.lengthPx > 0 && right.lengthPx > 0;

  const hClosureError = hasH
    ? Math.abs(top.lengthPx - bottom.lengthPx) / Math.max(top.lengthPx, bottom.lengthPx)
    : 1;
  const vClosureError = hasV
    ? Math.abs(left.lengthPx - right.lengthPx) / Math.max(left.lengthPx, right.lengthPx)
    : 1;

  return {
    top,
    bottom,
    left,
    right,
    buildingBox: {
      x0: x0 === Number.MAX_SAFE_INTEGER ? 0 : x0,
      y0: y0 === Number.MAX_SAFE_INTEGER ? 0 : y0,
      x1,
      y1,
    },
    widthPx: Math.max(top.lengthPx, bottom.lengthPx),
    heightPx: Math.max(left.lengthPx, right.lengthPx),
    hClosureError,
    vClosureError,
  };
}

export type ScaleCandidate = {
  mmPerPx: number;
  source: "VLM_DIM" | "MODULE_SEARCH" | "DPI_META" | "MANUAL";
  confidence: number;
  note: string;
};

/**
 * 检测尺寸链上的刻度线位置（段边界）。
 *
 * 尺寸线是一条连续直线，段与段之间有垂直短刻度。
 * 沿线扫过，刻度列 = 垂直方向上墨迹超出线本身的列。
 * 返回刻度横/纵坐标数组（含两端点），升序。
 */
export function detectChainTicks(masks: ColorMasks, chain: ChainLine, side: "top" | "bottom" | "left" | "right"): number[] {
  const { width, height, ink } = masks;
  const horizontal = side === "top" || side === "bottom";
  const ticks: number[] = [];
  const start = chain.startPx;
  const end = chain.startPx + chain.lengthPx;
  if (chain.lengthPx <= 0) return ticks;

  const PROBE = 7; // 线两侧各探 7px
  for (let p = start + 2; p < end - 2; p++) {
    let cross = 0;
    for (let d = -PROBE; d <= PROBE; d++) {
      const x = horizontal ? p : chain.posPx + d;
      const y = horizontal ? chain.posPx + d : p;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      if (ink[y * width + x]) cross++;
    }
    // 刻度列：垂直带内墨迹接近满（线 1-2px + 刻度上下延伸）
    if (cross >= PROBE + 3) ticks.push(p);
  }
  // 相邻刻度列合并（刻度有 1-3px 宽）
  const merged: number[] = [];
  for (const t of ticks) {
    if (merged.length > 0 && t - merged[merged.length - 1] <= 3) continue;
    merged.push(t);
  }
  return [start, ...merged, end];
}

/**
 * 300mm 模数搜索（带刻度分段锚定）。
 *
 * 中国住宅开间/进深以 300mm 为模数。若检测到尺寸链刻度，
 * 则枚举比例 s，最小化「各段吸附到 100mm 倍数」的残差——
 * 段数即独立约束数，远比只对总长做吸附稳健；
 * 无刻度时退化为总长 300mm 吸附。
 */
export function moduleSearch(chains: ChainSet, masks?: ColorMasks): ScaleCandidate | null {
  if (chains.widthPx <= 0 || chains.heightPx <= 0) return null;

  // 收集四边的分段像素长度
  const segs: number[] = [];
  if (masks) {
    for (const side of ["top", "bottom", "left", "right"] as const) {
      const chain = chains[side];
      if (chain.lengthPx <= 0) continue;
      const ticks = detectChainTicks(masks, chain, side);
      for (let i = 0; i + 1 < ticks.length; i++) {
        const len = ticks[i + 1] - ticks[i];
        if (len > 8) segs.push(len); // 滤掉过短的伪段
      }
    }
  }

  if (segs.length >= 6) {
    // 分段锚定搜索：比例范围 6~30 mm/px，步进 0.01
    // 残差按「距最近 50mm 倍数的绝对偏差 / 25mm」归一：
    // 真比例下大多数段就是 50 的倍数（残差≈0），错误比例下
    // 段长在模 50 上均匀分布（残差均值≈0.5）——区分度极强。
    let best: { s: number; err: number } | null = null;
    for (let s = 6; s <= 30; s += 0.01) {
      let err = 0;
      let used = 0;
      for (const px of segs) {
        const mmVal = px * s;
        const snapped50 = Math.round(mmVal / 50) * 50;
        if (snapped50 < 300 || snapped50 > 8000) continue; // 段长合理区间
        const snapped100 = Math.round(mmVal / 100) * 100;
        // 主残差：50mm 模数（覆盖 750/850 半模数段）
        // 次残差：100mm 模数（住宅段多为整百，惩罚减半混叠）——
        //   真比例下 100 残差仅由少量半模数段贡献；
        //   半比例下所有整百段都变成 50 奇倍 → 残差飙升。
        err += Math.min(Math.abs(mmVal - snapped50), 25) / 25
             + 0.5 * Math.min(Math.abs(mmVal - snapped100), 50) / 50;
        used++;
      }
      if (used < segs.length * 0.8) continue;
      err /= used;
      if (!best || err < best.err) best = { s, err };
    }
    if (best) {
      const wMm = chains.widthPx * best.s;
      const hMm = chains.heightPx * best.s;
      const confidence = Math.max(0.35, Math.min(0.88, 0.88 - best.err * 1.5));
      return {
        mmPerPx: Number(best.s.toFixed(3)),
        source: "MODULE_SEARCH",
        confidence: Number(confidence.toFixed(3)),
        note: `按 ${segs.length} 个尺寸段吸附推定：总宽 ${(wMm / 1000).toFixed(2)}m × 总高 ${(hMm / 1000).toFixed(2)}m（段残差 ${(best.err * 100).toFixed(1)}%）`,
      };
    }
  }

  // ── 退化路径：总长 300mm 吸附 ──
  const STEP = 300;
  let best: { s: number; err: number; wMm: number; hMm: number } | null = null;
  for (let wMm = 9000; wMm <= 24000; wMm += STEP) {
    const s = wMm / chains.widthPx;
    if (s < 6 || s > 30) continue;
    const hMmRaw = chains.heightPx * s;
    const hMm = Math.round(hMmRaw / STEP) * STEP;
    const errH = Math.abs(hMmRaw - hMm) / hMm;
    if (hMm < 5000 || hMm > 24000) continue;
    const aspect = wMm / hMm;
    if (aspect < 0.4 || aspect > 2.2) continue;
    const err = errH + (aspect > 1 ? 0 : 0.15);
    if (!best || err < best.err) best = { s, err, wMm, hMm };
  }

  if (!best) return null;
  const closurePenalty = 1 - Math.min(chains.hClosureError, 0.3);
  const confidence = Math.max(0.25, Math.min(0.62, 0.62 - best.err * 3)) * closurePenalty;

  return {
    mmPerPx: best.s,
    source: "MODULE_SEARCH",
    confidence: Number(confidence.toFixed(3)),
    note: `按 300mm 模数推定：总宽 ${best.wMm / 1000}m × 总高 ${best.hMm / 1000}m（未检测到刻度，置信度低）`,
  };
}

/** 由 DPI 元数据推定比例（仅作弱参考，实测偏差可达百倍，通常会被弃用） */
export function dpiCandidate(dpi: number | undefined): ScaleCandidate | null {
  if (!dpi || dpi < 30 || dpi > 600) return null;
  return {
    mmPerPx: 25.4 / dpi,
    source: "DPI_META",
    confidence: 0.1,
    note: `图像元数据 ${dpi} DPI`,
  };
}

/** 人工标定：用户在图上拖一条已知墙，输入实际毫米数 */
export function manualCandidate(pixelLength: number, actualMm: number): ScaleCandidate {
  return {
    mmPerPx: actualMm / pixelLength,
    source: "MANUAL",
    confidence: 1.0,
    note: `人工标定：${actualMm}mm / ${pixelLength.toFixed(1)}px`,
  };
}

/** 仲裁：从多个候选中取最优。VLM 优先，但与模数搜索交叉验证。 */
export function arbitrateScale(candidates: ScaleCandidate[]): ScaleCandidate | null {
  if (candidates.length === 0) return null;

  const vlm = candidates.find((c) => c.source === "VLM_DIM");
  const moduleSearch_ = candidates.find((c) => c.source === "MODULE_SEARCH");
  const manual = candidates.find((c) => c.source === "MANUAL");

  if (manual) return manual;

  if (vlm && moduleSearch_) {
    const rel =
      Math.abs(vlm.mmPerPx - moduleSearch_.mmPerPx) /
      Math.max(vlm.mmPerPx, moduleSearch_.mmPerPx);
    if (rel < 0.04) {
      return {
        ...vlm,
        confidence: 0.92,
        note: `${vlm.note}（与模数搜索偏差 ${(rel * 100).toFixed(1)}%，交叉验证一致）`,
      };
    }
    if (rel < 0.12) {
      // 几何一致性更强时取模数搜索，但降置信度并进入人工队列
      return {
        ...moduleSearch_,
        confidence: 0.6,
        note: `${moduleSearch_.note}（与视觉读数偏差 ${(rel * 100).toFixed(1)}%，建议人工复核）`,
      };
    }
    // 差异过大：都不信，取模数搜索但标记需人工
    return {
      ...moduleSearch_,
      confidence: 0.35,
      note: `视觉读数与几何推定差异大（${(rel * 100).toFixed(1)}%），请人工标定`,
    };
  }

  if (vlm) return { ...vlm, confidence: Math.min(vlm.confidence, 0.85) };
  if (moduleSearch_) return moduleSearch_;

  // 其余（如 DPI）置信度都太低
  const best = [...candidates].sort((a, b) => b.confidence - a.confidence)[0];
  return best ?? null;
}
