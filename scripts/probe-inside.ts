/**
 * 室内外判定诊断（方案 E）。
 *
 * 墙掩膜：thin = open(dark, 3)  —— 先去掉细线（尺寸线/家具/文字）
 *         wall = close(thin, 5) —— 再填墙带纹理缝、桥接小断口
 * 密封：seal = close(wall ∪ glass, R) 后从包围盒边界泛洪
 */
import fs from "node:fs/promises";
import path from "node:path";
import { loadAndMeasure } from "../src/lib/cv/preprocess.ts";
import { buildColorMasks, close, dilate, open } from "../src/lib/cv/colorLayer.ts";
import { labelComponents } from "../src/lib/cv/components.ts";
import { sampleFloorplans } from "../src/lib/samples.ts";

const root = process.cwd();

async function main() {
  const radii = [12, 18, 24, 30];
  console.log("id".padEnd(9) + "gross  bboxW×bboxH        " + radii.map((r) => `r=${r}`.padEnd(15)).join(""));
  for (const s of sampleFloorplans) {
    const bytes = await fs.readFile(path.join(root, "public", s.fileUrl));
    const { image } = await loadAndMeasure(bytes);
    const { width, height } = image;
    const total = width * height;
    const masks = buildColorMasks(image);
    const mm = s.referenceScaleMmPerPx;

    const thin = open(masks.dark, width, height, 3);
    const wallBase = close(thin, width, height, 5);
    const glass = dilate(masks.blue, width, height, 2);
    for (let i = 0; i < total; i++) if (glass[i]) wallBase[i] = 1;

    const comps = labelComponents(wallBase, width, height);
    let bx0 = width - 1, by0 = height - 1, bx1 = 0, by1 = 0;
    for (let i = 0; i < comps.count; i++) {
      if (comps.sizes[i] < 400) continue;
      bx0 = Math.min(bx0, comps.boxes[i * 4]);
      by0 = Math.min(by0, comps.boxes[i * 4 + 1]);
      bx1 = Math.max(bx1, comps.boxes[i * 4 + 2]);
      by1 = Math.max(by1, comps.boxes[i * 4 + 3]);
    }

    const cells: string[] = [];
    for (const r of radii) {
      const sealed = close(wallBase, width, height, r);
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
      let inside = 0, floor = 0;
      for (let y = by0; y <= by1; y++) {
        for (let x = bx0; x <= bx1; x++) {
          const i = y * width + x;
          if (outside[i]) continue;
          inside++;
          if (!wallBase[i]) floor++;
        }
      }
      const insideM2 = (inside * mm * mm) / 1e6;
      const floorM2 = (floor * mm * mm) / 1e6;
      cells.push(`${insideM2.toFixed(0)}/${floorM2.toFixed(0)}`.padEnd(15));
    }
    const bboxStr = `${bx1 - bx0}×${by1 - by0}`;
    console.log(s.id.padEnd(9) + String(s.grossAreaM2).padEnd(6) + bboxStr.padEnd(18) + cells.join(""));
  }
  console.log("\n格式：室内轮廓/可用地面（m²）");
}

await main();
