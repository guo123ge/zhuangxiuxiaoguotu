/**
 * 房间分割探测：验证「密封-回填 + 多源 BFS」在真实图上的效果。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { loadAndMeasure } from "../src/lib/cv/preprocess.ts";
import { buildColorMasks } from "../src/lib/cv/colorLayer.ts";
import { segmentRooms } from "../src/lib/cv/rooms.ts";
import { detectChains } from "../src/lib/cv/scale.ts";
import { sampleFloorplans } from "../src/lib/samples.ts";

const root = process.cwd();

async function main() {
  for (const s of sampleFloorplans) {
    const bytes = await fs.readFile(path.join(root, "public", s.fileUrl));
    const { image } = await loadAndMeasure(bytes);
    const { width, height } = image;
    const masks = buildColorMasks(image);
    const mm = s.referenceScaleMmPerPx;
    const chains = detectChains(masks);

    const t0 = Date.now();
    const { rooms, droppedComponents, region, splits } = segmentRooms(masks, mm, { chains });
    const elapsed = Date.now() - t0;
    console.log(`  区域: [${region.x0},${region.y0}]~[${region.x1},${region.y1}]  拆分: ${splits.length > 0 ? splits.map((sp) => `房间${sp.room}→${sp.parts}份`).join(" ") : "无"}  剔除外部块: ${droppedComponents}`);

    const totalArea = rooms.reduce((sum, r) => sum + (r.sizePx * mm * mm) / 1e6, 0);
    console.log(`\n──── ${s.id} ──── (${elapsed}ms)`);
    console.log(
      `  房间数 ${rooms.length}  合计 ${totalArea.toFixed(1)} m²  认购 ${s.grossAreaM2} m²  覆盖率 ${((totalArea / s.grossAreaM2) * 100).toFixed(0)}%`,
    );
    rooms.forEach((r, i) => {
      const areaM2 = (r.sizePx * mm * mm) / 1e6;
      const wPx = r.box[2] - r.box[0];
      const hPx = r.box[3] - r.box[1];
      console.log(
        `    #${i + 1} ${areaM2.toFixed(1)}m²  包围盒 ${(wPx * mm / 1000).toFixed(2)}×${(hPx * mm / 1000).toFixed(2)}m  质心(${(r.centroid[0]).toFixed(0)},${(r.centroid[1]).toFixed(0)})`,
      );
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
