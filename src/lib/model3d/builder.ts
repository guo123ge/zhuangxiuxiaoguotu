/**
 * 三维户型构建：FloorplanJson → THREE.Group。
 *
 * 坐标系约定：
 *   - 图纸坐标（毫米）：x 右、y 下、原点左上
 *   - 三维坐标（米）：x 右、y 上、z 向观察者（y-up）
 *   - 转换：X = x/1000，Z = y/1000，Y = 高度。图纸 y 翻转到 z 后
 *     户型在俯视图里与原图方向一致（北朝上翻转，无碍使用）。
 *
 * 墙体生成：墙环多边形（外环 + 房间孔洞）→ Shape + holes →
 *   ExtrudeGeometry 沿高度拉伸 → 与门窗切削盒做 CSG 减法开洞。
 *   曲线墙（圆角外墙）由多边形自然逼近。
 */
import * as THREE from "three";
import { Evaluator, Brush, SUBTRACTION } from "three-bvh-csg";
import type { FloorplanJson, RoomJson, OpeningJson } from "../parse/pipeline.ts";
import { matchColor, matchMaterial, type StyleSeed } from "../styles.ts";
import { materialById, type MaterialSeed } from "../materials.ts";
import { makeMaterialTexture, materialRepeat } from "./texture.ts";

export type BuildOptions = {
  style: StyleSeed;
  /** 墙高（毫米），默认 2800 */
  wallHeightMm?: number;
  /** 是否生成天花板（漫游模式需要，交互模式遮挡视线可关） */
  ceiling?: boolean;
  /**
   * 参数覆盖集：roomId -> 各目标面颜色/材质覆盖。
   * 优先级高于风格规则，用于「多套方案」差异化对比。
   */
  overlay?: Record<string, Partial<Record<"floor" | "wall" | "ceiling" | "cabinet", string>>>;
};

export type BuildStats = {
  wallTris: number;
  furnitureCount: number;
  buildMs: number;
  warnings: string[];
};

const M = (mm: number) => mm / 1000;

/**
 * 图纸点（毫米）→ 三维平面点（米）。
 *
 * 约定：俯视平面上 X = x/1000、Z = y/1000（即 Z = +y）。这与开口切割、玻璃、
 * 家具、灯具、以及漫游路径 Waypoint（TourViewer: Vector3(xMm/1000, h, yMm/1000)）
 * 与 FitCamera（cz = (y0+y1)/2000）的映射完全一致。
 *
 * 墙体/地面用 rotateX(-π/2) 把 Shape 的 XY 平面立到 XZ 平面，该旋转会把 Shape
 * 的 +y 映到 -Z，故此处对 y 取反，最终得到 Z = +y。否则墙体/地面会与内饰
 * （家具/灯具/门窗）及相机在 Z 轴镜像分离。
 */
function toPlane(p: [number, number]): THREE.Vector2 {
  return new THREE.Vector2(M(p[0]), -M(p[1]));
}

/** 墙环 → Shape（外环 + 孔洞）。THREE.Shape 的孔洞绕向与外环相反即可 */
function loopToShape(loop: { outer: [number, number][]; holes: [number, number][][] }): THREE.Shape | null {
  if (loop.outer.length < 3) return null;
  const shape = new THREE.Shape(loop.outer.map(toPlane));
  for (const h of loop.holes) {
    if (h.length < 3) continue;
    const path = new THREE.Path(h.map(toPlane));
    shape.holes.push(path);
  }
  return shape;
}

/** 材质缓存：同色合批减少 draw call */
function stdMat(color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02, ...opts });
}

type FaceTarget = "FLOOR" | "WALL" | "CEILING" | "CABINET";

/** 解析某房间某目标面在指定风格下的「颜色 + 材质对象」（覆盖集优先） */
function resolveFace(
  style: StyleSeed,
  target: FaceTarget,
  roomType: string,
  roomId?: string,
  overlay?: BuildOptions["overlay"],
): { colorHex: string; material: MaterialSeed | null } {
  const over = roomId ? overlay?.[roomId]?.[target.toLowerCase() as "floor" | "wall" | "ceiling" | "cabinet"] : undefined;
  const materialId = matchMaterial(style.id, target, roomType);
  const material = materialId ? materialById.get(materialId) ?? null : null;
  const defaultColor = target === "FLOOR" ? "#d8cfc4" : target === "WALL" ? "#f5f5f0" : "#ffffff";
  // 颜色优先级：覆盖集 > 风格颜色规则 > 材质本色 > 默认
  const colorHex = over ?? matchColor(style.id, target, roomType) ?? material?.colorHex ?? defaultColor;
  return { colorHex, material };
}

export function buildHouse(json: FloorplanJson, opts: BuildOptions): { group: THREE.Group; stats: BuildStats } {
  const t0 = performance.now();
  const warnings: string[] = [];
  const wallH = M(opts.wallHeightMm ?? 2800);
  const group = new THREE.Group();
  const style = opts.style;

  // ── 1. 墙体：拉伸 + CSG 开洞 ──
  const wallGeoms: THREE.BufferGeometry[] = [];
  for (const loop of json.wallLoops) {
    const shape = loopToShape(loop);
    if (!shape) continue;
    const geo = new THREE.ExtrudeGeometry(shape, { depth: wallH, bevelEnabled: false, curveSegments: 12 });
    geo.rotateX(-Math.PI / 2); // 拉伸方向 z → y（上）
    wallGeoms.push(geo);
  }

  // 墙厚：由房间多边形与外环的距离近似（取最小房间外扩 0）；切削盒厚度取 0.6m 足够覆盖
  const CUT_T = 0.6;
  const evaluator = new Evaluator();
  evaluator.attributes = ["position", "normal", "uv"];

  let wallMesh: THREE.Mesh | null = null;
  if (wallGeoms.length > 0) {
    // 合并所有墙环为一个 brush
    const merged = mergeGeometries(wallGeoms);
    let brush = new Brush(merged);
    brush.updateMatrixWorld();

    const cuts: THREE.BoxGeometry[] = [];
    for (const op of json.openings) {
      if (op.kind === "window") continue; // 窗单独处理（先开洞再嵌玻璃）
      const [cx, cy] = op.centerMm;
      const w = M(Math.max(op.widthMm, 500));
      const h = op.kind === "open" ? wallH : M(2100); // 门/连通口开到 2.1m
      const box = new THREE.BoxGeometry(w + 0.02, h, CUT_T);
      // 旋转到开口走向
      box.rotateY(-op.angleRad);
      box.translate(M(cx), h / 2, M(cy));
      cuts.push(box);
    }

    for (const cut of cuts) {
      const cutBrush = new Brush(cut);
      cutBrush.updateMatrixWorld();
      const result = evaluator.evaluate(brush, cutBrush, SUBTRACTION);
      brush = new Brush(result.geometry);
      brush.updateMatrixWorld();
    }
    wallMesh = new THREE.Mesh(brush.geometry, stdMat(resolveFace(style, "WALL", "*").colorHex));
    wallMesh.name = "walls";
    group.add(wallMesh);
  }

  // ── 2. 窗洞 + 玻璃 ──
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: "#cfe8f5",
    transparent: true,
    opacity: 0.28,
    roughness: 0.05,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const frameMat = stdMat(resolveFace(style, "CABINET", "*").colorHex, { metalness: 0.3, roughness: 0.4 });
  if (wallMesh) {
    for (const op of json.openings) {
      if (op.kind !== "window") continue;
      const [cx, cy] = op.centerMm;
      const w = M(Math.max(op.widthMm, 500));
      const sill = M(900);
      const top = M(2100);
      const box = new THREE.BoxGeometry(w + 0.02, top - sill, CUT_T);
      box.rotateY(-op.angleRad);
      box.translate(M(cx), (sill + top) / 2, M(cy));
      const cutBrush = new Brush(box);
      cutBrush.updateMatrixWorld();
      const result = evaluator.evaluate(new Brush(wallMesh.geometry), cutBrush, SUBTRACTION);
      wallMesh.geometry.dispose();
      wallMesh.geometry = result.geometry;

      // 玻璃 + 窗框
      const pane = new THREE.Mesh(new THREE.BoxGeometry(w, top - sill - 0.06, 0.012), glassMat);
      pane.rotateY(-op.angleRad);
      pane.position.set(M(cx), (sill + top) / 2, M(cy));
      pane.name = "glass";
      group.add(pane);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.05), frameMat);
      frame.rotateY(-op.angleRad);
      frame.position.set(M(cx), top, M(cy));
      group.add(frame);
    }
  }

  const overlay = opts.overlay;
  // ── 3. 地面（按房间类型取材质，规格平铺 + 真实粗糙度/金属度）──
  const floorY = 0.002;
  for (const room of json.rooms) {
    const shape = polygonToShape(room.polygonMm);
    if (!shape) continue;
    const geo = new THREE.ShapeGeometry(shape, 12);
    geo.rotateX(-Math.PI / 2);
    const face = resolveFace(style, "FLOOR", room.type, room.id, overlay);
    const mat = stdMat(face.colorHex, {
      roughness: face.material?.roughness ?? 0.6,
      metalness: face.material?.metallic ?? 0.02,
    });
    // 瓷砖/木地板按真实规格平铺（ShapeGeometry UV 单位 = 米）
    if (face.material) {
      const tex = makeMaterialTexture(face.material);
      if (tex) {
        const [ru, rv] = materialRepeat(face.material);
        tex.repeat.set(ru, rv);
        mat.map = tex;
        mat.needsUpdate = true;
      }
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = floorY;
    mesh.name = `floor-${room.id}`;
    mesh.userData.roomId = room.id;
    group.add(mesh);
  }

  // ── 4. 天花板（可选）──
  // 天花板用 rotateX(+π/2)（点不取反）→ Z=+y 且法线朝下，与墙体/地面一致。
  if (opts.ceiling) {
    const outer = json.wallLoops[0]?.outer ?? [];
    if (outer.length >= 3) {
      const geo = new THREE.ShapeGeometry(
        new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(M(x), M(y)))),
        12,
      );
      geo.rotateX(Math.PI / 2); // 朝下
      const mesh = new THREE.Mesh(geo, stdMat(resolveFace(style, "CEILING", "*").colorHex, { side: THREE.DoubleSide }));
      mesh.position.y = wallH;
      mesh.name = "ceiling";
      group.add(mesh);
    }
  }

  // ── 5. 家具（程序化摆件）──
  let furnitureCount = 0;
  for (const room of json.rooms) {
    const count = placeFurniture(group, room, style, wallH, overlay);
    furnitureCount += count;
  }

  // ── 6. 灯光 ──
  const lighting = style.lightingJson;
  const amb = new THREE.AmbientLight("#ffffff", lighting.ambientIntensity);
  amb.name = "ambient";
  group.add(amb);
  const hemi = new THREE.HemisphereLight("#e8f0ff", "#b0a090", lighting.keyIntensity * 0.4);
  group.add(hemi);
  const key = new THREE.DirectionalLight("#fff4e0", lighting.keyIntensity);
  key.position.set(8, 14, 6);
  key.castShadow = false;
  group.add(key);
  // 每个房间一盏点光（强度按面积）
  for (const room of json.rooms) {
    const [cx, cy] = room.centroidMm;
    const pt = new THREE.PointLight("#fff2df", Math.min(0.5, room.areaM2 * 0.02 + 0.15), M(7000), 1.6);
    pt.position.set(M(cx), wallH - 0.25, M(cy));
    group.add(pt);
  }

  const wallTris = wallMesh ? countTris(wallMesh.geometry) : 0;  return {
    group,
    stats: { wallTris, furnitureCount, buildMs: Math.round(performance.now() - t0), warnings },
  };
}

function polygonToShape(poly: [number, number][]): THREE.Shape | null {
  if (poly.length < 3) return null;
  return new THREE.Shape(poly.map(toPlane));
}

function mergeGeometries(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // 手写合并（避免引 BufferGeometryUtils 额外包路径差异）：统一为非索引
  const attrs = ["position", "normal", "uv"];
  const nonIndexed = geoms.map((g) => (g.index ? g.toNonIndexed() : g));
  const totals: Record<string, number> = {};
  for (const g of nonIndexed) {
    for (const a of attrs) {
      if (g.getAttribute(a)) totals[a] = (totals[a] ?? 0) + g.getAttribute(a).count;
    }
  }
  const out = new THREE.BufferGeometry();
  for (const a of attrs) {
    if (!totals[a]) continue;
    const itemSize = nonIndexed[0].getAttribute(a).itemSize;
    const arr = new Float32Array(totals[a] * itemSize);
    let off = 0;
    for (const g of nonIndexed) {
      const attr = g.getAttribute(a) as THREE.BufferAttribute | undefined;
      if (!attr) continue;
      arr.set(attr.array as Float32Array, off);
      off += attr.count * itemSize;
    }
    out.setAttribute(a, new THREE.BufferAttribute(arr, itemSize));
  }
  return out;
}

function countTris(g: THREE.BufferGeometry): number {
  if (g.index) return g.index.count / 3;
  const pos = g.getAttribute("position");
  return pos ? pos.count / 3 : 0;
}

// ───────────────────────── 程序化家具 ─────────────────────────

type BoxSpec = [number, number, number]; // w h d（米）

function boxAt(group: THREE.Group, spec: BoxSpec, x: number, y: number, z: number, rotY: number, mat: THREE.Material, name: string) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...spec), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.name = name;
  group.add(mesh);
  return mesh;
}

/**
 * 按房间类型布置程序化家具。多边形质心处放置主家具，
 * 位置基于房间包围盒（够用；后续可在编辑器中拖动调整）。
 */
export function placeFurniture(group: THREE.Group, room: RoomJson, style: StyleSeed, wallH: number, overlay?: BuildOptions["overlay"]): number {
  const poly = room.polygonMm;
  if (poly.length < 3) return 0;
  // 包围盒
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [px, py] of poly) {
    x0 = Math.min(x0, px); y0 = Math.min(y0, py);
    x1 = Math.max(x1, px); y1 = Math.max(y1, py);
  }
  const w = M(x1 - x0), d = M(y1 - y0);
  const cx = M((x0 + x1) / 2), cz = M((y0 + y1) / 2);
  const woodMat = stdMat(style.paletteJson.wood, { roughness: 0.55 });
  const fabMat = stdMat(style.paletteJson.neutral[0] ?? "#b8b0a4", { roughness: 0.95 });
  const accMat = stdMat(style.paletteJson.accent[0] ?? "#7c8b98", { roughness: 0.8 });
  const whiteMat = stdMat("#f4f4f2", { roughness: 0.35 });
  let n = 0;
  const put = (spec: BoxSpec, x: number, y: number, z: number, rot: number, mat: THREE.Material, name: string) => {
    boxAt(group, spec, x, y, z, rot, mat, name);
    n++;
  };

  switch (room.type) {
    case "living": {
      // 沙发（组合）+ 茶几 + 电视柜
      put([2.2, 0.42, 0.95], cx, 0.21, cz + d * 0.28, 0, fabMat, "sofa");
      put([0.9, 0.42, 0.95], cx - 1.45, 0.21, cz + d * 0.28, 0, fabMat, "sofa-arm");
      put([0.9, 0.42, 0.95], cx + 1.45, 0.21, cz + d * 0.28, 0, fabMat, "sofa-arm");
      put([1.4, 0.4, 0.7], cx, 0.2, cz, 0, woodMat, "coffee-table");
      put([1.8, 0.45, 0.42], cx, 0.23, cz - d * 0.38, 0, woodMat, "tv-cabinet");
      put([1.3, 0.75, 0.06], cx, 1.05, cz - d * 0.38, 0, stdMat("#101418", { roughness: 0.2 }), "tv");
      break;
    }
    case "bedroom":
    case "master": {
      // 床 + 床头柜 + 衣柜
      const bedW = Math.min(1.8, w * 0.55);
      put([bedW, 0.45, 2.05], cx, 0.23, cz + d * 0.12, 0, fabMat, "bed");
      put([bedW - 0.1, 0.14, 0.6], cx, 0.52, cz + d * 0.12 - 0.65, 0, whiteMat, "pillow");
      put([0.5, 0.5, 0.45], cx - bedW / 2 - 0.35, 0.25, cz + d * 0.12 - 0.8, 0, woodMat, "nightstand");
      put([Math.min(2.1, w * 0.6), 2.3, 0.6], x0 === -Infinity ? cx : M(x0) + Math.min(2.1, w * 0.6) / 2 + 0.1, 1.15, M(y0) + 0.32, 0, woodMat, "wardrobe");
      break;
    }
    case "kitchen": {
      // 橱柜台面沿墙
      put([Math.min(w - 0.3, 2.4), 0.85, 0.6], cx, 0.43, M(y0) + 0.32, 0, faceMat(style, "CABINET", room.type, room.id, overlay), "counter");
      put([Math.min(w - 0.3, 2.4), 0.04, 0.62], cx, 0.87, M(y0) + 0.32, 0, stdMat("#2a2e33", { roughness: 0.3 }), "counter-top");
      break;
    }
    case "bath": {
      put([0.42, 0.42, 0.65], cx - w * 0.2, 0.21, cz - d * 0.25, 0, whiteMat, "toilet");
      put([0.55, 0.85, 0.45], cx + w * 0.2, 0.43, cz - d * 0.25, 0, whiteMat, "basin");
      break;
    }
    case "balcony": {
      put([1.5, 0.65, 0.45], cx, 0.33, cz - d * 0.2, 0, accMat, "plant-rack");
      break;
    }
    default:
      break;
  }
  return n;
}

function faceMat(style: StyleSeed, target: FaceTarget, roomType: string, roomId?: string, overlay?: BuildOptions["overlay"]): THREE.MeshStandardMaterial {
  const face = resolveFace(style, target, roomType, roomId, overlay);
  return stdMat(face.colorHex, {
    roughness: face.material?.roughness ?? 0.85,
    metalness: face.material?.metallic ?? 0.02,
  });
}
