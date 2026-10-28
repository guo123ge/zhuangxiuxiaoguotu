"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Sparkles,
  Download,
  ArrowRight,
  Box,
  ScanLine,
  Users,
  Layers,
  Building2,
} from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Badge,
  EmptyState,
  Field,
  inputCls,
  Alert,
} from "@/components/ui";
import type { SampleFloorplan } from "@/lib/samples";

type ProjectItem = {
  id: string;
  title: string;
  unitNo: string;
  clientName: string;
  status: string;
  workflowStatus: string;
  workflowLabel: string;
  coverUrl: string | null;
  viewCount: number;
  updatedAt: string;
  roomCount: number;
  floorplanCount: number;
  routeCount: number;
};

export function HomeClient({
  projects,
  samples,
}: {
  projects: ProjectItem[];
  samples: SampleFloorplan[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"projects" | "samples">("projects");
  const [creating, setCreating] = useState(false);
  const [creatingSampleId, setCreatingSampleId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    unitNo: "",
    clientName: "",
    designer: "",
  });

  async function createProject(sampleId?: string) {
    setError("");
    const payload: Record<string, string> = {
      title: sampleId
        ? samples.find((s) => s.id === sampleId)!.name + " · 装修方案"
        : form.title.trim(),
      unitNo: sampleId
        ? samples.find((s) => s.id === sampleId)!.unitNo
        : form.unitNo.trim(),
      clientName: form.clientName.trim(),
      designer: form.designer.trim(),
    };
    if (sampleId) payload.sampleFloorplanId = sampleId;

    if (!payload.title) {
      setError("请填写项目名称。");
      return;
    }

    if (sampleId) setCreatingSampleId(sampleId);
    else setCreating(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "创建失败，请重试。");
        return;
      }
      router.push(`/projects/${data.project.id}/parse`);
    } catch {
      setError("网络错误，请重试。");
    } finally {
      setCreating(false);
      setCreatingSampleId(null);
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* 页头 — AuraDesign VR 风格 */}
      <header className="border-b border-white/[0.06] bg-sidebar/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-8">
          {/* Logo 区域 */}
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-glow-purple">
              <Sparkles size={18} className="text-white" />
            </span>
            <div>
              <span className="text-[15px] font-bold tracking-tight text-white">
                AuraDesign VR
              </span>
              <span className="ml-2 text-[12px] text-ink-mute">AI 装修项目控制台</span>
            </div>
          </div>

          {/* 导航标签 */}
          <nav className="flex items-center gap-1 rounded-xl bg-white/[0.04] p-1">
            <button
              onClick={() => setTab("projects")}
              className={`rounded-lg px-4 py-2 text-[13px] font-medium transition-all ${
                tab === "projects"
                  ? "bg-primary/20 text-white shadow-sm"
                  : "text-ink-mute hover:text-ink hover:bg-white/5"
              }`}
            >
              项目列表
            </button>
            <button
              onClick={() => setTab("samples")}
              className={`rounded-lg px-4 py-2 text-[13px] font-medium transition-all ${
                tab === "samples"
                  ? "bg-primary/20 text-white shadow-sm"
                  : "text-ink-mute hover:text-ink hover:bg-white/5"
              }`}
            >
              项目详情
            </button>
          </nav>

          {/* 右侧工具 */}
          <div className="flex items-center gap-3">
            <button className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-mute transition-colors hover:bg-white/6 hover:text-ink">
              <Building2 size={18} />
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-white shadow-sm">
              <Users size={17} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-8 py-7">
        {tab === "projects" ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px]">
            {/* 项目列表 */}
            <div>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-[19px] font-semibold text-white">项目列表</h2>
                  <p className="mt-1 text-[12.5px] text-ink-mute">
                    共 {projects.length} 个项目
                  </p>
                </div>
              </div>

              {projects.length === 0 ? (
                <EmptyState
                  title="还没有项目"
                  description="新建项目后上传户型图，或直接从右侧标准户型图库一键创建。"
                />
              ) : (
                <div className="space-y-3">
                  {projects.map((p) => (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="group block rounded-xl border border-white/[0.06] bg-surface/60 backdrop-blur-sm p-0 transition-all hover:border-border-hover hover:bg-surface-hi/80 hover:shadow-card"
                    >
                      <div className="flex items-stretch gap-0">
                        {/* 封面图 */}
                        <div className="flex h-[104px] w-[168px] shrink-0 items-center justify-center overflow-hidden bg-surface-hi/50 rounded-l-xl">
                          {p.coverUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.coverUrl}
                              alt=""
                              className="h-full w-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                            />
                          ) : (
                            <Box size={26} className="text-ink-mute/40" />
                          )}
                        </div>
                        {/* 信息区 */}
                        <div className="flex min-w-0 flex-1 flex-col justify-center px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <h3 className="truncate text-[14.5px] font-semibold text-white group-hover:text-primary-light transition-colors">
                              {p.title}
                            </h3>
                            <Badge tone="primary">{p.workflowLabel}</Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-ink-mute">
                            <span className="inline-flex items-center gap-1.5">
                              <ScanLine size={13} /> 户型图 {p.floorplanCount}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Layers size={13} /> 房间 {p.roomCount}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Users size={13} /> 浏览 {p.viewCount}
                            </span>
                            {p.unitNo && <span>编号 {p.unitNo}</span>}
                            {p.clientName && <span>客户 {p.clientName}</span>}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center pr-5 text-ink-mute/30 group-hover:text-primary/60 transition-colors">
                          <ArrowRight size={18} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* 右侧面板：新建项目 + 样本库 */}
            <div className="space-y-5">
              <Card>
                <CardHeader
                  title="新建项目"
                  subtitle="上传自有户型图，或从标准户型图库加载"
                />
                <CardBody className="space-y-4">
                  {error && <Alert tone="danger">{error}</Alert>}
                  <Field label="项目名称">
                    <input
                      className={inputCls}
                      value={form.title}
                      onChange={(e) =>
                        setForm({ ...form, title: e.target.value })
                      }
                      placeholder="如：中粮青云府 雲崑 装修方案"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="户型编号">
                      <input
                        className={inputCls}
                        value={form.unitNo}
                        onChange={(e) =>
                          setForm({ ...form, unitNo: e.target.value })
                        }
                        placeholder="A户型"
                      />
                    </Field>
                    <Field label="设计师">
                      <input
                        className={inputCls}
                        value={form.designer}
                        onChange={(e) =>
                          setForm({ ...form, designer: e.target.value })
                        }
                        placeholder="姓名"
                      />
                    </Field>
                  </div>
                  <Field label="客户名称">
                    <input
                      className={inputCls}
                      value={form.clientName}
                      onChange={(e) =>
                        setForm({ ...form, clientName: e.target.value })
                      }
                      placeholder="选填"
                    />
                  </Field>
                  <Button
                    className="w-full"
                    onClick={() => createProject()}
                    disabled={creating}
                  >
                    {creating ? "创建中…" : "创建项目并上传户型图"}
                  </Button>
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="标准户型图库"
                  subtitle="可直接下载，或一键创建项目"
                />
                <CardBody className="space-y-3">
                  {samples.slice(0, 3).map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5 transition-colors hover:border-border-hover hover:bg-white/[0.04]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={s.previewUrl}
                        alt={s.name}
                        className="h-14 w-20 shrink-0 rounded-lg object-cover opacity-80"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-white">{s.name}</p>
                        <p className="text-[11.5px] text-ink-mute mt-0.5">
                          {s.grossAreaM2}m² · {s.unitNo}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <a
                          href={s.fileUrl}
                          download
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-mute hover:bg-white/6 hover:text-ink transition-colors"
                          title="下载户型图"
                        >
                          <Download size={15} />
                        </a>
                        <button
                          onClick={() => createProject(s.id)}
                          disabled={creatingSampleId === s.id}
                          className="flex h-8 items-center gap-1 rounded-lg bg-gradient-to-r from-primary to-purple-500 px-2.5 text-[11.5px] font-medium text-white shadow-glow-purple hover:brightness-110 disabled:opacity-60"
                        >
                          {creatingSampleId === s.id ? "…" : "使用"}
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setTab("samples")}
                    className="w-full text-center text-[12.5px] font-medium text-secondary-light hover:text-secondary transition-colors py-1"
                  >
                    查看全部 {samples.length} 套标准户型图 →
                  </button>
                </CardBody>
              </Card>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-6">
              <h2 className="text-[19px] font-semibold text-white">
                标准户型图库
              </h2>
              <p className="mt-1 text-[12.5px] text-ink-mute">
                这些户型图可直接下载使用，也可一键创建项目并立即开始识别。
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {samples.map((s) => (
                <Card key={s.id} className="overflow-hidden group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.previewUrl}
                    alt={s.name}
                    className="h-[200px] w-full bg-surface object-contain opacity-70 group-hover:opacity-90 transition-opacity"
                  />
                  <CardBody className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-[14px] font-semibold text-white">{s.name}</h3>
                        <p className="mt-0.5 text-[11.5px] text-ink-mute">
                          {s.grossAreaM2}m² · {s.unitNo} · {s.width}×{s.height}px
                        </p>
                      </div>
                      <Badge tone="info">{s.id}</Badge>
                    </div>
                    <p className="text-[12px] leading-5 text-ink-mute/80">
                      {s.note}
                    </p>
                    <div className="flex gap-2">
                      <a
                        href={s.fileUrl}
                        download
                        className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] text-[12.5px] font-medium text-ink-soft hover:bg-white/5 hover:text-ink transition-colors"
                      >
                        <Download size={13} /> 下载
                      </a>
                      <button
                        onClick={() => createProject(s.id)}
                        disabled={creatingSampleId === s.id}
                        className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-purple-500 text-[12.5px] font-medium text-white shadow-glow-purple hover:brightness-110 disabled:opacity-60"
                      >
                        {creatingSampleId === s.id ? "创建中…" : "一键创建项目"}
                      </button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
