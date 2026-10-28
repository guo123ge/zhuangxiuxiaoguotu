"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ModelViewer from "@/components/model3d/ModelViewer";
import TourViewer from "@/components/tour/TourViewer";
import type { FloorplanJson } from "@/lib/parse/pipeline";

type ShareData = {
  project: { id: string; title: string; unitNo: string; clientName: string; designer: string };
  floorplan: FloorplanJson | null;
  schemes: { id: string; name: string; styleId: string | null; isPrimary: boolean; overlayJson: string }[];
};

export default function SharePage() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<ShareData | null>(null);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [tab, setTab] = useState<"model" | "tour">("model");
  const [feedback, setFeedback] = useState("");
  const [decision, setDecision] = useState("");
  const [sent, setSent] = useState(false);

  const load = async () => {
    const res = await fetch(`/api/share/${params.token}`);
    const json = await res.json();
    if (res.status === 404) { setError(json.error || "链接无效"); return; }
    if (json.locked) { setLocked(true); return; }
    setData(json);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [params.token]);

  const submitCode = async () => {
    const res = await fetch(`/api/share/${params.token}/access`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessCode: code }),
    });
    if (res.ok) { setLocked(false); load(); }
    else { const j = await res.json(); setError(j.error || "访问码错误"); }
  };

  const submitFeedback = async () => {
    const res = await fetch(`/api/share/${params.token}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: feedback, decision }),
    });
    if (res.ok) { setSent(true); setFeedback(""); setDecision(""); }
  };

  const primaryScheme = data?.schemes.find((s) => s.isPrimary) ?? data?.schemes[0];
  const overlay = (() => {
    if (!primaryScheme?.overlayJson) return undefined;
    try { return JSON.parse(primaryScheme.overlayJson); } catch { return undefined; }
  })();

  if (error) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">{error}</div>;
  }

  if (locked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="w-80 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-800">需要访问码</h1>
          <p className="mt-1 text-sm text-slate-500">此方案受访问码保护，请输入设计师提供的访问码。</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="访问码"
            className="mt-4 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <button onClick={submitCode} className="mt-3 w-full rounded bg-violet-600 py-2 text-sm text-white hover:bg-violet-700">
            进入查看
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">加载中…</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-slate-800">
            {data.project.title} <span className="text-sm font-normal text-slate-400">{data.project.unitNo || ""}</span>
          </h1>
          <p className="text-xs text-slate-400">
            {data.project.clientName ? `客户：${data.project.clientName} · ` : ""}设计师：{data.project.designer || "—"}
          </p>
        </div>
        <div className="ml-auto flex gap-1">
          {(["model", "tour"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1.5 text-sm ${tab === t ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {t === "model" ? "三维模型" : "全景漫游"}
            </button>
          ))}
        </div>
      </header>

      <main className="min-h-0 flex-1 p-4">
        {data.floorplan ? (
          tab === "model" ? (
            <ModelViewer json={data.floorplan} defaultStyleId={primaryScheme?.styleId ?? "modern-minimal"} overlay={overlay} />
          ) : (
            <TourViewer json={data.floorplan} styleId={primaryScheme?.styleId ?? "modern-minimal"} projectId={data.project.id} />
          )
        ) : (
          <div className="flex h-64 items-center justify-center text-slate-400">该方案暂无户型数据</div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-sm font-semibold text-slate-700">反馈与确认</h2>
          {sent && <p className="mb-2 text-sm text-emerald-600">已提交，设计师会尽快处理。</p>}
          <div className="flex flex-wrap gap-2">
            <select
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">— 整体确认 —</option>
              <option value="APPROVED">确认通过</option>
              <option value="NEED_CHANGE">需要修改</option>
              <option value="UNDECIDED">暂不确定</option>
            </select>
            <input
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="补充意见（可选）"
              className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm"
            />
            <button
              onClick={submitFeedback}
              disabled={!feedback && !decision}
              className="rounded bg-violet-600 px-4 py-1.5 text-sm text-white hover:bg-violet-700 disabled:opacity-40"
            >
              提交
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
