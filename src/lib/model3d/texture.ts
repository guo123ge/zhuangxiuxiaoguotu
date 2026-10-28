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

function makeCanvas(wPx: number, hPx: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(wPx));
  c.height = Math.max(1, Math.round(hPx));
  const ctx = c.getContext("2d")!;
  return [c, ctx];
}

/** 瓷砖：主色 + 四周 grout 缝 */
function drawTile(mat: MaterialSeed): HTMLCanvasElement {
  const w = mat.tileSizeUMm * PX_PER_MM;
  const h = mat.tileSizeVMm * PX_PER_MM;
  const [c, ctx] = makeCanvas(w, h);
  const [r, g, b] = hexToRgb(mat.colorHex);
  const grout = mat.groutMm * PX_PER_MM;

  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, w, h);
  // 缝：边缘一圈浅灰
  if (grout > 0) {
    ctx.fillStyle = "rgba(120,120,120,0.55)";
    ctx.fillRect(0, 0, w, grout); // 上
    ctx.fillRect(0, h - grout, w, grout); // 下
    ctx.fillRect(0, 0, grout, h); // 左
    ctx.fillRect(w - grout, 0, grout, h); // 右
  }
  // 瓷砖微高光渐变
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "rgba(255,255,255,0.10)");
  grad.addColorStop(0.5, "rgba(255,255,255,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.06)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  return c;
}

/** 木地板/木饰面：主色 + 木纹细线 + 分缝 */
function drawPlank(mat: MaterialSeed): HTMLCanvasElement {
  const w = mat.tileSizeUMm * PX_PER_MM;
  const h = mat.tileSizeVMm * PX_PER_MM;
  const [c, ctx] = makeCanvas(w, h);
  const [r, g, b] = hexToRgb(mat.colorHex);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, w, h);
  // 木纹：纵向细线
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 1;
  const lines = Math.max(3, Math.floor(w / 26));
  for (let i = 0; i < lines; i++) {
    const x = (i + 0.5) * (w / lines) + (Math.random() - 0.5) * 6;
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

/** 生成材质的平铺纹理；PLAIN 返回 null（纯色即可）；Node 环境无 DOM 时返回 null */
export function makeMaterialTexture(mat: MaterialSeed): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null; // 服务端/测试环境退化为纯色
  if (mat.pattern === "PLAIN" || mat.pattern === "HERRINGBONE" || mat.pattern === "BRICK") {
    return null;
  }
  const canvas = mat.pattern === "PLANK" ? drawPlank(mat) : drawTile(mat);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** 材质平铺 repeat：使纹理每 tileSize 米重复一次（ShapeGeometry UV 单位 = 米） */
export function materialRepeat(mat: MaterialSeed): [number, number] {
  const u = mat.tileSizeUMm / 1000;
  const v = mat.tileSizeVMm / 1000;
  return [1 / u, 1 / v];
}
