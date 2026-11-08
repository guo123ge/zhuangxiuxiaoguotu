"use client";

/**
 * 三维户型查看器。
 *
 * 职责：加载 FloorplanJson + 风格 → buildHouse → R3F 渲染。
 * 交互：轨道控制 / 风格切换（毫秒级，只重建材质与家具）/ 俯视视角。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { EmptyState } from "@/components/ui";
import { buildHouse } from "@/lib/model3d/builder";
import { RENDER_CONFIG } from "@/lib/model3d/renderConfig";
import { designStyles, styleById, type StyleSeed } from "@/lib/styles";
import type { FloorplanJson } from "@/lib/parse/pipeline";

const compactSelectCls =
  "rounded-lg border border-white/[0.08] bg-surface/80 px-2.5 py-1.5 text-sm text-ink outline-none transition-all focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/45";

function Scene({
  json,
  style,
  ceiling,
  overlay,
}: {
  json: FloorplanJson;
  style: StyleSeed;
  ceiling: boolean;
  overlay?: Record<string, Partial<Record<"floor" | "wall" | "ceiling" | "cabinet", string>>>;
}) {
  const { group } = useMemo(() => buildHouse(json, { style, ceiling, overlay }), [json, style, ceiling, overlay]);
  const ref = useRef<THREE.Group>(null);
  useEffect(() => {
    const node = ref.current;
    node?.clear();
    node?.add(group);
    return () => {
      node?.clear();
      // 切换风格会重建整组几何/材质/贴图；显式释放，避免 GPU 内存持续增长。
      // 用 Set 去重：接地阴影贴图被多个 mesh 共享，不能重复 dispose。
      const disposed = new Set<THREE.Material | THREE.Texture>();
      group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : mesh.material
            ? [mesh.material]
            : [];
        for (const m of mats) {
          if (disposed.has(m)) continue;
          disposed.add(m);
          const map = (m as THREE.MeshStandardMaterial).map;
          if (map && !disposed.has(map)) {
            disposed.add(map);
            map.dispose();
          }
          m.dispose();
        }
      });
    };
  }, [group]);
  return <group ref={ref} />;
}

function FitCamera({ json }: { json: FloorplanJson }) {
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);
  const [x0, y0, x1, y1] = json.buildingBoxMm;
  const span = Math.max(x1 - x0, y1 - y0) / 1000;
  useEffect(() => {
    const cx = (x0 + x1) / 2000;
    const cz = (y0 + y1) / 2000;
    camera.position.set(cx + span * 0.7, span * 0.9, cz + span * 0.9);
    camera.lookAt(cx, 1, cz);
    if (controls.current) {
      controls.current.target.set(cx, 0.8, cz);
      controls.current.update();
    }
  }, [json, camera, x0, x1, y0, y1, span]);
  return (
    <OrbitControls
      ref={controls}
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={Math.PI / 2.02}
      minDistance={1.2}
      maxDistance={Math.max(40, span * 3)}
    />
  );
}

export default function ModelViewer({
  json,
  overlay,
  defaultStyleId,
}: {
  json: FloorplanJson | null;
  overlay?: Record<string, Partial<Record<"floor" | "wall" | "ceiling" | "cabinet", string>>>;
  defaultStyleId?: string;
}) {
  const [styleId, setStyleId] = useState(defaultStyleId ?? "modern-minimal");
  const [ceiling, setCeiling] = useState(false);

  useEffect(() => {
    if (defaultStyleId) setStyleId(defaultStyleId);
  }, [defaultStyleId]);

  if (!json) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState title="暂无三维模型" description="请先在「户型识别」页完成户型解析" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface/80 px-4 py-2">
        <label htmlFor="model-style" className="text-xs font-medium text-ink-soft">风格</label>
        <select
          id="model-style"
          aria-label="装修风格"
          value={styleId}
          onChange={(e) => setStyleId(e.target.value)}
          className={compactSelectCls}
        >
          {designStyles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-ink-soft">
          <input
            type="checkbox"
            className="accent-primary"
            checked={ceiling}
            onChange={(e) => setCeiling(e.target.checked)}
          />
          天花板
        </label>
        <span className="ml-auto text-xs text-ink-mute">
          {json.rooms.length} 个房间 · {json.openings.length} 个开口
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <Canvas
          shadows={false}
          dpr={[1, 2]}
          camera={{ fov: 55, near: 0.05, far: 200 }}
          gl={{ antialias: true }}
          onCreated={({ gl }) => {
            gl.toneMapping = RENDER_CONFIG.toneMapping;
            gl.toneMappingExposure = RENDER_CONFIG.toneMappingExposure;
            gl.outputColorSpace = RENDER_CONFIG.outputColorSpace;
          }}
        >
          <color attach="background" args={[RENDER_CONFIG.background]} />
          <fog attach="fog" args={[RENDER_CONFIG.background, RENDER_CONFIG.fogNear, RENDER_CONFIG.fogFar]} />
          <Scene json={json} style={styleById.get(styleId) ?? designStyles[0]} ceiling={ceiling} overlay={overlay} />
          <FitCamera json={json} />
        </Canvas>
      </div>
    </div>
  );
}
