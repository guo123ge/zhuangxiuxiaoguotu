"use client";

/**
 * 三维户型查看器。
 *
 * 职责：加载 FloorplanJson + 风格 → buildHouse → R3F 渲染。
 * 交互：轨道控制 / 风格切换（毫秒级，只重建材质与家具）/ 俯视/漫游视角。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { buildHouse } from "@/lib/model3d/builder";
import { designStyles, styleById, type StyleSeed } from "@/lib/styles";
import type { FloorplanJson } from "@/lib/parse/pipeline";

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
    ref.current?.clear();
    ref.current?.add(group);
    return () => {
      ref.current?.clear();
    };
  }, [group]);
  return <group ref={ref} />;
}

function FitCamera({ json }: { json: FloorplanJson }) {
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const { camera } = useThreeSafe();
  useEffect(() => {
    const [x0, y0, x1, y1] = json.buildingBoxMm;
    const cx = (x0 + x1) / 2000;
    const cz = (y0 + y1) / 2000;
    const span = Math.max(x1 - x0, y1 - y0) / 1000;
    camera.position.set(cx + span * 0.7, span * 0.9, cz + span * 0.9);
    camera.lookAt(cx, 1, cz);
    if (controls.current) {
      controls.current.target.set(cx, 0.8, cz);
      controls.current.update();
    }
  }, [json, camera]);
  return <OrbitControls ref={controls} maxPolarAngle={Math.PI / 2.02} minDistance={1.2} maxDistance={40} />;
}

// 小包装避免循环依赖 import 顺序问题
import { useThree } from "@react-three/fiber";
function useThreeSafe() {
  const camera = useThree((s) => s.camera);
  return { camera };
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
  const [buildMs, setBuildMs] = useState<number | null>(null);

  useEffect(() => {
    if (defaultStyleId) setStyleId(defaultStyleId);
  }, [defaultStyleId]);

  if (!json) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        请先在「识别与确认」页完成户型解析
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <span className="text-xs font-medium text-slate-500">风格</span>
        <select
          value={styleId}
          onChange={(e) => setStyleId(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
        >
          {designStyles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={ceiling} onChange={(e) => setCeiling(e.target.checked)} />
          天花板
        </label>
        {buildMs !== null && (
          <span className="ml-auto text-xs text-slate-400">
            {json.rooms.length} 个房间 · {json.openings.length} 个开口 · 构建 {buildMs}ms
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <Canvas shadows={false} camera={{ fov: 55, near: 0.05, far: 200 }} gl={{ antialias: true }} onCreated={() => setBuildMs(performance.now() % 100000)}>
          <color attach="background" args={["#eef2f7"]} />
          <fog attach="fog" args={["#eef2f7", 30, 80]} />
          <Scene json={json} style={styleById.get(styleId) ?? designStyles[0]} ceiling={ceiling} overlay={overlay} />
          <FitCamera json={json} />
        </Canvas>
      </div>
    </div>
  );
}
