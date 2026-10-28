"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, AlertCircle, Cloud, Square } from "lucide-react";
import { cloud } from "@/lib/cloud";
import type { ChatCompletionRequestMessage } from "@tencent-ai/workbuddy-cloud-sdk";

type ChatMsg = { role: "user" | "assistant"; content: string };
type CloudModel = { id: string; name: string; enabled: boolean; disabled?: boolean };

const SYSTEM_PROMPT =
  "你是「户型三维装修」应用的室内设计助手，回答简洁、专业，只基于事实，不编造；涉及户型、材质、配色时给出可执行的建议。";

export default function CloudAiChat() {
  const [models, setModels] = useState<CloudModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await cloud.llm.models.list();
        if (cancelled) return;
        setModels(list);
        const usable = list.filter((m) => m.disabled !== true && m.enabled !== false);
        // 优先选具体模型，跳过 auto/default 等自动路由占位（占位模型可能 502）
        const concrete = usable.find((m) => m.id !== "auto" && m.id !== "default") ?? usable[0];
        if (concrete) setModelId(concrete.id);
        else if (list.length > 0) setModelId(list[0].id);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || "获取云模型列表失败");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const label = (m: CloudModel) => (m.name && m.name !== m.id ? `${m.name}` : m.id);

  async function send() {
    const text = input.trim();
    if (!text || busy || !modelId) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError("");
    setInput("");
    const history: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(history);

    const req: ChatCompletionRequestMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    let answer = "";
    setMessages([...history, { role: "assistant", content: "" }]);
    try {
      for await (const chunk of cloud.llm.chat.completions.create({
        model: modelId,
        messages: req,
        stream: true,
        signal: controller.signal,
      })) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          answer += delta;
          setMessages([...history, { role: "assistant", content: answer }]);
        }
      }
      if (answer === "") setError("未收到回复，请重试");
    } catch (e) {
      const err = e as { name?: string; message?: string; error?: { message?: string } };
      if (err?.name === "AbortError") setError("已停止生成");
      else setError(err?.error?.message || err?.message || "云 AI 调用失败");
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  return (
    <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Cloud className="h-4 w-4 text-violet-600" />
        <span className="text-sm font-semibold text-slate-700">云 AI 对话</span>
        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
          免密钥
        </span>
      </div>

      <select
        value={modelId}
        onChange={(e) => setModelId(e.target.value)}
        className="mb-2 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-violet-500 focus:outline-none"
      >
        {models.length === 0 && <option value="">正在加载云模型…</option>}
        {models.map((m) => (
          <option key={m.id} value={m.id} disabled={m.disabled === true || m.enabled === false}>
            {label(m)}
            {m.disabled === true || m.enabled === false ? "（不可用）" : ""}
          </option>
        ))}
      </select>

      <div ref={scrollRef} className="mb-2 max-h-44 space-y-1.5 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-xs leading-5 text-slate-400">
            已接入云服务，无需配置 API Key 即可与 AI 对话。
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-xs leading-5 ${m.role === "user" ? "text-slate-700" : "text-violet-700"}`}
          >
            <span className="font-medium">{m.role === "user" ? "我：" : "AI："}</span>
            {m.content || (busy && i === messages.length - 1 ? "思考中…" : "")}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-2 flex items-start gap-1.5 rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="leading-4">{error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="输入问题，回车发送"
          className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none"
        />
        {busy ? (
          <button
            onClick={stop}
            className="flex items-center gap-1 rounded-md bg-slate-600 px-2.5 py-1.5 text-xs text-white hover:bg-slate-700"
          >
            <Square className="h-3.5 w-3.5" />停止
          </button>
        ) : (
          <button
            onClick={send}
            disabled={!modelId || !input.trim()}
            className="flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1.5 text-xs text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            发送
          </button>
        )}
      </div>
    </div>
  );
}
