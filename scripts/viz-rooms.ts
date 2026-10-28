/**
 * 分割结果可视化：把房间标签渲染成彩色 PNG，叠加墙与尺寸链区域，便于人工核查。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { loadAndMeasure } from "../src/lib/cv/preprocess.ts";
import { buildColorMasks } from "../src/lib/cv/colorLayer.ts";
import { segmentRooms } from "../src/lib/cv/rooms.ts";
import { detectChains } from "../src/lib/cv/scale.ts";
import { sampleFloorplans } from "../src/lib/samples.ts";

const root = process.cwd();
const PALETTE: [number, number, number][] = [
  [239, 68, 68], [59, 130, 246], [16, 185, 129], [245, 158, 11],
  [139, 92, 246], [236, 72, 153], [20, 184, 166], [132, 204, 22],
  [249, 115, 22], [99, 102, 241], [234, 179, 8], [6, 182, 212],
];

async function main() {
  const only = process.argv[2]; // 可选：只跑某一张
  await fs.mkdir(path.join(root, "debug"), { recursive: true });
  for (const s of sampleFloorplans) {
    if (only && s.id !== only) continue;
    const bytes = await fs.readFile(path.join(root, "public", s.fileUrl));
    const { image } = await loadAndMeasure(bytes);
    const { width, height } = image;
    const masks = buildColorMasks(image);
    const mm = s.referenceScaleMmPerPx;
    const chains = detectChains(masks);
    console.log(`${s.id}: 链位置 上${chains.top.posPx} 下${chains.bottom.posPx} 左${chains.left.posPx} 右${chains.right.posPx}  闭合差 h=${(chains.hClosureError * 100).toFixed(2)}% v=${(chains.vClosureError * 100).toFixed(2)}%`);

    const { roomLabels, rooms, wallBase } = segmentRooms(masks, mm, { chains });

    // 渲染：原图压暗 + 房间半透明彩色 + 墙纯黑
    const out = Buffer.alloc(width * height * 3);
    for (let i = 0; i < width * height; i++) {
      const r = image.data[i * 3], g = image.data[i * 3 + 1], b = image.data[i * 3 + 2];
      const l = roomLabels[i];
      if (wallBase[i]) {
        out[i * 3] = 15; out[i * 3 + 1] = 23; out[i * 3 + 2] = 42;
      } else if (l > 0) {
        const [pr, pg, pb] = PALETTE[(l - 1) % PALETTE.length];
        out[i * 3] = Math.round(r * 0.35 + pr * 0.65);
        out[i * 3 + 1] = Math.round(g * 0.35 + pg * 0.65);
        out[i * 3 + 2] = Math.round(b * 0.35 + pb * 0.65);
      } else {
        out[i * 3] = Math.round(r * 0.55 + 115);
        out[i * 3 + 1] = Math.round(g * 0.55 + 115);
        out[i * 3 + 2] = Math.round(b * 0.55 + 115);
      }
    }
    const outPath = path.join(root, "debug", `seg-${s.id}.png`);
    await sharp(out, { raw: { width, height, channels: 3 } }).png().toFile(outPath);
    console.log(`  ${rooms.length} 个房间 → debug/seg-${s.id}.png`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
