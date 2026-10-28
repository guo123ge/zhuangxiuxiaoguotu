/** 墙掩膜质量可视化：dark 原始(灰) vs thin(蓝) vs wallBase(黑) vs 泛洪(浅蓝) */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { loadAndMeasure } from "../src/lib/cv/preprocess.ts";
import { buildColorMasks, close, dilate, open } from "../src/lib/cv/colorLayer.ts";
import { labelComponents } from "../src/lib/cv/components.ts";

const root = process.cwd();
const id = process.argv[2] ?? "yao-a";
const r = Number(process.argv[3] ?? 24);

const bytes = await fs.readFile(path.join(root, "public/samples/floorplans", `${id}.png`));
const { image } = await loadAndMeasure(bytes);
const { width, height } = image;
const total = width * height;
const masks = buildColorMasks(image);

const thin = open(masks.dark, width, height, 3);
const wall = close(thin, width, height, 5);
const glass = dilate(masks.blue, width, height, 2);
for (let i = 0; i < total; i++) if (glass[i]) wall[i] = 1;

const comps = labelComponents(wall, width, height);
let bx0 = width - 1, by0 = height - 1, bx1 = 0, by1 = 0;
for (let i = 0; i < comps.count; i++) {
  if (comps.sizes[i] < 400) continue;
  bx0 = Math.min(bx0, comps.boxes[i * 4]);
  by0 = Math.min(by0, comps.boxes[i * 4 + 1]);
  bx1 = Math.max(bx1, comps.boxes[i * 4 + 2]);
  by1 = Math.max(by1, comps.boxes[i * 4 + 3]);
}
const sealed = close(wall, width, height, r);
const outside = new Uint8Array(total);
const stack: number[] = [];
const push = (x: number, y: number) => {
  if (x < bx0 - 1 || y < by0 - 1 || x > bx1 + 1 || y > by1 + 1) return;
  const i = y * width + x;
  if (sealed[i] || outside[i]) return;
  outside[i] = 1;
  stack.push(i);
};
for (let x = bx0 - 1; x <= bx1 + 1; x++) { push(x, by0 - 1); push(x, by1 + 1); }
for (let y = by0 - 1; y <= by1 + 1; y++) { push(bx0 - 1, y); push(bx1 + 1, y); }
while (stack.length) {
  const i = stack.pop()!;
  const x = i % width;
  const y = (i - x) / width;
  push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
}

const buf = Buffer.alloc(total * 3);
for (let i = 0; i < total; i++) {
  let rgb: [number, number, number] = [248, 250, 252];
  if (masks.dark[i]) rgb = [203, 213, 225]; // 原始 dark：浅灰
  if (outside[i]) rgb = [186, 230, 253]; // 泛洪：浅蓝
  if (masks.blue[i]) rgb = [147, 197, 253]; // 玻璃：中蓝
  if (thin[i]) rgb = [100, 116, 139]; // thin：中灰
  if (wall[i]) rgb = [15, 23, 42]; // 最终墙：黑
  buf[i * 3] = rgb[0]; buf[i * 3 + 1] = rgb[1]; buf[i * 3 + 2] = rgb[2];
}
await fs.mkdir(path.join(root, "debug"), { recursive: true });
await sharp(buf, { raw: { width, height, channels: 3 } })
  .png()
  .toFile(path.join(root, "debug", `wallmask-${id}.png`));
console.log(`debug/wallmask-${id}.png  bbox [${bx0},${by0}]~[${bx1},${by1}]`);
