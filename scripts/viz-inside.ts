/**
 * 室内外判定可视化：墙体(黑) / 室外泛洪(浅蓝) / 室内(绿)。
 * 用于目视确认泛洪从哪些缺口进入室内。
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { loadAndMeasure } from "../src/lib/cv/preprocess.ts";
import { buildColorMasks, close, dilate, open } from "../src/lib/cv/colorLayer.ts";
import { labelComponents } from "../src/lib/cv/components.ts";

const root = process.cwd();
const id = process.argv[2] ?? "yunkun";
const r = Number(process.argv[3] ?? 26);

const bytes = await fs.readFile(path.join(root, "public/samples/floorplans", `${id}.png`));
const { image } = await loadAndMeasure(bytes);
const { width, height } = image;
const total = width * height;
const masks = buildColorMasks(image);

const wallClean = open(masks.dark, width, height, 2);
const wallBase = close(wallClean, width, height, 2);
const glass = dilate(masks.blue, width, height, 1);
for (let i = 0; i < total; i++) if (glass[i]) wallBase[i] = 1;

const comps = labelComponents(wallBase, width, height);
let bx0 = width - 1, by0 = height - 1, bx1 = 0, by1 = 0;
for (let i = 0; i < comps.count; i++) {
  if (comps.sizes[i] < 300) continue;
  bx0 = Math.min(bx0, comps.boxes[i * 4]);
  by0 = Math.min(by0, comps.boxes[i * 4 + 1]);
  bx1 = Math.max(bx1, comps.boxes[i * 4 + 2]);
  by1 = Math.max(by1, comps.boxes[i * 4 + 3]);
}
console.log(`墙体包围盒 [${bx0},${by0}]~[${bx1},${by1}]  尺寸 ${bx1 - bx0}×${by1 - by0}px`);

const sealed = r > 0 ? close(wallBase, width, height, r) : wallBase;
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
let outN = 0, inN = 0, wallN = 0;
for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
  const i = y * width + x;
  if (outside[i]) outN++; else if (wallBase[i]) wallN++; else inN++;
}
console.log(`盒内：室外 ${outN}px  墙 ${wallN}px  室内自由 ${inN}px`);

const buf = Buffer.alloc(total * 3);
for (let i = 0; i < total; i++) {
  let rgb: [number, number, number] = [248, 250, 252];
  if (outside[i]) rgb = [186, 230, 253];
  else if (wallBase[i]) rgb = [15, 23, 42];
  else if (i >= by0 * width && i < by1 * width) rgb = [167, 243, 208];
  buf[i * 3] = rgb[0]; buf[i * 3 + 1] = rgb[1]; buf[i * 3 + 2] = rgb[2];
}
await fs.mkdir(path.join(root, "debug"), { recursive: true });
await sharp(buf, { raw: { width, height, channels: 3 } })
  .png()
  .toFile(path.join(root, "debug", `inside-${id}-r${r}.png`));
console.log(`已写出 debug/inside-${id}-r${r}.png`);
