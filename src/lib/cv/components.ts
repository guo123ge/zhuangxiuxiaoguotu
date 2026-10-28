/**
 * 连通域标记（8 连通，4 邻域也可选）。
 * 用于把墙体网络与尺寸标注、家具、文字分离。
 */

export type LabelResult = {
  /** 每个像素的标签，0 表示背景 */
  labels: Int32Array;
  count: number;
  /** 各标签的像素数，索引 = 标签 - 1 */
  sizes: Int32Array;
  /** 各标签的包围盒 [minX, minY, maxX, maxY]，索引 = 标签 - 1 */
  boxes: Int32Array;
};

export function labelComponents(
  mask: Uint8Array,
  width: number,
  height: number,
  connectivity: 4 | 8 = 8,
): LabelResult {
  const labels = new Int32Array(width * height);
  const sizes: number[] = [];
  const boxes: number[] = [];
  let current = 0;

  // 用显式栈避免深递归爆栈
  const stack: number[] = [];

  for (let start = 0; start < mask.length; start++) {
    if (mask[start] === 0 || labels[start] !== 0) continue;
    current++;
    sizes.push(0);
    boxes.push(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, -1, -1);

    stack.push(start);
    labels[start] = current;

    while (stack.length > 0) {
      const idx = stack.pop()!;
      sizes[current - 1]++;

      const x = idx % width;
      const y = (idx - x) / width;
      const b = (current - 1) * 4;
      if (x < boxes[b]) boxes[b] = x;
      if (y < boxes[b + 1]) boxes[b + 1] = y;
      if (x > boxes[b + 2]) boxes[b + 2] = x;
      if (y > boxes[b + 3]) boxes[b + 3] = y;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (connectivity === 4 && dx !== 0 && dy !== 0) continue;
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (mask[ni] === 1 && labels[ni] === 0) {
            labels[ni] = current;
            stack.push(ni);
          }
        }
      }
    }
  }

  return {
    labels,
    count: current,
    sizes: Int32Array.from(sizes),
    boxes: Int32Array.from(boxes),
  };
}

/** 取最大的若干个连通域，生成新的掩膜 */
export function keepLargestComponents(
  mask: Uint8Array,
  width: number,
  height: number,
  topN: number,
): { mask: Uint8Array; kept: { size: number; box: [number, number, number, number] }[] } {
  const res = labelComponents(mask, width, height);
  const order = Array.from({ length: res.count }, (_, i) => i).sort(
    (a, b) => res.sizes[b] - res.sizes[a],
  );
  const take = new Set(order.slice(0, topN).map((i) => i + 1));
  const out = new Uint8Array(width * height);
  const kept: { size: number; box: [number, number, number, number] }[] = [];

  for (const i of order.slice(0, topN)) {
    kept.push({
      size: res.sizes[i],
      box: [
        res.boxes[i * 4],
        res.boxes[i * 4 + 1],
        res.boxes[i * 4 + 2],
        res.boxes[i * 4 + 3],
      ],
    });
  }

  for (let p = 0; p < mask.length; p++) {
    if (mask[p] === 1 && take.has(res.labels[p])) out[p] = 1;
  }
  return { mask: out, kept };
}

/** 去掉面积小于 minSize 的连通域（去文字、噪点） */
export function removeSmallComponents(
  mask: Uint8Array,
  width: number,
  height: number,
  minSize: number,
): Uint8Array {
  const res = labelComponents(mask, width, height);
  const drop = new Set<number>();
  for (let i = 0; i < res.count; i++) {
    if (res.sizes[i] < minSize) drop.add(i + 1);
  }
  const out = new Uint8Array(width * height);
  for (let p = 0; p < mask.length; p++) {
    if (mask[p] === 1 && !drop.has(res.labels[p])) out[p] = 1;
  }
  return out;
}
