"use client";

import { useEffect, useState } from "react";
import { Sparkles, X, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { fitLabel } from "@/lib/ai/models";

type ModelInfo = {
  id: string;
  name: string;
  vendor: string;
  capabilities: { vision: boolean; text: boolean; image: boolean };
  pros: string[];
  cons: string[];
  fit: string;
  fitScore: number;
  hasKey: boolean;
};

type AiStatus = {
  available: boolean;
  vision: boolean;
  text: boolean;
  visionModelName: string | null;
  textModelName: string | null;
  reason: string;
};

type Slot = "vision" | "text";

const SLOT_META: Record<Slot, { label: string; hint: string }> = {
  vision: { label: "视觉识别", hint: "户型图尺寸链识别、房间分类（需视觉模型）" },
  text: { label: "文本对话", hint: "AI 变更提案、自然语言交互" },
};

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [visionModelId, setVisionModelId] = useState("");
  const [textModelId, setTextModelId] = useState("");
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [slot, setSlot] = useState<Slot>("vision");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    const r = await fetch("/api/ai/config");
    const data = await r.json();
    setModels(data.models ?? []);
    setVisionModelId(data.visionModelId ?? "");
    setTextModelId(data.textModelId ?? "");
    setStatus(data.status ?? null);
  };

  useEffect(() => { load(); }, []);

  const selectedModelId = slot === "vision" ? visionModelId : textModelId;
  const setSelectedModelId = slot === "vision" ? setVisionModelId : setTextModelId;
  const current = models.find((m) => m.id === selectedModelId);

  const switchSlot = (s: Slot) => {
    setSlot(s);
    setApiKey("");
    setMsg(null);
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/ai/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slot, modelId: selectedModelId, apiKey }),
    });
    const j = await r.json();
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: "已保存配置" }); setApiKey(""); await load(); }
    else setMsg({ ok: false, text: j.error || "保存失败" });
  };

  const test = async () => {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/ai/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ modelId: selectedModelId, apiKey }),
    });
    const j = await r.json();
    setBusy(false);
    setMsg({ ok: j.ok, text: j.message });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-700"
        title="AI 助手"
      >
        <Sparkles className="h-5 w-5" />
      </button>

      {open && <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} />}

      <div className={`fixed right-0 top-0 z-50 flex h-full w-[400px] max-w-[92vw] flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">AI 助手</h2>
            <p className="text-xs text-slate-400">模型选择 · 密钥配置 · 连接测试</p>
          </div>
          <button onClick={() => setOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* 当前状态 */}
          {status && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${status.available ? "bg-emerald-500" : "bg-slate-300"}`} />
                <span className="text-sm font-medium text-slate-700">{status.available ? "AI 已启用" : "未启用 AI"}</span>
              </div>
              <div className="mt-2 space-y-1 text-xs text-slate-500">
                <p>视觉识别：<span className={status.vision ? "font-medium text-emerald-600" : "text-slate-400"}>{status.visionModelName ?? "未配置"}</span></p>
                <p>文本对话：<span className={status.text ? "font-medium text-emerald-600" : "text-slate-400"}>{status.textModelName ?? "未配置"}</span></p>
              </div>
            </div>
          )}

          {/* 槽位切换 */}
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            {(Object.keys(SLOT_META) as Slot[]).map((s) => (
              <button
                key={s}
                onClick={() => switchSlot(s)}
                className={`rounded-md py-1.5 text-sm font-medium transition ${slot === s ? "bg-white text-violet-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {SLOT_META[s].label}
              </button>
            ))}
          </div>
          <p className="mb-2 text-xs text-slate-400">{SLOT_META[slot].hint}</p>

          {/* 模型选择 */}
          <label className="mb-1.5 block text-xs font-medium text-slate-500">选择模型</label>
          <select
            value={selectedModelId}
            onChange={(e) => { setSelectedModelId(e.target.value); setApiKey(""); setMsg(null); }}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}（{m.vendor}）· 适配 {fitLabel(m.fitScore)}{m.hasKey ? " · 已配置" : ""}
              </option>
            ))}
          </select>

          {/* 模型详情 */}
          {current && (
            <div className="mt-3 rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">{current.name}</span>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${current.fitScore >= 4 ? "bg-emerald-50 text-emerald-700" : current.fitScore >= 3 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                  适配度 {fitLabel(current.fitScore)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <CapTag label="视觉" on={current.capabilities.vision} />
                <CapTag label="文本" on={current.capabilities.text} />
                <CapTag label="生图" on={current.capabilities.image} />
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">{current.fit}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="mb-1 font-medium text-emerald-600">优势</p>
                  <ul className="space-y-0.5 text-slate-500">{current.pros.map((p) => <li key={p}>· {p}</li>)}</ul>
                </div>
                <div>
                  <p className="mb-1 font-medium text-rose-600">劣势</p>
                  <ul className="space-y-0.5 text-slate-500">{current.cons.map((c) => <li key={c}>· {c}</li>)}</ul>
                </div>
              </div>
            </div>
          )}

          {/* API Key */}
          <label className="mb-1.5 mt-4 block text-xs font-medium text-slate-500">API Key</label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={current?.hasKey ? "已配置，留空则保留原密钥" : "粘贴 API Key"}
              className="w-full rounded-md border border-slate-300 px-3 py-2 pr-9 text-sm focus:border-violet-500 focus:outline-none"
            />
            <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">密钥仅保存在本机 data/ai-config.json（已加入 .gitignore，不入库）。</p>

          <div className="mt-3 flex gap-2">
            <button onClick={save} disabled={busy} className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-violet-600 py-2 text-sm text-white hover:bg-violet-700 disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}保存
            </button>
            <button onClick={test} disabled={busy} className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-300 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              测试连接
            </button>
          </div>

          {msg && (
            <div className={`mt-3 flex items-start gap-2 rounded-md p-2.5 text-xs ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
              {msg.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span className="leading-5">{msg.text}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function CapTag({ label, on }: { label: string; on: boolean }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${on ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-400 line-through"}`}>
      {label}
    </span>
  );
}
