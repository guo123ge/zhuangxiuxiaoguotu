/**
 * 多边形轮廓提取验证：在分割图上叠加房间轮廓线（亮青色）与顶点（红点）。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { loadAndMeasure } from "../src/lib/cv/preprocess.ts";
import { buildColorMasks } from "../src/lib/cv/colorLayer.ts";
import { segmentRooms } from "../src/lib/cv/rooms.ts";
import { detectChains } from "../src/lib/cv/scale.ts";
import { extractRoomPolygons, polygonArea } from "../src/lib/geom/contour.ts";
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
    const { roomLabels, rooms } = segmentRooms(masks, mm, { chains });

    const polys = extractRoomPolygons(
      roomLabels, width, height,
      rooms.map((r) => r.label),
      2.5,
    );

    // 绘制
    const out = Buffer.alloc(width * height * 3);
    for (let i = 0; i < width * height; i++) {
      out[i * 3] = image.data[i * 3];
      out[i * 3 + 1] = image.data[i * 3 + 1];
      out[i * 3 + 2] = image.data[i * 3 + 2];
    }
    const setPx = (x: number, y: number, r: number, g: number, b: number) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const i = (y * width + x) * 3;
      out[i] = r; out[i + 1] = g; out[i + 2] = b;
    };
    const drawLine = (x0: number, y0: number, x1: number, y1: number) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let t = 0; t <= n; t++) {
        const x = Math.round(x0 + ((x1 - x0) * t) / n);
        const y = Math.round(y0 + ((y1 - y0) * t) / n);
        setPx(x, y, 6, 182, 212);
        setPx(x + 1, y, 6, 182, 212);
        setPx(x, y + 1, 6, 182, 212);
      }
    };
    let report = "";
    for (const r of rooms) {
      const poly = polys.get(r.label);
      if (!poly) { report += ` #${r.label}=无轮廓`; continue; }
      const areaM2 = Math.abs(polygonArea(poly)) * mm * mm / 1e6;
      report += ` #${r.label}=${poly.length}顶点/${areaM2.toFixed(1)}m²`;
      for (let i = 0; i < poly.length; i++) {
        const [x0, y0] = poly[i];
        const [x1, y1] = poly[(i + 1) % poly.length];
        drawLine(x0, y0, x1, y1);
      }
      for (const [x, y] of poly) {
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setPx(x + dx, y + dy, 239, 68, 68);
      }
    }
    await sharp(out, { raw: { width, height, channels: 3 } })
      .png()
      .toFile(path.join(root, "debug", `poly-${s.id}.png`));
    console.log(`${s.id}:${report}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
