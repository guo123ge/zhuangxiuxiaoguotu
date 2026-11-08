/**
 * 程序化贴图生成器。
 *
 * 根据材质的真实规格（tileSizeUMm/tileSizeVMm）与铺装样式（TILE/PLANK/…），
 * 用 Canvas 生成可平铺纹理；在三维场景中按「每 tileSize 米重复一次」设置 UV，
 * 使 800×800 瓷砖在房间里呈现为真实的 800mm 见方，而非拉伸到整面。
 * 这是「尺寸可信」承诺的贴图基础。
 */
import * as THREE from "three";
import type { MaterialSeed } from "../materials.ts";

const PX_PER_MM = 0.3; // 每毫米 0.3px（800mm 瓷砖 → 240px 纹理）

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 基于材质 id 的确定性伪随机：同一材质每次重建纹理完全一致，避免切风格时木纹跳变 */
function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(wPx: number, hPx: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(wPx));
  c.height = Math.max(1, Math.round(hPx));
  const ctx = c.getContext("2d")!;
  return [c, ctx];
}

function fillBase(ctx: CanvasRenderingContext2D, mat: MaterialSeed, w: number, h: number) {
  const [r, g, b] = hexToRgb(mat.colorHex);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, w, h);
}

function addSheen(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "rgba(255,255,255,0.10)");
  grad.addColorStop(0.5, "rgba(255,255,255,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.06)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

/** 瓷砖：主色 + 四周 grout 缝 */
function drawTile(mat: MaterialSeed): HTMLCanvasElement {
  const w = mat.tileSizeUMm * PX_PER_MM;
  const h = mat.tileSizeVMm * PX_PER_MM;
  const [c, ctx] = makeCanvas(w, h);
  fillBase(ctx, mat, w, h);
  const grout = mat.groutMm * PX_PER_MM;

  // 缝：边缘一圈浅灰
  if (grout > 0) {
    ctx.fillStyle = "rgba(120,120,120,0.55)";
    ctx.fillRect(0, 0, w, grout); // 上
    ctx.fillRect(0, h - grout, w, grout); // 下
    ctx.fillRect(0, 0, grout, h); // 左
    ctx.fillRect(w - grout, 0, grout, h); // 右
  }
  addSheen(ctx, w, h);
  return c;
}

/** 木地板/木饰面：主色 + 木纹细线 + 分缝（确定性纹理） */
function drawPlank(mat: MaterialSeed): HTMLCanvasElement {
  const w = mat.tileSizeUMm * PX_PER_MM;
  const h = mat.tileSizeVMm * PX_PER_MM;
  const [c, ctx] = makeCanvas(w, h);
  fillBase(ctx, mat, w, h);
  const rand = seededRandom(mat.id);
  // 木纹：纵向细线
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 1;
  const lines = Math.max(3, Math.floor(w / 26));
  for (let i = 0; i < lines; i++) {
    const x = (i + 0.5) * (w / lines) + (rand() - 0.5) * 6;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 4, h * 0.33, x - 4, h * 0.66, x + 2, h);
    ctx.stroke();
  }
  // 板条分缝：左右边缘深色
  if (mat.groutMm > 0) {
    const seam = mat.groutMm * PX_PER_MM;
    ctx.fillStyle = "rgba(60,40,25,0.35)";
    ctx.fillRect(0, 0, seam, h);
    ctx.fillRect(w - seam, 0, seam, h);
  }
  return c;
}

/** 砖砌：错缝排布，边界处补画保证可平铺 */
function drawBrick(mat: MaterialSeed): HTMLCanvasElement {
  const w = mat.tileSizeUMm * PX_PER_MM;
  const h = mat.tileSizeVMm * PX_PER_MM;
  const [c, ctx] = makeCanvas(w, h);
  fillBase(ctx, mat, w, h);
  const seam = Math.max(1, mat.groutMm * PX_PER_MM);
  const rows = 4;
  const rowH = h / rows;
  ctx.fillStyle = "rgba(90,80,70,0.38)";
  for (let i = 0; i <= rows; i++) {
    ctx.fillRect(0, i * rowH - seam / 2, w, seam);
  }
  for (let i = 0; i < rows; i++) {
    const offset = (i % 2) * (w / 4);
    for (let j = 0; j < 2; j++) {
      const x = offset + j * (w / 2);
      ctx.fillRect(x - seam / 2, i * rowH, seam, rowH);
      ctx.fillRect(x + w - seam / 2, i * rowH, seam, rowH);
    }
  }
  addSheen(ctx, w, h);
  return c;
}

/** 人字拼：两组斜向板条构成 V 形，叠加确定性细木纹 */
function drawHerringbone(mat: MaterialSeed): HTMLCanvasElement {
  const w = mat.tileSizeUMm * PX_PER_MM;
  const h = mat.tileSizeVMm * PX_PER_MM;
  const [c, ctx] = makeCanvas(w, h);
  fillBase(ctx, mat, w, h);
  const seam = Math.max(1, mat.groutMm * PX_PER_MM);
  const step = Math.max(14, Math.min(w, h) / 3);
  ctx.strokeStyle = "rgba(60,45,30,0.34)";
  ctx.lineWidth = seam;
  for (let k = -3; k < 10; k++) {
    ctx.beginPath();
    ctx.moveTo(k * step, 0);
    ctx.lineTo(k * step + h, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(k * step, 0);
    ctx.lineTo(k * step - h, h);
    ctx.stroke();
  }
  const rand = seededRandom(mat.id + "-herringbone");
  ctx.strokeStyle = "rgba(0,0,0,0.09)";
  ctx.lineWidth = 1;
  for (let i = 0; i < Math.floor(w / 8); i++) {
    const x = i * 8 + rand() * 3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + h * 0.35, h);
    ctx.stroke();
  }
  return c;
}

/** 生成材质的平铺纹理；PLAIN 返回 null（纯色即可）；Node 环境无 DOM 时返回 null */
export function makeMaterialTexture(mat: MaterialSeed): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null; // 服务端/测试环境退化为纯色
  if (mat.pattern === "PLAIN") return null;
  let canvas: HTMLCanvasElement;
  switch (mat.pattern) {
    case "PLANK":
      canvas = drawPlank(mat);
      break;
    case "HERRINGBONE":
      canvas = drawHerringbone(mat);
      break;
    case "BRICK":
      canvas = drawBrick(mat);
      break;
    default:
      canvas = drawTile(mat);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** 材质平铺 repeat：使纹理每 tileSize 米重复一次（ShapeGeometry UV 单位 = 米） */
export function materialRepeat(mat: MaterialSeed): [number, number] {
  const u = mat.tileSizeUMm / 1000;
  const v = mat.tileSizeVMm / 1000;
  return [1 / u, 1 / v];
}
