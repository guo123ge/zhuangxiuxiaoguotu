/**
 * 解析管线端到端验证：5 张样本 → FloorplanJson，输出统计。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { parseFloorplan } from "../src/lib/parse/pipeline.ts";
import { sampleFloorplans } from "../src/lib/samples.ts";

const root = process.cwd();

async function main() {
  await fs.mkdir(path.join(root, "debug", "json"), { recursive: true });
  for (const s of sampleFloorplans) {
    const bytes = await fs.readFile(path.join(root, "public", s.fileUrl));
    const t0 = Date.now();
    const { json } = await parseFloorplan(bytes, { mmPerPxOverride: s.referenceScaleMmPerPx });
    const elapsed = Date.now() - t0;
    await fs.writeFile(
      path.join(root, "debug", "json", `${s.id}.json`),
      JSON.stringify(json, null, 2),
    );
    const doors = json.openings.filter((o) => o.kind === "door");
    const opens = json.openings.filter((o) => o.kind === "open");
    const wins = json.openings.filter((o) => o.kind === "window");
    console.log(`\n──── ${s.id} ──── (${elapsed}ms)`);
    console.log(`  比例 ${json.mmPerPx} mm/px (${json.scaleSource}, 置信 ${json.scaleConfidence})`);
    console.log(`  房间 ${json.rooms.length}：${json.rooms.map((r) => `${r.name}${r.areaM2}m²`).join(" / ")}`);
    console.log(`  开口: 门 ${doors.length} 连通口 ${opens.length} 窗 ${wins.length}`);
    console.log(`  墙环: ${json.wallLoops.length}  问题: ${json.issues.length ? json.issues.join("；") : "无"}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
