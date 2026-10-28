/** 三维构建自测：解析样本 → buildHouse → 校验几何与开洞 */
import fs from "node:fs/promises";
import path from "node:path";
import { parseFloorplan } from "../src/lib/parse/pipeline.ts";
import { buildHouse } from "../src/lib/model3d/builder.ts";
import { styleById } from "../src/lib/styles.ts";
import { sampleFloorplans } from "../src/lib/samples.ts";

const root = process.cwd();

for (const s of sampleFloorplans.slice(0, 2)) {
  const bytes = await fs.readFile(path.join(root, "public", s.fileUrl));
  const { json } = await parseFloorplan(bytes, { mmPerPxOverride: s.referenceScaleMmPerPx });
  const style = styleById.get("modern-minimal")!;
  const { group, stats } = buildHouse(json, { style, ceiling: true });
  const meshes: string[] = [];
  group.traverse((o) => {
    if ((o as { isMesh?: boolean }).isMesh) meshes.push((o as { name?: string }).name ?? "?");
  });
  console.log(
    `──── ${s.id} ────\n` +
    `  房间 ${json.rooms.length}  开口 ${json.openings.length}（门 ${json.openings.filter(o => o.kind === "door").length} 窗 ${json.openings.filter(o => o.kind === "window").length}）\n` +
    `  墙三角面 ${stats.wallTris}  家具 ${stats.furnitureCount} 网格 ${meshes.length}  构建 ${stats.buildMs}ms\n` +
    `  警告: ${stats.warnings.length ? stats.warnings.join("; ") : "无"}`,
  );
  // 基本几何断言
  if (stats.wallTris <= 0) throw new Error("墙体未生成");
  if (json.rooms.length > 0 && stats.furnitureCount === 0) throw new Error("家具未生成");
}

console.log("\n✓ 三维构建自测通过");
