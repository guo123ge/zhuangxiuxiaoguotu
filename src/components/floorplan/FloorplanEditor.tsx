"use client";

/**
 * 户型识别结果「人工修正」编辑器。
 *
 * 权限模型：结果默认锁定（只读）。点击「进入编辑」获得修改权限后，
 * 方可对房间多边形顶点拖拽改形、移动/增删开口（门洞/窗洞）、增删房间，
 * 并就地编辑名称与类型。几何变更会实时重算面积/质心。完成后「保存修正」
 * 将整份 FloorplanJson 回写（由父级调用后端，同步 parseJson 与 DetectedRoom）。
 *
 * 坐标：SVG viewBox 取图像自然像素 (W×H)，mm = px × mmPerPx，故叠加层与
 * 图像逐像素对齐；拖拽时用 getScreenCTM 反算，避免缩放/letterbox 误差。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Lock, Unlock, Plus, Trash2, Save, CheckCircle2, SquarePlus, DoorOpen } from "lucide-react";

export type Pt = [number, number];

export type EditorRoom = {
  id: string;
  name: string;
  type: string; // 内部统一用 type（与 FloorplanJson.type 对齐）
  polygonMm: Pt[];
  areaM2: number;
  centroidMm: Pt;
  confidence: number;
  needsConfirm?: boolean;
};

export type EditorOpening = {
  id: string;
  kind: "door" | "open" | "window" | "entrance";
  centerMm: Pt;
  widthMm: number;
  angleRad: number;
  roomA: string | null;
  roomB: string | null;
};

export type EditorJson = {
  mmPerPx: number;
  buildingBoxMm: [number, number, number, number];
  rooms: EditorRoom[];
  openings: EditorOpening[];
  issues?: string[];
  imageWidth?: number;
  imageHeight?: number;
};

const ROOM_TYPES: [string, string][] = [
  ["LIVING_DINING", "客餐厅"], ["LIVING", "客厅"], ["DINING", "餐厅"],
  ["KITCHEN", "厨房"], ["BATH", "卫生间"], ["MASTER_BED", "主卧"],
  ["BED", "次卧"], ["CHILD_BED", "儿童房"], ["ELDER_BED", "老人房"],
  ["STUDY", "书房"], ["CLOAK", "衣帽间"], ["STORAGE", "储藏间"],
  ["BALCONY", "阳台"], ["ENTRY", "玄关"], ["HALLWAY", "走道"],
  ["MULTI", "多功能房"], ["OTHER", "其他"],
];

const OPENING_KINDS: [EditorOpening["kind"], string][] = [
  ["door", "门"], ["open", "开口"], ["window", "窗"], ["entrance", "入户门"],
];

type Tool = "select" | "addRoom" | "addOpening";

function polygonAreaM2(poly: Pt[]): number {
  const n = poly.length;
  if (n < 3) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % n];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2 / 1_000_000;
}

function polygonCentroidMm(poly: Pt[]): Pt {
  const n = poly.length;
  if (n === 0) return [0, 0];
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % n];
    const cr = x1 * y2 - x2 * y1;
    a += cr; cx += (x1 + x2) * cr; cy += (y1 + y2) * cr;
  }
  if (Math.abs(a) < 1e-6) {
    let sx = 0, sy = 0;
    for (const [x, y] of poly) { sx += x; sy += y; }
    return [sx / n, sy / n];
  }
  a *= 0.5;
  return [cx / (6 * a), cy / (6 * a)];
}

function recompute(room: EditorRoom): EditorRoom {
  return { ...room, areaM2: polygonAreaM2(room.polygonMm), centroidMm: polygonCentroidMm(room.polygonMm) };
}

function toMm(clientX: number, clientY: number, svg: SVGSVGElement, mmPerPx: number): Pt {
  const pt = svg.createSVGPoint();
  pt.x = clientX; pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return [0, 0];
  const loc = pt.matrixTransform(ctm.inverse());
  return [loc.x * mmPerPx, loc.y * mmPerPx];
}

const COLORS = ["#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1", "#14b8a6"];

export default function FloorplanEditor({
  imageUrl,
  initialJson,
  onSave,
  saving,
}: {
  imageUrl: string;
  initialJson: EditorJson;
  onSave: (json: EditorJson, reviewStatus: "NEEDS_REVIEW" | "CONFIRMED") => Promise<void>;
  saving?: boolean;
}) {
  const [draft, setDraft] = useState<EditorJson>(initialJson);
  const [editing, setEditing] = useState(false);
  const [tool, setTool] = useState<Tool>("select");
  const [selRoom, setSelRoom] = useState<string | null>(null);
  const [selOpening, setSelOpening] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number }>({
    w: initialJson.imageWidth ?? 1000,
    h: initialJson.imageHeight ?? 1000,
  });

  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ roomId: string; vi: number } | { opId: string } | null>(null);
  const roomRectRef = useRef<{ start: Pt; cur: Pt } | null>(null);
  const previewRect = useRef<{ start: Pt; cur: Pt } | null>(null);
  const [preview, setPreview] = useState<{ start: Pt; cur: Pt } | null>(null);

  // 外部初始数据变化（如重新识别）时同步
  useEffect(() => {
    setDraft(initialJson);
    setEditing(false);
    setSelRoom(null);
    setSelOpening(null);
    setTool("select");
  }, [initialJson]);

  const mmPerPx = draft.mmPerPx || 1;

  const toPx = useCallback((m: Pt): Pt => [m[0] / mmPerPx, m[1] / mmPerPx], [mmPerPx]);

  const updateRoom = useCallback((id: string, patch: Partial<EditorRoom>) => {
    setDraft((d) => ({
      ...d,
      rooms: d.rooms.map((r) => (r.id === id ? recompute({ ...r, ...patch }) : r)),
    }));
  }, []);

  const updateOpening = useCallback((id: string, patch: Partial<EditorOpening>) => {
    setDraft((d) => ({
      ...d,
      openings: d.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  }, []);

  // ── 拖拽顶点 / 开口 ──
  const onVertexDown = (e: React.PointerEvent, roomId: string, vi: number) => {
    if (!editing) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { roomId, vi };
  };
  const onOpeningDown = (e: React.PointerEvent, opId: string) => {
    if (!editing) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { opId };
    setSelOpening(opId);
    setSelRoom(null);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const d = dragRef.current;
    if (d && "roomId" in d) {
      const m = toMm(e.clientX, e.clientY, svg, mmPerPx);
      updateRoom(d.roomId, { polygonMm: (() => {
        const room = draft.rooms.find((r) => r.id === d.roomId);
        if (!room) return [];
        const poly = room.polygonMm.map((p) => [...p] as Pt);
        poly[d.vi] = m;
        return poly;
      })() });
    } else if (d && "opId" in d) {
      const m = toMm(e.clientX, e.clientY, svg, mmPerPx);
      updateOpening(d.opId, { centerMm: m });
    } else if (tool === "addRoom" && roomRectRef.current) {
      const m = toMm(e.clientX, e.clientY, svg, mmPerPx);
      roomRectRef.current = { ...roomRectRef.current, cur: m };
      previewRect.current = roomRectRef.current;
      setPreview(roomRectRef.current);
    }
  };
  const onPointerUp = () => {
    if (tool === "addRoom" && previewRect.current && previewRect.current.start && previewRect.current.cur) {
      const { start, cur } = previewRect.current;
      if (Math.abs(cur[0] - start[0]) > 50 * mmPerPx && Math.abs(cur[1] - start[1]) > 50 * mmPerPx) {
        const x0 = Math.min(start[0], cur[0]), x1 = Math.max(start[0], cur[0]);
        const y0 = Math.min(start[1], cur[1]), y1 = Math.max(start[1], cur[1]);
        const poly: Pt[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
        const id = `room-${Date.now().toString(36)}`;
        const baseName = `房间${draft.rooms.length + 1}`;
        setDraft((d) => ({ ...d, rooms: [...d.rooms, recompute({ id, name: baseName, type: "OTHER", polygonMm: poly, areaM2: 0, centroidMm: [0, 0], confidence: 1 })] }));
        setSelRoom(id);
      }
      roomRectRef.current = null;
      previewRect.current = null;
      setPreview(null);
    }
    dragRef.current = null;
  };

  const onSvgDown = (e: React.PointerEvent) => {
    if (!editing) return;
    const svg = svgRef.current;
    if (!svg) return;
    if (tool === "addRoom") {
      const m = toMm(e.clientX, e.clientY, svg, mmPerPx);
      roomRectRef.current = { start: m, cur: m };
      previewRect.current = { start: m, cur: m };
      setPreview({ start: m, cur: m });
      setSelRoom(null); setSelOpening(null);
    } else if (tool === "addOpening") {
      const m = toMm(e.clientX, e.clientY, svg, mmPerPx);
      const id = `op-${Date.now().toString(36)}`;
      // 最近的房间作为 roomA
      let best: EditorRoom | null = null; let bestD = Infinity;
      for (const r of draft.rooms) {
        const dx = m[0] - r.centroidMm[0], dy = m[1] - r.centroidMm[1];
        const dd = Math.hypot(dx, dy);
        if (dd < bestD) { bestD = dd; best = r; }
      }
      const op: EditorOpening = {
        id, kind: "door", centerMm: m, widthMm: 900, angleRad: 0,
        roomA: best?.id ?? null, roomB: null,
      };
      setDraft((d) => ({ ...d, openings: [...d.openings, op] }));
      setSelOpening(id); setSelRoom(null);
    } else {
      setSelRoom(null); setSelOpening(null);
    }
  };

  const deleteSelected = () => {
    if (selRoom) {
      setDraft((d) => ({ ...d, rooms: d.rooms.filter((r) => r.id !== selRoom), openings: d.openings.map((o) => o.roomA === selRoom ? { ...o, roomA: null } : o) }));
      setSelRoom(null);
    } else if (selOpening) {
      setDraft((d) => ({ ...d, openings: d.openings.filter((o) => o.id !== selOpening) }));
      setSelOpening(null);
    }
  };

  const viewBox = `0 0 ${nat.w} ${nat.h}`;

  return (
    <div className="flex h-full">
      {/* 左：图纸 + 矢量编辑层 */}
      <div className="relative flex-1 overflow-auto bg-[#0a0f1e] p-4">
        <div className="relative mx-auto h-fit w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="户型图"
            className="block w-full max-w-[820px] select-none"
            draggable={false}
            onLoad={(e) => {
              const el = e.currentTarget;
              if (el.naturalWidth && el.naturalHeight) setNat({ w: el.naturalWidth, h: el.naturalHeight });
            }}
          />
          <svg
            ref={svgRef}
            viewBox={viewBox}
            className="absolute inset-0 h-full w-full"
            style={{ cursor: tool === "select" ? "default" : "crosshair", touchAction: "none" }}
            onPointerDown={onSvgDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {/* 房间多边形 */}
            {draft.rooms.map((r, ri) => {
              const pts = r.polygonMm.map((p) => toPx(p).join(",")).join(" ");
              const color = COLORS[ri % COLORS.length];
              const selected = selRoom === r.id;
              return (
                <g key={r.id}>
                  <polygon
                    points={pts}
                    fill={selected ? color : `${color}22`}
                    stroke={color}
                    strokeWidth={selected ? 3 : 2}
                    style={{ cursor: editing ? "pointer" : "default" }}
                    onPointerDown={(e) => { if (editing) { e.stopPropagation(); setSelRoom(r.id); setSelOpening(null); } }}
                  />
                  {/* 顶点把手（仅编辑态显示） */}
                  {editing && r.polygonMm.map((p, vi) => {
                    const [x, y] = toPx(p);
                    return (
                      <circle
                        key={vi}
                        cx={x} cy={y} r={5}
                        fill="#fff" stroke={color} strokeWidth={2}
                        style={{ cursor: "grab" }}
                        onPointerDown={(e) => onVertexDown(e, r.id, vi)}
                      />
                    );
                  })}
                  {/* 房间名标签 */}
                  {(() => {
                    const [cx, cy] = toPx(r.centroidMm);
                    return (
                      <text x={cx} y={cy} textAnchor="middle" fontSize={14} fill="#ffffff" fontWeight={600} style={{ pointerEvents: "none", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
                        {r.name}
                      </text>
                    );
                  })()}
                </g>
              );
            })}

            {/* 开口（门/窗） */}
            {draft.openings.map((o) => {
              const [x, y] = toPx(o.centerMm);
              const selected = selOpening === o.id;
              const color = o.kind === "window" ? "#0ea5e9" : o.kind === "entrance" ? "#10b981" : "#f59e0b";
              return (
                <g key={o.id}>
                  <rect
                    x={x - 9} y={y - 9} width={18} height={18}
                    fill={selected ? color : `${color}cc`}
                    stroke="#fff" strokeWidth={2}
                    style={{ cursor: editing ? "move" : "default" }}
                    onPointerDown={(e) => onOpeningDown(e, o.id)}
                  />
                  {editing && (
                    <circle cx={x} cy={y} r={13} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="3 3" style={{ pointerEvents: "none" }} />
                  )}
                </g>
              );
            })}

            {/* 添加房间预览矩形 */}
            {preview && (
              (() => {
                const [x0, y0] = toPx(preview.start);
                const [x1, y1] = toPx(preview.cur);
                return <rect x={Math.min(x0, x1)} y={Math.min(y0, y1)} width={Math.abs(x1 - x0)} height={Math.abs(y1 - y0)} fill="#8b5cf633" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="4 4" style={{ pointerEvents: "none" }} />;
              })()
            )}
          </svg>
        </div>

        {/* 顶部权限/工具栏 */}
        <div className="sticky top-0 z-10 mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-sidebar/80 p-2 backdrop-blur-sm">
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
            >
              <Unlock className="h-3.5 w-3.5" /> 进入编辑（手动修正）
            </button>
          ) : (
            <>
              <button
                onClick={() => { setEditing(false); setTool("select"); }}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/16"
              >
                <Lock className="h-3.5 w-3.5" /> 锁定
              </button>
              <div className="h-4 w-px bg-white/10" />
              <button
                onClick={() => setTool(tool === "addRoom" ? "select" : "addRoom")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${tool === "addRoom" ? "bg-primary/20 text-primary-light" : "bg-white/6 text-ink-mute hover:bg-white/[0.08] hover:text-ink-soft"}`}
              >
                <SquarePlus className="h-3.5 w-3.5" /> 添加房间
              </button>
              <button
                onClick={() => setTool(tool === "addOpening" ? "select" : "addOpening")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${tool === "addOpening" ? "bg-primary/20 text-primary-light" : "bg-white/6 text-ink-mute hover:bg-white/[0.08] hover:text-ink-soft"}`}
              >
                <DoorOpen className="h-3.5 w-3.5" /> 添加开口
              </button>
              <button
                onClick={deleteSelected}
                disabled={!selRoom && !selOpening}
                className="flex items-center gap-1.5 rounded-lg bg-danger/15 px-2.5 py-1.5 text-xs font-medium text-red-300 hover:bg-danger/25 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" /> 删除选中
              </button>
              <span className="ml-auto text-xs text-ink-mute">
                {tool === "addRoom" ? "在图上拖拽框选新房间" : tool === "addOpening" ? "在图上点击放置开口" : "拖拽顶点改形 · 点击选中后删除"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* 右：房间清单 + 保存 */}
      <div className="flex w-[300px] shrink-0 flex-col overflow-auto border-l border-white/[0.06] bg-sidebar/60 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            房间清单 <span className="text-ink-mute">({draft.rooms.length})</span>
          </h2>
          {!editing && <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] text-ink-mute">只读</span>}
        </div>

        <div className="flex-1 space-y-2">
          {draft.rooms.length === 0 && <p className="text-xs text-ink-mute">暂无房间，可进入编辑后「添加房间」。</p>}
          {draft.rooms.map((r) => {
            const selected = selRoom === r.id;
            return (
              <div
                key={r.id}
                onClick={() => { setSelRoom(r.id); setSelOpening(null); setTool("select"); }}
                className={`cursor-pointer rounded-lg border p-2.5 transition-colors ${selected ? "border-primary/50 bg-primary/10" : "border-white/[0.05] bg-surface/60 hover:border-border-hover hover:bg-surface-hi/80"}`}
              >
                <div className="mb-1 flex items-center justify-between gap-1">
                  <input
                    value={r.name}
                    disabled={!editing}
                    onChange={(e) => updateRoom(r.id, { name: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-white focus:border-primary/50 focus:outline-none disabled:cursor-default"
                  />
                  <span className="text-[11px] text-ink-mute">{r.areaM2.toFixed(1)}㎡</span>
                </div>
                <select
                  value={r.type}
                  disabled={!editing}
                  onChange={(e) => updateRoom(r.id, { type: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full rounded border border-white/[0.08] bg-surface/80 px-1.5 py-1 text-xs text-ink focus:border-primary/50 focus:outline-none disabled:bg-surface/40 disabled:text-ink-mute"
                >
                  {ROOM_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            );
          })}
        </div>

        <div className="mt-3 space-y-2 border-t border-white/[0.05] pt-3">
          <button
            onClick={() => onSave(draft, "NEEDS_REVIEW")}
            disabled={saving || !editing}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-purple-500 px-3 py-2 text-sm font-medium text-white shadow-glow-purple hover:brightness-110 disabled:opacity-40"
          >
            <Save className="h-4 w-4" /> 保存修正
          </button>
          <button
            onClick={() => onSave(draft, "CONFIRMED")}
            disabled={saving || !editing}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-surface/80 px-3 py-2 text-sm font-medium text-ink hover:bg-surface-hi disabled:opacity-40"
          >
            <CheckCircle2 className="h-4 w-4" /> 修正并确认
          </button>
          {editing && <p className="text-center text-[11px] text-ink-mute">修正并确认将直接通过复核，进入三维建模</p>}
        </div>
      </div>
    </div>
  );
}
