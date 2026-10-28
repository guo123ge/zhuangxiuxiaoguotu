"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/AppSidebar";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardBody, CardHeader, Badge, Button } from "@/components/ui";

type QtyLine = { id?: string; itemName: string; category: string; quantity: number; unit: string; roomId: string | null; formulaJson?: string };
type BudgetRow = { itemName: string; category: string; quantity: number; unit: string; unitPrice: number; laborPrice: number; amount: number };
type ShareLink = { id: string; shortToken: string; hasAccessCode: boolean; viewCount: number; revokedAt: string | null; createdAt: string };
type Proposal = { id: string; prompt: string; patchJson: string; status: string; summary?: string };
type Reference = { id: string; originalName: string; fileUrl: string; thumbnailUrl: string | null; createdAt: string };

export default function ManagePage() {
  const params = useParams<{ id: string }>();
  const [quantities, setQuantities] = useState<QtyLine[]>([]);
  const [budget, setBudget] = useState<BudgetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [newShare, setNewShare] = useState<{ token: string; url: string; accessCode: string | null } | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [prompt, setPrompt] = useState("");
  const [references, setReferences] = useState<Reference[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const loadAll = async () => {
    const [q, s, p, r] = await Promise.all([
      fetch(`/api/projects/${params.id}/quantities`).then((r) => r.json()),
      fetch(`/api/projects/${params.id}/share`).then((r) => r.json()),
      fetch(`/api/projects/${params.id}/proposals`).then((r) => r.json()),
      fetch(`/api/projects/${params.id}/references`).then((r) => r.json()),
    ]);
    setQuantities(q.lines ?? []);
    setLinks(s.links ?? []);
    setProposals(p.proposals ?? []);
    setReferences(r.references ?? []);
    if ((q.lines ?? []).length > 0) {
      const b = await fetch(`/api/projects/${params.id}/budget`).then((r) => r.json());
      setBudget(b.rows ?? []);
      setTotal(b.total ?? 0);
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [params.id]);

  const genQuantities = async () => {
    setBusy(true); setMsg("");
    const r = await fetch(`/api/projects/${params.id}/quantities`, { method: "POST" });
    const j = await r.json();
    setBusy(false);
    if (r.ok) { setMsg("工程量已生成"); await loadAll(); }
    else setMsg(j.error || "生成失败");
  };

  const genBudget = async () => {
    setBusy(true); setMsg("");
    const r = await fetch(`/api/projects/${params.id}/budget`, { method: "POST" });
    const j = await r.json();
    setBusy(false);
    if (r.ok) { setMsg("预算已生成"); setBudget(j.rows); setTotal(j.total); }
    else setMsg(j.error || "生成失败");
  };

  const createShare = async () => {
    setMsg("");
    const r = await fetch(`/api/projects/${params.id}/share`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessCode }),
    });
    const j = await r.json();
    if (r.ok) { setNewShare(j); await loadAll(); }
    else setMsg(j.error || "创建失败");
  };

  const propose = async () => {
    setBusy(true); setMsg("");
    const r = await fetch(`/api/projects/${params.id}/proposals`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const j = await r.json();
    setBusy(false);
    if (r.ok) { setMsg(`已生成提案：${j.summary ?? ""}`); setPrompt(""); await loadAll(); }
    else setMsg(j.error || "提案失败");
  };

  const applyProposal = async (id: string, action: string) => {
    await fetch(`/api/proposals/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await loadAll();
  };

  const uploadReference = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg("");
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch(`/api/projects/${params.id}/references`, { method: "POST", body: fd });
    const j = await r.json();
    if (r.ok) { await loadAll(); }
    else setMsg(j.error || "上传失败");
    e.target.value = "";
  };

  const removeReference = async (id: string) => {
    await fetch(`/api/references/${id}`, { method: "DELETE" });
    await loadAll();
  };

  return (
    <>
      <TopBar title="⑤ 分享与配套" subtitle="客户分享、参考图、工程量预算、AI 变更提案" />
      <PageContainer>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* 分享 */}
          <Card>
            <CardHeader title="客户分享" subtitle="生成只读链接，客户可查看三维与全景并反馈" />
            <CardBody className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="访问码（可选，留空则免码）"
                  className="min-w-0 flex-1 rounded border border-white/[0.08] px-3 py-1.5 text-sm"
                />
                <Button size="sm" onClick={createShare}>生成链接</Button>
              </div>
              {newShare && (
                <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
                  <p className="font-medium text-emerald-700">链接已生成（token 仅显示一次）</p>
                  <p className="mt-1 break-all text-emerald-600">{newShare.url}</p>
                  {newShare.accessCode && <p className="text-emerald-600">访问码：{newShare.accessCode}</p>}
                </div>
              )}
              {links.length === 0 ? (
                <p className="text-sm text-ink-mute">尚无分享链接</p>
              ) : (
                <ul className="space-y-1.5">
                  {links.map((l) => (
                    <li key={l.id} className="flex items-center gap-2 text-sm text-ink-soft">
                      <span className="font-mono text-xs">{l.shortToken}</span>
                      {l.hasAccessCode && <Badge tone="warning">有访问码</Badge>}
                      <span className="text-xs text-ink-mute">浏览 {l.viewCount}</span>
                      <span className="ml-auto text-xs text-ink-mute">{l.revokedAt ? "已撤销" : new Date(l.createdAt).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* AI 提案 */}
          <Card>
            <CardHeader title="AI 变更提案" subtitle="用一句话描述修改，生成参数补丁后确认应用" />
            <CardBody className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="例如：把主卧墙面换成奶油白、地面换浅色木地板"
                  className="min-w-0 flex-1 rounded border border-white/[0.08] px-3 py-1.5 text-sm"
                />
                <Button size="sm" onClick={propose} disabled={busy || !prompt}>生成提案</Button>
              </div>
              {proposals.length === 0 ? (
                <p className="text-sm text-ink-mute">暂无提案</p>
              ) : (
                <ul className="space-y-2">
                  {proposals.slice(0, 8).map((p) => (
                    <li key={p.id} className="rounded border border-white/[0.06] p-2 text-sm">
                      <p className="text-ink-soft">{p.prompt}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge tone={p.status === "APPLIED" ? "success" : p.status === "REJECTED" ? "danger" : "neutral"}>
                          {p.status === "APPLIED" ? "已应用" : p.status === "REJECTED" ? "已拒绝" : p.status === "UNDONE" ? "已撤销" : "待处理"}
                        </Badge>
                        {p.status === "PROPOSED" && (
                          <>
                            <button className="text-xs text-emerald-600 hover:underline" onClick={() => applyProposal(p.id, "APPLY")}>应用</button>
                            <button className="text-xs text-red-500 hover:underline" onClick={() => applyProposal(p.id, "REJECT")}>拒绝</button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* 参考图 */}
          <Card>
            <CardHeader title="参考图" subtitle="上传风格参考、现场照片或意向图，作为设计参考" />
            <CardBody className="space-y-3">
              <label className="block cursor-pointer rounded border border-dashed border-white/[0.08] px-4 py-6 text-center text-sm text-ink-mute hover:border-primary/50 hover:text-primary-light">
                点击上传图片（PNG / JPG / WebP）
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={uploadReference} />
              </label>
              {references.length === 0 ? (
                <p className="text-sm text-ink-mute">暂无参考图</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {references.map((ref) => (
                    <div key={ref.id} className="group relative overflow-hidden rounded border border-white/[0.06]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ref.thumbnailUrl ?? ref.fileUrl} alt={ref.originalName} className="h-20 w-full object-cover" />
                      <div className="absolute inset-0 hidden items-center justify-end bg-black/40 p-1 group-hover:flex">
                        <button className="rounded bg-surface/80/90 px-2 py-0.5 text-xs text-red-600" onClick={() => removeReference(ref.id)}>删除</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* 工程量与预算 */}
        <Card className="mt-6">
          <CardHeader
            title="工程量与预算"
            subtitle="地面/墙面/顶面/踢脚线/门窗/橱柜的精确计量与参考报价"
            right={
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={genQuantities} disabled={busy}>生成工程量</Button>
                <Button size="sm" variant="secondary" onClick={genBudget} disabled={busy || quantities.length === 0}>生成预算</Button>
                <a href={`/api/projects/${params.id}/export?format=csv`} className="inline-flex items-center rounded bg-gradient-to-r from-primary to-purple-500 px-3 py-1 text-xs text-white hover:brightness-110">导出 CSV</a>
                <a href={`/api/projects/${params.id}/export?format=json`} className="inline-flex items-center rounded bg-gradient-to-r from-primary to-purple-500 px-3 py-1 text-xs text-white hover:brightness-110">导出 JSON</a>
              </div>
            }
          />
          <CardBody>
            {msg && <p className="mb-3 text-sm text-ink-mute">{msg}</p>}
            {quantities.length === 0 ? (
              <p className="text-sm text-ink-mute">尚未生成工程量，点击「生成工程量」开始。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-xs text-ink-mute">
                      <th className="pb-2 pr-4">项目</th>
                      <th className="pb-2 pr-4">类别</th>
                      <th className="pb-2 pr-4">工程量</th>
                      <th className="pb-2 pr-4">单位</th>
                      {budget.length > 0 && (<><th className="pb-2 pr-4">单价(主材/人工)</th><th className="pb-2">金额(元)</th></>)}
                    </tr>
                  </thead>
                  <tbody>
                    {quantities.map((q, i) => (
                      <tr key={i} className="border-b border-white/[0.05] last:border-0">
                        <td className="py-2 pr-4">{q.itemName}</td>
                        <td className="py-2 pr-4 text-ink-mute">{q.category}</td>
                        <td className="py-2 pr-4">{q.quantity}</td>
                        <td className="py-2 pr-4">{q.unit}</td>
                        {budget[i] && (<>
                          <td className="py-2 pr-4 text-ink-mute">{budget[i].unitPrice}/{budget[i].laborPrice}</td>
                          <td className="py-2 font-medium">{budget[i].amount}</td>
                        </>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {total > 0 && (
                  <p className="mt-3 text-right text-sm font-semibold text-ink">合计（含损耗）：¥{total.toLocaleString()}</p>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      </PageContainer>
    </>
  );
}
