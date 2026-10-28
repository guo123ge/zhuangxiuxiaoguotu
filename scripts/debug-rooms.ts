/** 逐步复现 segmentRooms 内部逻辑，定位 0 房间的根因 */
import fs from "node:fs/promises";
import path from "node:path";
import { loadAndMeasure } from "../src/lib/cv/preprocess.ts";
import { buildColorMasks, close, dilate, open } from "../src/lib/cv/colorLayer.ts";
import { labelComponents } from "../src/lib/cv/components.ts";
import { segmentRooms, distanceTransform } from "../src/lib/cv/rooms.ts";

const root = process.cwd();
const id = process.argv[2] ?? "yao-a";
const mm = Number(process.argv[3] ?? 15.27);

const bytes = await fs.readFile(path.join(root, "public/samples/floorplans", `${id}.png`));
const { image } = await loadAndMeasure(bytes);
const { width, height } = image;
const total = width * height;
const masks = buildColorMasks(image);

// 直接调用真实函数
const res = segmentRooms(masks, mm, {});
console.log(`segmentRooms: rooms=${res.rooms.length} dropped=${res.droppedComponents}`);

// 逐步复现
const thin = open(masks.dark, width, height, 3);
const wallBase = close(thin, width, height, 5);
const glass = dilate(masks.blue, width, height, 2);
for (let i = 0; i < total; i++) if (glass[i]) wallBase[i] = 1;
const sealR = Math.max(12, Math.round(600 / mm));
console.log(`wall=${wallBase.reduce((a, b) => a + b, 0)}px  sealR=${sealR}px`);

// 从 rooms.ts 导入内部用的 dilateBox / floodOutside —— 未导出，这里本地复刻
function dilateBox(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let count = 0;
    for (let x = 0; x <= Math.min(r, w - 1); x++) count += mask[row + x];
    for (let x = 0; x < w; x++) {
      if (count > 0) tmp[row + x] = 1;
      const add = x + r + 1, sub = x - r;
      if (add < w) count += mask[row + add];
      if (sub >= 0) count -= mask[row + sub];
    }
  }
  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    let count = 0;
    for (let y = 0; y <= Math.min(r, h - 1); y++) count += tmp[y * w + x];
    for (let y = 0; y < h; y++) {
      if (count > 0) out[y * w + x] = 1;
      const add = y + r + 1, sub = y - r;
      if (add < h) count += tmp[add * w + x];
      if (sub >= 0) count -= tmp[sub * w + x];
    }
  }
  return out;
}
function floodOutside(obstacle: Uint8Array, w: number, h: number): Uint8Array {
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (obstacle[i] || outside[i]) return;
    outside[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w, y = (i - x) / w;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  return outside;
}

const sealed = dilateBox(wallBase, width, height, sealR);
const outside = floodOutside(sealed, width, height);
let sealN = 0, outN = 0;
for (let i = 0; i < total; i++) { if (sealed[i]) sealN++; if (outside[i]) outN++; }
console.log(`sealed=${(sealN / total * 100).toFixed(1)}%  outside=${(outN / total * 100).toFixed(1)}%`);

const freeMask = new Uint8Array(total);
for (let i = 0; i < total; i++) if (!wallBase[i] && !outside[i]) freeMask[i] = 1;
let freeN = 0;
for (let i = 0; i < total; i++) if (freeMask[i]) freeN++;
console.log(`free=${(freeN / total * 100).toFixed(1)}% (${(freeN * mm * mm / 1e6).toFixed(0)}m²)`);

const comps = labelComponents(freeMask, width, height);
const touch = new Uint8Array(comps.count + 1);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = y * width + x;
    const c = comps.labels[i];
    if (c === 0 || touch[c]) continue;
    if (
      (x > 0 && outside[i - 1]) || (x < width - 1 && outside[i + 1]) ||
      (y > 0 && outside[i - width]) || (y < height - 1 && outside[i + width])
    ) touch[c] = 1;
  }
}
const list = [];
for (let c = 1; c <= comps.count; c++) {
  list.push({ label: c, sizeM2: (comps.sizes[c - 1] * mm * mm) / 1e6, touch: !!touch[c] });
}
list.sort((a, b) => b.sizeM2 - a.sizeM2);
console.log(`自由连通块 ${comps.count} 个，top10（sizes 索引已修正为 label-1）:`);
list.slice(0, 10).forEach((o) =>
  console.log(`  label=${o.label} ${o.sizeM2.toFixed(1)}m² touch=${o.touch}`),
);
let keptN = 0;
for (const o of list) if (!o.touch) keptN += comps.sizes[o.label - 1];
console.log(`不接触室外的自由像素: ${(keptN * mm * mm / 1e6).toFixed(1)}m²`);
