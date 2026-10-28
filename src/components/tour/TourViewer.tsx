"use client";

/**
 * 全景入户漫游查看器。
 *
 * 流程：buildHouse(带天花板) → planTour 生成路径 → 在每个途经点
 * capturePanorama 渲染 2:1 全景 → Photo Sphere Viewer 展示，
 * 热点指向相邻途经点，小地图显示路径与当前位置，支持自动导览。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";
import { Viewer } from "@photo-sphere-viewer/core";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import { buildHouse } from "@/lib/model3d/builder";
import { capturePanorama } from "@/lib/pano/capture";
import { planTour, type WaypointPlan } from "@/lib/pano/route";
import { styleById } from "@/lib/styles";
import type { FloorplanJson } from "@/lib/parse/pipeline";

type Pano = {
  wp: WaypointPlan;
  dataUrl: string;
  yawToNext: number; // 弧度
};

export default function TourViewer({ json, styleId = "modern-minimal", projectId }: { json: FloorplanJson; styleId?: string; projectId?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const markersRef = useRef<MarkersPlugin | null>(null);
  const [panos, setPanos] = useState<Pano[]>([]);
  const [current, setCurrent] = useState(0);
  const [status, setStatus] = useState("准备中…");
  const [auto, setAuto] = useState(false);
  const currentRef = useRef(0);
  const goToRef = useRef<(idx: number) => void>(() => {});
  const busyRef = useRef(false);

  const route = useMemo(() => planTour(json), [json]);

  // ── 1. 加载全景：优先命中落库缓存，否则现场捕获并回存 ──
  useEffect(() => {
    let cancelled = false;

    const loadCached = async (): Promise<Pano[] | null> => {
      if (!projectId) return null;
      try {
        const res = await fetch(`/api/projects/${projectId}/tour?styleId=${encodeURIComponent(styleId)}`);
        const data = await res.json();
        if (!data.found || !data.scenes?.length) return null;
        // 缓存命中：途经点用本地 planTour（确定性一致），全景图用缓存 URL
        return data.scenes.map((s: { url: string; initialYaw: number; order: number }, i: number) => ({
          wp: route.waypoints[i] ?? route.waypoints[route.waypoints.length - 1],
          dataUrl: s.url,
          yawToNext: s.initialYaw,
        }));
      } catch {
        return null;
      }
    };

    const captureAndSave = async (): Promise<Pano[]> => {
      setStatus("构建三维场景…");
      const style = styleById.get(styleId) ?? styleById.get("modern-minimal")!;
      const { group } = buildHouse(json, { style, ceiling: true });
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#f5f1ea");
      scene.add(group);

      const result: Pano[] = [];
      for (let i = 0; i < route.waypoints.length; i++) {
        if (cancelled) return result;
        const wp = route.waypoints[i];
        setStatus(`渲染全景 ${i + 1}/${route.waypoints.length}：${wp.label}`);
        await new Promise((r) => setTimeout(r, 30));
        const pos = new THREE.Vector3(wp.xMm / 1000, 1.6, wp.yMm / 1000);
        const { dataUrl } = capturePanorama(scene, pos, { width: 640 });
        const nxt = route.waypoints[Math.min(i + 1, route.waypoints.length - 1)];
        const yawToNext = Math.atan2((nxt.xMm - wp.xMm) / 1000, (nxt.yMm - wp.yMm) / 1000);
        result.push({ wp, dataUrl, yawToNext });
      }
      return result;
    };

    (async () => {
      try {
        const cached = await loadCached();
        if (cached) {
          if (!cancelled) { setPanos(cached); setStatus("已加载缓存全景"); }
          return;
        }
        const result = await captureAndSave();
        if (cancelled) return;
        setPanos(result);
        setStatus("完成");
        // 回存（后台，不阻塞展示）
        if (projectId && result.length > 0) {
          fetch(`/api/projects/${projectId}/tour`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              styleId,
              waypoints: route.waypoints.map((w) => ({ xMm: w.xMm, zMm: w.yMm, yaw: w.yaw, order: w.order, label: w.label, roomId: w.roomId })),
              path: [],
              segments: route.segments,
              scenes: result.map((p, i) => ({ index: i, dataUrl: p.dataUrl, yaw: p.yawToNext })),
            }),
          }).catch(() => {});
        }
      } catch (e) {
        console.error("[tour] 捕获全景失败:", (e as Error).message);
        console.error("[tour] stack:", (e as Error).stack);
        setStatus(`渲染失败：${(e as Error).message}`);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [json, styleId, projectId]);

  // ── 2. 初始化 PSV ──
  useEffect(() => {
    if (panos.length === 0 || !containerRef.current) return;
    let viewer: Viewer;
    try {
      viewer = new Viewer({
        container: containerRef.current,
        panorama: panos[0].dataUrl,
        defaultZoomLvl: 50,
        mousewheel: true,
        navbar: "zoom caption",
        caption: panos[0].wp.label,
        loadingTxt: "加载全景…",
        plugins: [[MarkersPlugin, {}]],
      });
    } catch (e) {
      setStatus(`全景查看器初始化失败：${(e as Error).message}`);
      return;
    }
    viewerRef.current = viewer;
    markersRef.current = viewer.getPlugin(MarkersPlugin) as MarkersPlugin;
    // 热点跳转监听只绑定一次，避免重复叠加导致多次跳转
    markersRef.current.addEventListener("select-marker", (e: { marker: { data?: { ni?: number } } }) => {
      const ni = e.marker?.data?.ni;
      if (typeof ni === "number") goToRef.current(ni);
    });
    return () => {
      viewer.destroy();
      viewerRef.current = null;
      markersRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panos]);

  const renderMarkers = (idx: number) => {
    const markers = markersRef.current;
    if (!markers) return;
    markers.clearMarkers();
    const n = panos.length;
    // 前一/后一各一个热点，末点只有回退
    const targets = [
      { dir: -1, label: "← 上一处" },
      { dir: 1, label: "下一处 →" },
    ];
    for (const t of targets) {
      const ni = (idx + t.dir + n) % n;
      if (ni === idx) continue;
      const p = panos[idx];
      const yaw = t.dir > 0 ? p.yawToNext : p.yawToNext + Math.PI;
      const pitch = 0;
      markers.addMarker({
        id: `nav-${ni}`,
        position: { yaw: `${((yaw * 180) / Math.PI).toFixed(1)}deg`, pitch: `${pitch}deg` },
        html: `<button class="vr-hotspot" type="button"><span></span>${t.label}</button>`,
        size: { width: 132, height: 44 },
        anchor: "center center",
        tooltip: panos[ni].wp.label,
        data: { ni },
      });
    }
  };

  const goTo = (idx: number) => {
    const p = panos[idx];
    if (!p || !viewerRef.current) return;
    if (busyRef.current) return; // 避免过渡期间重复触发导致画面错乱
    busyRef.current = true;
    currentRef.current = idx;
    setCurrent(idx);
    viewerRef.current
      .setPanorama(p.dataUrl, { caption: p.wp.label, transition: true, showLoader: true })
      .then(() => {
        renderMarkers(idx);
      })
      .catch(() => {})
      .finally(() => {
        busyRef.current = false;
      });
  };
  // 供热点监听等闭包安全引用最新 goTo
  goToRef.current = goTo;

  useEffect(() => {
    if (panos.length > 0) renderMarkers(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panos]);

  // ── 3. 自动导览 ──
  useEffect(() => {
    if (!auto || panos.length < 2) return;
    const t = setInterval(() => {
      goTo((currentRef.current + 1) % panos.length);
    }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, panos]);

  const minimap = useMemo(() => {
    const [bx0, by0, bx1, by1] = json.buildingBoxMm;
    const w = Math.max(bx1 - bx0, 1);
    const h = Math.max(by1 - by0, 1);
    const s = Math.min(340 / w, 340 / h);
    const X = (x: number) => (x - bx0) * s + 10;
    const Y = (y: number) => (y - by0) * s + 10;
    return { X, Y, w: w * s + 20, h: h * s + 20, s };
  }, [json]);

  return (
    <div className="flex h-full gap-3">
      {/* 全景 */}
      <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
        {panos.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-300">{status}</div>
        ) : (
          <div ref={containerRef} className="h-full w-full" />
        )}
      </div>

      {/* 侧栏：小地图 + 途经点 + 控制 */}
      <div className="flex w-60 shrink-0 flex-col gap-2 overflow-y-auto">
        <svg width={minimap.w} height={minimap.h} className="rounded border border-slate-200 bg-white">
          {json.rooms.map((r) => (
            <polygon
              key={r.id}
              points={r.polygonMm.map(([x, y]) => `${minimap.X(x)},${minimap.Y(y)}`).join(" ")}
              fill="#eef2ff"
              stroke="#c7d2fe"
              strokeWidth={1}
            />
          ))}
          {/* 路径 */}
          {route.segments.map((seg, i) => (
            <line
              key={i}
              x1={minimap.X(seg[0][0])} y1={minimap.Y(seg[0][1])}
              x2={minimap.X(seg[1][0])} y2={minimap.Y(seg[1][1])}
              stroke="#8b5cf6" strokeWidth={2}
            />
          ))}
          {route.waypoints.map((wp, i) => (
            <circle
              key={wp.id}
              cx={minimap.X(wp.xMm)} cy={minimap.Y(wp.yMm)}
              r={i === current ? 5 : 3}
              fill={i === current ? "#8b5cf6" : "#64748b"}
            />
          ))}
        </svg>

        <div className="rounded border border-slate-200 bg-white p-2">
          <div className="mb-1 text-xs font-medium text-slate-600">漫游路径（{route.waypoints.length} 站）</div>
          <ul className="space-y-1">
            {route.waypoints.map((wp, i) => (
              <li
                key={wp.id}
                className={`cursor-pointer rounded px-2 py-1 text-xs ${i === current ? "bg-violet-50 text-violet-700" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => panos.length > 0 && goTo(i)}
              >
                {i + 1}. {wp.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-2">
          <button className="flex-1 rounded bg-slate-800 py-1.5 text-xs text-white hover:bg-slate-700" onClick={() => goTo(Math.max(0, current - 1))}>
            ← 上一处
          </button>
          <button className="flex-1 rounded bg-slate-800 py-1.5 text-xs text-white hover:bg-slate-700" onClick={() => goTo(Math.min(panos.length - 1, current + 1))}>
            下一处 →
          </button>
        </div>
        <button
          className={`rounded py-1.5 text-xs ${auto ? "bg-red-500 text-white" : "bg-violet-600 text-white hover:bg-violet-700"}`}
          onClick={() => setAuto((v) => !v)}
        >
          {auto ? "停止导览" : "▶ 自动导览"}
        </button>
      </div>
    </div>
  );
}
