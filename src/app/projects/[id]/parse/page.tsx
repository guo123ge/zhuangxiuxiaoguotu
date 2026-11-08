"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { UploadCloud, ScanSearch, ImageIcon, FileText } from "lucide-react";
import { Button, Badge, Notice, EmptyState, Spinner } from "@/components/ui";
import { TopBar } from "@/components/layout/AppSidebar";
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

/** suggestionsJson 可能损坏或不是数组，安全解析后只保留字符串项 */
function parseIssues(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
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
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error(`读取项目数据失败（${res.status}）`);
      const { project } = await readJson(res);
      setAssets(project?.floorplans ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取项目数据失败");
    } finally {
      setRefreshing(false);
    }
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
    setNotice("");
    try {
      const res = await fetch(`/api/floorplans/${assetId}/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useVlm: true }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "识别失败");
      await refresh();
      setNotice("识别完成，可进入编辑手动修正房间与开口");
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

  const issues = parseIssues(active?.suggestionsJson);
  const canEdit = active && active.pageKind === "BLUEPRINT" && active.status === "SUCCEEDED";

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="户型识别"
        subtitle="上传或选择户型图，识别后可手动修正房间与开口"
        right={
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="sr-only"
              aria-label="选择户型图文件"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f);
                e.target.value = "";
              }}
            />
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
              <UploadCloud className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {busy === "uploading" ? "上传中…" : "上传户型图"}
            </Button>
            {active && active.pageKind === "BLUEPRINT" && (
              <Button onClick={() => runParse(active.id)} disabled={busy !== null}>
                {busy === "parsing" ? <Spinner /> : <ScanSearch className="mr-1.5 h-4 w-4" aria-hidden="true" />}
                {busy === "parsing" ? "识别中…" : active.status === "SUCCEEDED" ? "重新识别" : "开始识别"}
              </Button>
            )}
          </>
        }
      />

      {/* 样本快捷入口 + 资产切换 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.04] bg-surface/40 px-4 py-2 md:px-8">
        <details open={assets.length === 0} className="group">
          <summary className="cursor-pointer list-none text-xs text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
            {assets.length === 0 ? "没有户型图？先用内置样本试跑：" : "内置样本"}
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {SAMPLES.map((s) => (
              <Button key={s.id} variant="secondary" size="sm" onClick={() => addSample(s.id)} disabled={busy !== null}>
                {s.name}
              </Button>
            ))}
          </div>
        </details>
        <div className="ml-auto flex flex-wrap gap-2">
          {assets.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setActiveId(a.id)}
              title={a.originalName}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition ${
                active?.id === a.id
                  ? "border-primary/50 bg-primary/15 text-primary-light"
                  : "border-white/[0.06] bg-surface/60 text-ink-mute hover:border-border-hover hover:text-ink-soft"
              }`}
            >
              {a.fileUrl.endsWith(".pdf") ? <FileText className="h-3.5 w-3.5" aria-hidden="true" /> : <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />}
              <span className="max-w-[140px] truncate">{a.originalName}</span>
              {pageKindBadge(a.pageKind)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 px-4 pt-3 md:px-8">
        {error && <Notice tone="danger" title="操作未完成">{error}</Notice>}
        {notice && <Notice tone="success" title="已完成">{notice}</Notice>}
        {issues.length > 0 && (
          <Notice tone="warning" title={`识别提示（${issues.length} 项）`}>
            <ul className="list-inside list-disc space-y-0.5">
              {issues.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </Notice>
        )}
      </div>

      {/* 主体：识别结果 + 人工修正 */}
      <div className="relative min-h-0 flex-1">
        {refreshing ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-ink-soft">
            <Spinner label="加载中" /> 正在读取项目数据
          </div>
        ) : !active ? (
          <div className="flex h-full items-center justify-center p-6">
            <EmptyState
              title="还没有户型图"
              description="上传一张户型图，或从上方内置样本中选择一套开始识别。"
            />
          </div>
        ) : active.pageKind === "MARKETING" ? (
          <div className="flex h-full items-center justify-center p-6">
            <EmptyState
              title="该页为营销鉴赏页"
              description="已自动分流为风格参考素材，不参与结构识别。请切换到户型图资产。"
            />
          </div>
        ) : !canEdit ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.overlayUrl ?? active.fileUrl}
              alt={`${active.originalName} 预览`}
              loading="lazy"
              className="max-h-[70%] rounded-xl border border-border bg-surface object-contain"
            />
            <p className="text-center text-sm text-ink-soft">
              {active.status === "SUCCEEDED"
                ? "图纸已识别，但非户型图类型，无法进入修正。"
                : "请先点击页面右上角的「开始识别」完成户型结构识别。"}
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
          <div className="flex h-full items-center justify-center p-6">
            <EmptyState title="识别结果为空" description="请重新运行识别，或切换到另一张户型图资产。" />
          </div>
        )}

        {/* 识别最长约 120s：给出明确阶段反馈，避免只看到静态画面 */}
        {busy === "parsing" && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-canvas/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface/95 px-6 py-5 text-center shadow-pop">
              <Spinner className="h-6 w-6 text-primary-light" label="识别中" />
              <p className="text-sm font-medium text-ink">正在识别户型结构</p>
              <p className="text-xs text-ink-soft">分析房间、墙体与门窗，最长约需 2 分钟</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
