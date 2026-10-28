/**
 * 核心管线回归测试：解析 → 三维构建。
 * 断言只针对「几何结构与产物完整性」，不依赖具体识别准确率，
 * 因为识别结果受素材影响、且已由人工确认队列兜底。
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { parseFloorplan } from "../src/lib/parse/pipeline.ts";
import { buildHouse } from "../src/lib/model3d/builder.ts";
import { planTour } from "../src/lib/pano/route.ts";
import { styleById } from "../src/lib/styles.ts";
import { sampleFloorplans } from "../src/lib/samples.ts";

const root = process.cwd();
const style = styleById.get("modern-minimal")!;

for (const s of sampleFloorplans) {
  test(`管线：${s.id} 解析+建模+路径`, async () => {
    const bytes = await fs.readFile(path.join(root, "public", s.fileUrl));
    const { json } = await parseFloorplan(bytes, { mmPerPxOverride: s.referenceScaleMmPerPx });

    // 比例标定已生效
    assert.ok(json.mmPerPx > 5 && json.mmPerPx < 40, "比例应在合理区间");

    // 房间/开口产出完整
    assert.ok(json.rooms.length >= 3, `房间数过少（${json.rooms.length}）`);
    assert.ok(json.openings.length >= 3, `开口数过少（${json.openings.length}）`);

    // 房间多边形有效
    for (const r of json.rooms) {
      assert.ok(r.polygonMm.length >= 3, "房间多边形至少 3 点");
      assert.ok(r.areaM2 > 1, "房间面积应 > 1m²");
    }

    // 三维可构建：墙、地面、家具
    const { group, stats } = buildHouse(json, { style, ceiling: true });
    assert.ok(stats.wallTris > 0, "墙体应生成三角面");
    assert.ok(stats.furnitureCount > 0, "家具应生成");

    // 漫游路径覆盖所有房间
    const route = planTour(json);
    assert.equal(route.waypoints.length, json.rooms.length + 1, "途经点 = 入户门 + 每房间");
    assert.equal(route.coverageRoomIds.length, json.rooms.length, "覆盖所有房间");
    void group;
  });
}
