/**
 * 渲染参数单一真相源。
 *
 * R3F 的 <Canvas> 与全景捕获用的裸 WebGLRenderer 各有默认值，
 * 此前 3D 视口用 ACESFilmic、捕获用 NoToneMapping，导致「同源」的
 * 两个画面色调不一致。两处都从这里取值，不再依赖框架默认值漂移。
 */
import * as THREE from "three";

export const RENDER_CONFIG = {
  toneMapping: THREE.ACESFilmicToneMapping,
  toneMappingExposure: 1,
  outputColorSpace: THREE.SRGBColorSpace,

  /** 3D 视口与全景场景共用背景色（深色主题下的中性影棚底色） */
  background: "#1a2133",
  fogNear: 30,
  fogFar: 80,

  /** 全景每面分辨率；输出为 2*width × width 的等距圆柱图 */
  panoramaFaceWidth: 960,
  /** 站点较多或窄屏时回落，控制六面渲染与 base64 体积 */
  panoramaFaceWidthFallback: 640,
  /** 超过该站点数自动回落，避免总耗时线性放大 */
  panoramaFallbackWaypoints: 5,
} as const;
