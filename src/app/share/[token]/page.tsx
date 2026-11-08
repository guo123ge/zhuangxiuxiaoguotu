"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import ModelViewer from "@/components/model3d/ModelViewer";
import TourViewer from "@/components/tour/TourViewer";
import {
  Button,
  Card,
  CardBody,
  Badge,
  EmptyState,
  Notice,
  Spinner,
  inputCls,
  Select,
} from "@/components/ui";
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

  let body: ReactNode;
  if (error) {
    body = (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <EmptyState title="暂无法查看方案" description={error} />
        </div>
      </div>
    );
  } else if (locked) {
    body = (
      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardBody className="space-y-4 p-6">
            <div>
              <h1 className="text-lg font-semibold text-ink">需要访问码</h1>
              <p className="mt-1 text-sm text-ink-mute">此方案受访问码保护，请输入设计师提供的访问码。</p>
            </div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="访问码"
              className={inputCls}
            />
            <Button className="w-full" onClick={submitCode}>进入查看</Button>
          </CardBody>
        </Card>
      </div>
    );
  } else if (!data) {
    body = (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-ink-mute">
        <Spinner label="加载中" /> 加载中…
      </div>
    );
  } else {
    body = (
      <>
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface/60 px-6 py-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-base font-semibold text-ink">
              {data.project.title}
              {data.project.unitNo && <Badge tone="neutral">{data.project.unitNo}</Badge>}
            </h1>
            <p className="mt-0.5 text-xs text-ink-mute">
              {data.project.clientName ? `客户：${data.project.clientName} · ` : ""}设计师：{data.project.designer || "—"}
            </p>
          </div>
          <div role="tablist" aria-label="查看方式" className="ml-auto flex gap-1 rounded-lg bg-white/[0.04] p-1">
            {(["model", "tour"] as const).map((t) => (
              <Button
                key={t}
                role="tab"
                aria-selected={tab === t}
                variant={tab === t ? "primary" : "ghost"}
                size="sm"
                onClick={() => setTab(t)}
                className="min-w-[92px]"
              >
                {t === "model" ? "三维模型" : "全景漫游"}
              </Button>
            ))}
          </div>
        </div>

        <main className="min-h-0 flex-1 p-4">
          {data.floorplan ? (
            tab === "model" ? (
              <ModelViewer json={data.floorplan} defaultStyleId={primaryScheme?.styleId ?? "modern-minimal"} overlay={overlay} />
            ) : (
              <TourViewer json={data.floorplan} styleId={primaryScheme?.styleId ?? "modern-minimal"} projectId={data.project.id} />
            )
          ) : (
            <div className="flex h-full min-h-64 items-center justify-center">
              <div className="w-full max-w-md">
                <EmptyState title="暂无户型数据" description="该方案暂无户型数据，请稍后再来查看。" />
              </div>
            </div>
          )}
        </main>

        <footer className="border-t border-border bg-surface/60 px-6 py-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-sm font-semibold text-ink">反馈与确认</h2>
            {sent && <Notice tone="success" className="mt-2 mb-3">已提交，设计师会尽快处理。</Notice>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="w-40 shrink-0">
                <Select value={decision} onChange={(e) => setDecision(e.target.value)} aria-label="整体确认">
                  <option value="">— 整体确认 —</option>
                  <option value="APPROVED">确认通过</option>
                  <option value="NEED_CHANGE">需要修改</option>
                  <option value="UNDECIDED">暂不确定</option>
                </Select>
              </div>
              <div className="min-w-0 flex-1">
                <input
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="补充意见（可选）"
                  className={inputCls}
                />
              </div>
              <Button
                onClick={submitFeedback}
                disabled={!feedback && !decision}
              >
                提交
              </Button>
            </div>
          </div>
        </footer>
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="flex items-center gap-2.5 border-b border-border bg-sidebar/80 px-6 py-3 backdrop-blur-md">
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-primary shadow-glow-purple" />
        <span className="text-sm font-semibold tracking-tight text-ink">AuraDesign VR</span>
        <span className="text-xs text-ink-mute">方案分享</span>
      </header>
      {body}
    </div>
  );
}
