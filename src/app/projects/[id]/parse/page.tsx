"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  UploadCloud, ScanSearch, CheckCircle2, AlertTriangle, Loader2,
  ImageIcon, FileText, PencilRuler,
} from "lucide-react";
import { Button, Badge } from "@/components/ui";
import FloorplanEditor, { type EditorJson } from "@/components/floorplan/FloorplanEditor";

type FloorplanAsset = {
  id: string;
  originalName: string;
  fileUrl: string;
  overlayUrl: string | null;
  pageKind: string;
  status: string;
  reviewStatus: string;
  scaleMmPerPx: number | null;
  scaleConfidence: number | null;
  parseJson: string;
  width: number | null;
  height: number | null;
  suggestionsJson: string;
};

const SAMPLES = [
  { id: "yunkun", name: "雲崑 143㎡" },
  { id: "yunlang", name: "雲琅 128㎡" },
  { id: "yunque", name: "雲阙 138㎡" },
  { id: "yao-a", name: "雲曜A 118㎡" },
  { id: "yao-b", name: "雲曜B 116㎡" },
];

/** 安全解析 JSON：响应为 HTML（如超时/网关错误）时返回空对象，避免 res.json() 抛 "Unexpected token" */
async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

/** 把后端全量快照转换为编辑器所需的最小结构 */
function toEditorJson(fp: any): EditorJson | null {
  try {
    if (!fp || !Array.isArray(fp.rooms) || fp.rooms.length === 0) return null;
    return {
      mmPerPx: fp.mmPerPx ?? 1,
      buildingBoxMm: fp.buildingBoxMm ?? [0, 0, 1, 1],
      rooms: fp.rooms.map((r: any) => ({
        id: r.id,
        name: r.name,
        type: r.type ?? "OTHER",
        polygonMm: r.polygonMm ?? [],
        areaM2: r.areaM2 ?? 0,
        centroidMm: r.centroidMm ?? [0, 0],
        confidence: r.confidence ?? 0.9,
        needsConfirm: r.needsConfirm,
      })),
      openings: (fp.openings ?? []).map((o: any) => ({
        id: o.id,
        kind: o.kind ?? "door",
        centerMm: o.centerMm ?? [0, 0],
        widthMm: o.widthMm ?? 900,
        angleRad: o.angleRad ?? 0,
        roomA: o.roomA ?? null,
        roomB: o.roomB ?? null,
      })),
      issues: fp.issues ?? [],
      imageWidth: fp.imageWidth,
      imageHeight: fp.imageHeight,
    };
  } catch {
    return null;
  }
}

export default function ParsePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;
  const fileRef = useRef<HTMLInputElement>(null);

  const [assets, setAssets] = useState<FloorplanAsset[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`);
    if (!res.ok) return;
    const { project } = await readJson(res);
    setAssets(project.floorplans);
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const active = assets.find((a) => a.id === activeId) ?? assets.find((a) => a.pageKind === "BLUEPRINT") ?? assets[0] ?? null;

  const editorJson = useMemo(() => {
    if (!active?.parseJson) return null;
    try {
      const fp = JSON.parse(active.parseJson);
      return toEditorJson(fp);
    } catch {
      return null;
    }
    // 仅在解析结果内容变化时重建编辑器初始态
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.parseJson]);

  async function uploadFile(file: File) {
    setBusy("uploading");
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/floorplans`, { method: "POST", body: fd });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "上传失败");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setBusy(null);
    }
  }

  async function addSample(sampleId: string) {
    setBusy("uploading");
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/floorplans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleId }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "加载样本失败");
      await refresh();
      if (data.asset?.id) setActiveId(data.asset.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载样本失败");
    } finally {
      setBusy(null);
    }
  }

  async function runParse(assetId: string) {
    setBusy("parsing");
    setError("");
    try {
      const res = await fetch(`/api/floorplans/${assetId}/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useVlm: true }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "识别失败");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "识别失败");
    } finally {
      setBusy(null);
    }
  }

  async function confirm() {
    if (!active) return;
    setBusy("confirming");
    try {
      const res = await fetch(`/api/floorplans/${active.id}/confirm`, { method: "POST" });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "确认失败");
      router.push(`/projects/${projectId}/model`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "确认失败");
      setBusy(null);
    }
  }

  /** 编辑器保存修正；CONFIRMED 时再走确认流程并进入建模 */
  async function onCorrect(json: EditorJson, reviewStatus: "NEEDS_REVIEW" | "CONFIRMED") {
    if (!active) return;
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/floorplans/${active.id}/correct`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: {
            version: 1,
            mmPerPx: json.mmPerPx,
            buildingBoxMm: json.buildingBoxMm,
            rooms: json.rooms.map((r) => ({
              id: r.id, name: r.name, type: r.type,
              polygonMm: r.polygonMm, areaM2: r.areaM2, centroidMm: r.centroidMm,
              confidence: r.confidence, needsConfirm: false,
            })),
            openings: json.openings.map((o) => ({
              id: o.id, kind: o.kind, centerMm: o.centerMm,
              widthMm: o.widthMm, angleRad: o.angleRad, roomA: o.roomA, roomB: o.roomB,
            })),
            issues: json.issues ?? [],
            classifiedBy: "manual",
          },
          reviewStatus,
        }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "保存失败");
      await refresh();
      if (reviewStatus === "CONFIRMED") {
        await confirm();
      } else {
        setNotice("已保存人工修正，复核状态更新为「待复核」");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  }

  const pageKindBadge = (k: string) =>
    k === "BLUEPRINT" ? <Badge tone="success">户型图</Badge>
      : k === "MARKETING" ? <Badge tone="warning">营销页</Badge>
      : <Badge>待判定</Badge>;

  const issues: string[] = active?.suggestionsJson ? JSON.parse(active.suggestionsJson || "[]") : [];
  const canEdit = active && active.pageKind === "BLUEPRINT" && active.status === "SUCCEEDED";

  return (
    <div className="flex h-full flex-col">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-sidebar/60 backdrop-blur-sm px-6 py-3">
        <div className="flex items-center gap-2">
          <PencilRuler className="h-5 w-5 text-primary-light" />
          <h1 className="text-lg font-semibold text-white">户型识别与人工修正</h1>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f);
              e.target.value = "";
            }}
          />
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
            <UploadCloud className="mr-1.5 h-4 w-4" /> 上传户型图
          </Button>
          {active && active.pageKind === "BLUEPRINT" && (
            <Button onClick={() => runParse(active.id)} disabled={busy !== null}>
              {busy === "parsing" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ScanSearch className="mr-1.5 h-4 w-4" />}
              {active.status === "SUCCEEDED" ? "重新识别" : "开始识别"}
            </Button>
          )}
        </div>
      </div>

      {/* 样本快捷入口 + 资产切换 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.04] bg-surface/40 px-6 py-2">
        {assets.length === 0 && (
          <span className="text-xs text-ink-mute">没有户型图？先用内置样本试跑：</span>
        )}
        {SAMPLES.map((s) => (
          <Button key={s.id} variant="secondary" size="sm" onClick={() => addSample(s.id)} disabled={busy !== null}>
            {s.name}
          </Button>
        ))}
        <div className="ml-auto flex flex-wrap gap-2">
          {assets.map((a) => (
            <button
              key={a.id}
              onClick={() => setActiveId(a.id)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition ${
                active?.id === a.id
                  ? "border-primary/50 bg-primary/15 text-primary-light"
                  : "border-white/[0.06] bg-surface/60 text-ink-mute hover:border-border-hover hover:text-ink-soft"
              }`}
            >
              {a.fileUrl.endsWith(".pdf") ? <FileText className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
              <span className="max-w-[140px] truncate">{a.originalName}</span>
              {pageKindBadge(a.pageKind)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 flex items-center gap-2 rounded-xl border border-danger/25 bg-danger/8 px-4 py-2.5 text-sm text-red-300 backdrop-blur-sm">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}
      {notice && (
        <div className="mx-6 mt-3 flex items-center gap-2 rounded-xl border border-success/25 bg-success/8 px-4 py-2.5 text-sm text-emerald-300 backdrop-blur-sm">
          <CheckCircle2 className="h-4 w-4" /> {notice}
        </div>
      )}

      {/* 主体：识别结果 + 人工修正 */}
      <div className="min-h-0 flex-1">
        {!active ? (
          <div className="flex h-full items-center justify-center text-sm text-ink-mute">
            上传或选择户型图后开始识别
          </div>
        ) : active.pageKind === "MARKETING" ? (
          <div className="flex h-full items-center justify-center text-sm text-ink-mute">
            该页被识别为营销鉴赏页，已自动分流为风格参考素材，不参与结构识别。
          </div>
        ) : !canEdit ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-mute">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={active.overlayUrl ?? active.fileUrl} alt={active.originalName} className="max-h-[60%] rounded-xl border border-white/[0.06] bg-surface object-contain" />
            <p className="text-sm">
              {active.status === "SUCCEEDED"
                ? "图纸已识别，但非户型图类型，无法进入修正。"
                : "请先点击右上角「开始识别」完成户型结构识别。"}
            </p>
          </div>
        ) : editorJson ? (
          <FloorplanEditor
            imageUrl={active.overlayUrl ?? active.fileUrl}
            initialJson={editorJson}
            onSave={onCorrect}
            saving={busy === "confirming"}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-mute">
            识别结果为空，请重新识别。
          </div>
        )}
      </div>
    </div>
  );
}
