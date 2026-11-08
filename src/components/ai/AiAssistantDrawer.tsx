"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Eye, EyeOff } from "lucide-react";
import { fitLabel } from "@/lib/ai/models";
import { inputCls, selectCls, Button, Spinner, Notice } from "@/components/ui";
import CloudAiChat from "./CloudAiChat";

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

  const fabRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const hasOpenedRef = useRef(false);

  const load = async () => {
    const r = await fetch("/api/ai/config");
    const data = await r.json();
    setModels(data.models ?? []);
    setVisionModelId(data.visionModelId ?? "");
    setTextModelId(data.textModelId ?? "");
    setStatus(data.status ?? null);
  };

  useEffect(() => { load(); }, []);

  // ESC 关闭：仅在抽屉打开时监听 keydown
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // 焦点管理：打开移入抽屉首个可聚焦元素，关闭归还浮标按钮
  useEffect(() => {
    if (open) {
      hasOpenedRef.current = true;
      const first = drawerRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      first?.focus();
    } else if (hasOpenedRef.current) {
      fabRef.current?.focus();
    }
  }, [open]);

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
      {!open && (
        <button
          ref={fabRef}
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 transition hover:bg-primary-light"
          title="AI 助手"
          aria-label="打开 AI 助手"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[45] bg-black/20"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="AI 助手"
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-50 flex h-full w-[400px] max-w-[92vw] flex-col bg-sidebar shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">AI 助手</h2>
            <p className="text-xs text-ink-mute">模型选择 · 密钥配置 · 连接测试</p>
          </div>
          <button onClick={() => setOpen(false)} aria-label="关闭" className="rounded p-1 text-ink-mute hover:bg-white/[0.06] hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* 云 AI 对话（免密钥） */}
          <CloudAiChat />

          {/* 当前状态 */}
          {status && (
            <div className="mb-4 rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${status.available ? "bg-success" : "bg-ink-mute"}`} />
                <span className="text-sm font-medium text-ink">{status.available ? "AI 已启用" : "未启用 AI"}</span>
              </div>
              <div className="mt-2 space-y-1 text-xs text-ink-soft">
                <p>视觉识别：<span className={status.vision ? "font-medium text-on-success" : "text-ink-mute"}>{status.visionModelName ?? "未配置"}</span></p>
                <p>文本对话：<span className={status.text ? "font-medium text-on-success" : "text-ink-mute"}>{status.textModelName ?? "未配置"}</span></p>
              </div>
            </div>
          )}

          {/* 槽位切换 */}
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-white/[0.04] p-1">
            {(Object.keys(SLOT_META) as Slot[]).map((s) => (
              <button
                key={s}
                onClick={() => switchSlot(s)}
                className={`rounded-md py-1.5 text-sm font-medium transition ${slot === s ? "bg-primary/15 text-primary-light shadow-sm" : "text-ink-soft hover:text-ink"}`}
              >
                {SLOT_META[s].label}
              </button>
            ))}
          </div>
          <p className="mb-2 text-xs text-ink-mute">{SLOT_META[slot].hint}</p>

          {/* 模型选择 */}
          <label className="mb-1.5 block text-xs font-medium text-ink-soft">选择模型</label>
          <select
            value={selectedModelId}
            onChange={(e) => { setSelectedModelId(e.target.value); setApiKey(""); setMsg(null); }}
            className={selectCls}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}（{m.vendor}）· 适配 {fitLabel(m.fitScore)}{m.hasKey ? " · 已配置" : ""}
              </option>
            ))}
          </select>

          {/* 模型详情 */}
          {current && (
            <div className="mt-3 rounded-lg border border-border bg-white/[0.03] p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink">{current.name}</span>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${current.fitScore >= 4 ? "bg-success/10 text-on-success" : current.fitScore >= 3 ? "bg-warning/10 text-on-warning" : "bg-white/[0.04] text-ink-mute"}`}>
                  适配度 {fitLabel(current.fitScore)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <CapTag label="视觉" on={current.capabilities.vision} />
                <CapTag label="文本" on={current.capabilities.text} />
                <CapTag label="生图" on={current.capabilities.image} />
              </div>
              <p className="mt-2 text-xs leading-5 text-ink-soft">{current.fit}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="mb-1 font-medium text-on-success">优势</p>
                  <ul className="space-y-0.5 text-ink-soft">{current.pros.map((p) => <li key={p}>· {p}</li>)}</ul>
                </div>
                <div>
                  <p className="mb-1 font-medium text-on-danger">劣势</p>
                  <ul className="space-y-0.5 text-ink-soft">{current.cons.map((c) => <li key={c}>· {c}</li>)}</ul>
                </div>
              </div>
            </div>
          )}

          {/* API Key */}
          <label className="mb-1.5 mt-4 block text-xs font-medium text-ink-soft">API Key</label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={current?.hasKey ? "已配置，留空则保留原密钥" : "粘贴 API Key"}
              className={`${inputCls} pr-9`}
            />
            <button type="button" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? "隐藏密钥" : "显示密钥"} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-mute hover:text-ink">
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-ink-mute">密钥仅保存在本机 data/ai-config.json（已加入 .gitignore，不入库）。</p>

          <div className="mt-3 flex gap-2">
            <Button onClick={save} disabled={busy} className="flex-1">
              {busy && <Spinner />}保存
            </Button>
            <Button variant="secondary" onClick={test} disabled={busy} className="flex-1">
              测试连接
            </Button>
          </div>

          {msg && (
            <Notice tone={msg.ok ? "success" : "danger"} className="mt-3">
              {msg.text}
            </Notice>
          )}
        </div>
      </div>
    </>
  );
}

function CapTag({ label, on }: { label: string; on: boolean }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${on ? "bg-primary/15 text-primary-light" : "bg-white/[0.04] text-ink-mute line-through"}`}>
      {label}
    </span>
  );
}
