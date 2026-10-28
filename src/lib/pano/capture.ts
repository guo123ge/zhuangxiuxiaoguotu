"use client";

/**
 * 全景图捕获（浏览器端）：在给定位置用 CubeCamera 渲染六面 cubemap，
 * 再用等距圆柱投影着色器合成 2:1 全景图，输出 dataURL 供 PSV 显示。
 *
 * 几何、尺寸、视角全部来自三维场景，保证效果图与漫游同源一致。
 */
import * as THREE from "three";

export type CaptureResult = {
  dataUrl: string;
  width: number;
  height: number;
};

const EQ_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const EQ_FRAG = /* glsl */ `
varying vec2 vUv;
uniform samplerCube uMap;
const float PI = 3.1415926535897932384626433832795;
void main() {
  float lon = (vUv.x - 0.5) * 2.0 * PI;   // 经度
  float lat = (0.5 - vUv.y) * PI;          // 纬度
  vec3 dir = vec3(
    cos(lat) * sin(lon),
    sin(lat),
    cos(lat) * cos(lon)
  );
  gl_FragColor = texture(uMap, dir);
}
`;

/** 捕获一张 2:1 全景图 */
export function capturePanorama(
  scene: THREE.Object3D,
  position: THREE.Vector3,
  opts: { width?: number; eyeHeight?: number; near?: number; far?: number } = {},
): CaptureResult {
  const width = opts.width ?? 1024; // 每面分辨率；全景输出 2*width × width（2:1 等距圆柱）
  const height = width; // 输出高度 = 立方体单面尺寸（2:1 才能正确映射 360°×180°）
  const eye = opts.eyeHeight ?? 1.6;

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(width, height, false);

  const cubeTarget = new THREE.WebGLCubeRenderTarget(width, {
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });

  const cubeCamera = new THREE.CubeCamera(opts.near ?? 0.1, opts.far ?? 50, cubeTarget);
  cubeCamera.position.copy(position);
  cubeCamera.update(renderer, scene);

  // 等距圆柱合成
  const quad = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({
    vertexShader: EQ_VERT,
    fragmentShader: EQ_FRAG,
    uniforms: { uMap: { value: cubeCamera.renderTarget.texture } },
    depthTest: false,
    depthWrite: false,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.add(plane);

  renderer.setRenderTarget(null);
  renderer.setSize(width * 2, height, false);
  renderer.render(quad, cam);

  const canvas = renderer.domElement;
  const dataUrl = canvas.toDataURL("image/jpeg", 0.86);

  // 先释放 renderTarget（需在 renderer 尚存活时反分配 GPU 资源），
  // 再释放 renderer——顺序反了会在 three 0.185 的 deallocateRenderTarget 里
  // 因 __webglFramebuffer 已清空而抛「reading '0'」。
  cubeTarget.dispose();
  mat.dispose();
  plane.geometry.dispose();
  renderer.dispose();
  // 主动丢失上下文，避免多途经点连续捕获时 WebGL 上下文累积耗尽
  renderer.forceContextLoss();

  return { dataUrl, width: width * 2, height };
}
