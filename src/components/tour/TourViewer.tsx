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
import { ChevronLeft, ChevronRight, Play, Square } from "lucide-react";
import { Button, ProgressBar, Spinner } from "@/components/ui";
import { buildHouse } from "@/lib/model3d/builder";
import { RENDER_CONFIG } from "@/lib/model3d/renderConfig";
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
  const [status, setStatus] = useState("正在准备漫游…");
  const [auto, setAuto] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [retryKey, setRetryKey] = useState(0);
  const currentRef = useRef(0);
  const goToRef = useRef<(idx: number) => void>(() => {});
  const busyRef = useRef(false);

  const route = useMemo(() => planTour(json), [json]);

  // 全景清晰度分档：站点多或窄屏时自动回落，避免六面渲染与 base64 体积线性放大。
  // 缓存命中时沿用既有清晰度（不改 /api/tour 的请求或返回格式）。
  const quality = useMemo(() => {
    const [bx0, by0, bx1, by1] = json.buildingBoxMm;
    const buildingDiagonalM = Math.hypot(bx1 - bx0, by1 - by0) / 1000;
    const narrow = typeof window !== "undefined" && window.innerWidth < 1280;
    const fallback =
      route.waypoints.length >= RENDER_CONFIG.panoramaFallbackWaypoints || narrow;
    return {
      width: fallback
        ? RENDER_CONFIG.panoramaFaceWidthFallback
        : RENDER_CONFIG.panoramaFaceWidth,
      buildingDiagonalM,
    };
  }, [json, route.waypoints.length]);

  // ── 1. 加载全景：优先命中落库缓存，否则现场捕获并回存 ──
  useEffect(() => {
    let cancelled = false;
    setFailed(false);

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
      setStatus("正在生成空间…");
      const style = styleById.get(styleId) ?? styleById.get("modern-minimal")!;
      const { group } = buildHouse(json, { style, ceiling: true });
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(RENDER_CONFIG.background);
      scene.add(group);

      const result: Pano[] = [];
      const total = route.waypoints.length;
      setProgress({ current: 0, total });
      for (let i = 0; i < total; i++) {
        if (cancelled) return result;
        const wp = route.waypoints[i];
        setStatus(`正在渲染第 ${i + 1} / ${total} 处：${wp.label}`);
        setProgress({ current: i, total });
        await new Promise((r) => setTimeout(r, 30));
        const pos = new THREE.Vector3(wp.xMm / 1000, 1.6, wp.yMm / 1000);
        const { dataUrl } = capturePanorama(scene, pos, {
          width: quality.width,
          buildingDiagonalM: quality.buildingDiagonalM,
        });
        const nxt = route.waypoints[Math.min(i + 1, total - 1)];
        const yawToNext = Math.atan2((nxt.xMm - wp.xMm) / 1000, (nxt.yMm - wp.yMm) / 1000);
        result.push({ wp, dataUrl, yawToNext });
      }
      setProgress({ current: total, total });
      return result;
    };

    (async () => {
      try {
        const cached = await loadCached();
        if (cached) {
          if (!cancelled) { setPanos(cached); setStatus("已就绪"); }
          return;
        }
        const result = await captureAndSave();
        if (cancelled) return;
        setPanos(result);
        setStatus("已就绪");
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
        setStatus("漫游生成失败，请稍后重试");
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [json, styleId, projectId, retryKey]);

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
        navbar: "zoom caption fullscreen",
        caption: panos[0].wp.label,
        loadingTxt: "加载全景…",
        plugins: [[MarkersPlugin, {}]],
      });
    } catch (e) {
      console.error("[tour] 全景查看器初始化失败:", (e as Error).message);
      setStatus("全景查看器初始化失败，请重试");
      setFailed(true);
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
    try {
      markers.clearMarkers();
      const n = panos.length;
      const seen = new Set<string>();
      // 前一/后一各一个热点，末点只有回退
      const targets = [
        { dir: -1, label: "上一处" },
        { dir: 1, label: "下一处" },
      ];
      for (const t of targets) {
        const ni = (idx + t.dir + n) % n;
        if (ni === idx) continue;
        const id = `nav-${ni}`;
        // 去重：路径仅 2 站时「上一处/下一处」指向同一站，避免重复 id 触发 "marker already exists"
        if (seen.has(id)) continue;
        seen.add(id);
        const p = panos[idx];
        const yaw = t.dir > 0 ? p.yawToNext : p.yawToNext + Math.PI;
        const pitch = 0;
        markers.addMarker({
          id,
          position: { yaw: `${((yaw * 180) / Math.PI).toFixed(1)}deg`, pitch: `${pitch}deg` },
          html: `<button class="vr-hotspot" type="button">${t.label}</button>`,
          size: { width: 132, height: 44 },
          anchor: "center center",
          tooltip: panos[ni].wp.label,
          data: { ni },
        });
      }
    } catch (e) {
      console.error("[tour] 渲染热点失败:", (e as Error).message);
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
    <div className="flex h-full flex-col gap-3 md:flex-row">
      {/* 全景 */}
      <div className="flex min-h-[280px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-canvas-alt md:min-h-0">
        <div className="relative min-h-0 flex-1">
          {panos.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <Spinner className="h-6 w-6 text-primary-light" label="加载中" />
              <p className="text-sm text-ink-soft">{status}</p>
              {progress.total > 0 && (
                <div className="w-full max-w-xs">
                  <ProgressBar value={progress.current} total={progress.total} />
                  <p className="mt-1.5 text-xs text-ink-mute">
                    已完成 {progress.current} / {progress.total} 处
                  </p>
                </div>
              )}
              {failed && (
                <Button size="sm" variant="secondary" onClick={() => setRetryKey((v) => v + 1)}>
                  重新生成
                </Button>
              )}
            </div>
          ) : (
            <div ref={containerRef} className="h-full w-full" />
          )}
        </div>

        {/* 底部点位缩略图导航：复用已生成的全景数据，不额外发起请求或引入依赖 */}
        {panos.length > 1 && (
          <div className="shrink-0 border-t border-border bg-surface/80 px-2 py-2">
            <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="漫游点位">
              {panos.map((p, i) => (
                <button
                  key={p.wp.id}
                  type="button"
                  aria-current={i === current ? "step" : undefined}
                  aria-label={`切换到第 ${i + 1} 处：${p.wp.label}`}
                  onClick={() => goTo(i)}
                  className={`w-[88px] shrink-0 overflow-hidden rounded-md border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
                    i === current
                      ? "border-primary ring-1 ring-primary/40"
                      : "border-white/[0.08] opacity-70 hover:opacity-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.dataUrl} alt="" loading="lazy" className="h-11 w-full object-cover" />
                  <span className={`block truncate px-1.5 py-1 text-[11px] ${i === current ? "text-primary-light" : "text-ink-mute"}`}>
                    {i + 1}. {p.wp.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 侧栏：小地图 + 途经点 + 控制 */}
      <div className="flex w-full shrink-0 flex-col gap-2 overflow-y-auto md:w-60">
        <svg
          viewBox={`0 0 ${minimap.w} ${minimap.h}`}
          role="img"
          aria-label="漫游路径小地图"
          className="w-full rounded-lg border border-border bg-canvas-alt"
        >
          {json.rooms.map((r) => (
            <polygon
              key={r.id}
              points={r.polygonMm.map(([x, y]) => `${minimap.X(x)},${minimap.Y(y)}`).join(" ")}
              fill="rgba(139,92,246,0.10)"
              stroke="rgba(167,139,250,0.35)"
              strokeWidth={1}
            />
          ))}
          {/* 路径 */}
          {route.segments.map((seg, i) => (
            <line
              key={i}
              x1={minimap.X(seg[0][0])} y1={minimap.Y(seg[0][1])}
              x2={minimap.X(seg[1][0])} y2={minimap.Y(seg[1][1])}
              stroke="var(--color-primary)" strokeWidth={2}
            />
          ))}
          {route.waypoints.map((wp, i) => (
            <circle
              key={wp.id}
              cx={minimap.X(wp.xMm)} cy={minimap.Y(wp.yMm)}
              r={i === current ? 5 : 3}
              fill={i === current ? "var(--color-primary)" : "var(--color-ink-mute)"}
            />
          ))}
        </svg>

        <div className="rounded-lg border border-border bg-surface/80 p-2">
          <div className="mb-1 text-xs font-medium text-ink-soft">漫游路径（{route.waypoints.length} 站）</div>
          <ul className="space-y-1">
            {route.waypoints.map((wp, i) => (
              <li
                key={wp.id}
                className={`cursor-pointer rounded px-2 py-1 text-xs transition-colors ${
                  i === current
                    ? "bg-primary/15 text-primary-light"
                    : "text-ink-soft hover:bg-white/[0.06] hover:text-ink"
                }`}
                onClick={() => panos.length > 0 && goTo(i)}
              >
                {i + 1}. {wp.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            disabled={panos.length < 2}
            onClick={() => goTo(Math.max(0, current - 1))}
          >
            <ChevronLeft size={14} aria-hidden="true" /> 上一处
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            disabled={panos.length < 2}
            onClick={() => goTo(Math.min(panos.length - 1, current + 1))}
          >
            下一处 <ChevronRight size={14} aria-hidden="true" />
          </Button>
        </div>
        <Button
          size="sm"
          variant={auto ? "secondary" : "primary"}
          disabled={panos.length < 2}
          onClick={() => setAuto((v) => !v)}
        >
          {auto ? <Square size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
          {auto ? "停止导览" : "自动导览"}
        </Button>
      </div>
    </div>
  );
}
