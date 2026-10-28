import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageContainer } from "@/components/layout/PageContainer";
import { TopBar } from "@/components/layout/AppSidebar";
import {
  Card,
  CardBody,
  CardHeader,
  Badge,
  StepBar,
  Button,
  Alert,
} from "@/components/ui";
import {
  WORKFLOW_LABEL,
  WORKFLOW_STEPS,
  WORKFLOW_STATUS,
  ROOM_TYPE_LABEL,
} from "@/lib/enums";

export const dynamic = "force-dynamic";

function stepIndex(status: string) {
  for (let i = 0; i < WORKFLOW_STEPS.length; i++) {
    if (WORKFLOW_STEPS[i].statuses.includes(status as never)) return i;
  }
  return 0;
}

export default async function ProjectOverviewPage({
  params,
}: {
  params: { id: string };
}) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      floorplans: { orderBy: { createdAt: "desc" } },
      rooms: { orderBy: { order: "asc" } },
      walls: true,
      openings: true,
      schemes: { orderBy: { order: "asc" } },
      routes: { include: { scenes: true }, orderBy: { createdAt: "desc" } },
      elements: { select: { id: true } },
      adjacencies: true,
    },
  });
  if (!project) notFound();

  const idx = stepIndex(project.workflowStatus);
  const totalArea = project.rooms.reduce((sum, r) => sum + r.areaM2, 0);
  const walls = project.walls.filter((w) => !w.isVirtual);
  const entryDoor = project.openings.find((o) => o.isEntryDoor);

  return (
    <>
      <TopBar
        title={project.title}
        subtitle={`${project.unitNo || "未编号"} · 更新于 ${project.updatedAt.toLocaleString("zh-CN")}`}
        right={
          <Badge tone={project.status === "PUBLISHED" ? "success" : "neutral"}>
            {WORKFLOW_LABEL[project.workflowStatus as keyof typeof WORKFLOW_LABEL] ??
              project.workflowStatus}
          </Badge>
        }
      />
      <PageContainer>
        {/* 工作流进度 */}
        <Card>
          <CardBody className="py-5">
            <StepBar
              steps={WORKFLOW_STEPS.map((s) => ({ key: s.key, label: s.label }))}
              current={idx}
            />
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            {/* 项目概况 */}
            <Card>
              <CardHeader title="项目概况" subtitle="参数化空间模型的项目级数据" />
              <CardBody>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
                  <Stat label="户型编号" value={project.unitNo || "—"} />
                  <Stat label="客户" value={project.clientName || "—"} />
                  <Stat label="设计师" value={project.designer || "—"} />
                  <Stat
                    label="层高"
                    value={`${(project.floorHeightMm / 1000).toFixed(2)} m`}
                  />
                  <Stat label="房间数" value={String(project.rooms.length)} />
                  <Stat
                    label="建筑面积"
                    value={totalArea > 0 ? `${totalArea.toFixed(1)} m²` : "—"}
                  />
                  <Stat label="墙段数" value={String(walls.length)} />
                  <Stat label="开口数" value={String(project.openings.length)} />
                </dl>
                {project.designBrief && (
                  <p className="mt-4 border-t border-border pt-4 text-[13px] leading-6 text-ink-soft">
                    {project.designBrief}
                  </p>
                )}
              </CardBody>
            </Card>

            {/* 房间清单 */}
            <Card>
              <CardHeader
                title="房间清单"
                subtitle={
                  project.rooms.length > 0
                    ? `${project.rooms.length} 个房间，来自确认后的识别结果`
                    : "尚未完成户型识别"
                }
              />
              <CardBody>
                {project.rooms.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-[13px] text-ink-soft">
                      还没有房间数据，请先完成第一步户型识别。
                    </p>
                    <Link href={`/projects/${project.id}/parse`} className="mt-4 inline-block">
                      <Button size="sm">前往户型识别</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[13px]">
                      <thead>
                        <tr className="border-b border-border text-[12px] text-ink-soft">
                          <th className="pb-2.5 pr-4 font-semibold">房间</th>
                          <th className="pb-2.5 pr-4 font-semibold">类型</th>
                          <th className="pb-2.5 pr-4 font-semibold">面积</th>
                          <th className="pb-2.5 pr-4 font-semibold">开间 × 进深</th>
                          <th className="pb-2.5 pr-4 font-semibold">朝向</th>
                          <th className="pb-2.5 pr-4 font-semibold">识别来源</th>
                          <th className="pb-2.5 font-semibold">置信度</th>
                        </tr>
                      </thead>
                      <tbody>
                        {project.rooms.map((r) => (
                          <tr
                            key={r.id}
                            className="border-b border-border/60 last:border-0"
                          >
                            <td className="py-2.5 pr-4 font-medium text-ink">
                              {r.name}
                            </td>
                            <td className="py-2.5 pr-4 text-ink-soft">
                              {ROOM_TYPE_LABEL[r.roomType as keyof typeof ROOM_TYPE_LABEL] ??
                                r.roomType}
                            </td>
                            <td className="py-2.5 pr-4 text-ink-soft">
                              {r.areaM2.toFixed(1)} m²
                            </td>
                            <td className="py-2.5 pr-4 text-ink-soft">
                              {r.lengthMm && r.widthMm
                                ? `${(r.lengthMm / 1000).toFixed(2)} × ${(r.widthMm / 1000).toFixed(2)} m`
                                : "—"}
                            </td>
                            <td className="py-2.5 pr-4 text-ink-soft">
                              {r.orientation || "—"}
                            </td>
                            <td className="py-2.5 pr-4">
                              <Badge tone="neutral">{r.source}</Badge>
                            </td>
                            <td className="py-2.5">
                              <span
                                  className={
                                    r.confidence >= 0.75
                                      ? "text-secondary-light"
                                      : r.confidence >= 0.55
                                        ? "text-yellow-300"
                                        : "text-red-300"
                                  }
                                >
                                {(r.confidence * 100).toFixed(0)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="space-y-6">
            {/* 下一步 */}
            <Card>
              <CardHeader title="继续工作流" />
              <CardBody className="space-y-2.5">
                {(
                  [
                    { key: "parse", label: "① 户型识别", desc: "上传并解析户型图" },
                    { key: "model", label: "② 三维建模", desc: "生成精确三维模型" },
                    { key: "design", label: "③ 方案设计", desc: "硬装软装多方案对比" },
                    { key: "tour", label: "④ 全景漫游", desc: "入户路径全景漫游" },
                    { key: "manage", label: "⑤ 分享与配套", desc: "客户分享、工程量预算、AI 提案" },
                  ] as const
                ).map((item) => (
                  <Link
                    key={item.key}
                    href={`/projects/${project.id}/${item.key}`}
                    className="flex items-center justify-between rounded-xl border border-white/[0.06] px-4 py-3 transition-colors hover:border-border-hover hover:bg-white/[0.04]"
                  >
                    <div>
                      <p className="text-[13.5px] font-medium text-ink">
                        {item.label}
                      </p>
                      <p className="text-[12px] text-ink-soft">{item.desc}</p>
                    </div>
                    <span className="text-ink-mute">→</span>
                  </Link>
                ))}
              </CardBody>
            </Card>

            {/* 户型图资产 */}
            <Card>
              <CardHeader title="户型图资产" />
              <CardBody className="space-y-3">
                {project.floorplans.length === 0 ? (
                  <p className="py-2 text-[13px] text-ink-soft">尚未上传户型图。</p>
                ) : (
                  project.floorplans.map((f) => (
                    <div
                      key={f.id}
                      className="rounded-[0.5rem] border border-border p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-[13px] font-medium text-ink">
                          {f.originalName}
                        </p>
                        <Badge
                          tone={
                            f.pageKind === "BLUEPRINT"
                              ? "info"
                              : f.pageKind === "MARKETING"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {f.pageKind === "BLUEPRINT"
                            ? "户型图"
                            : f.pageKind === "MARKETING"
                              ? "营销页"
                              : "未分类"}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-[12px] text-ink-soft">
                        {f.width}×{f.height}px · {f.fileType}
                        {f.scaleMmPerPx
                          ? ` · 比例 ${f.scaleMmPerPx.toFixed(2)} mm/px`
                          : ""}
                      </p>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>

            {/* 识别状态提示 */}
            {project.workflowStatus === WORKFLOW_STATUS.CREATED && (
              <Alert tone="info" title="尚未上传户型图">
                请先在「① 户型识别」中上传户型图，或使用标准户型图库一键创建。
              </Alert>
            )}
            {entryDoor && (
              <Alert tone="success" title="已识别入户门">
                宽度 {(entryDoor.widthMm / 1000).toFixed(2)} m，将作为全景漫游路径起点。
              </Alert>
            )}
          </div>
        </div>
      </PageContainer>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-mute">
        {label}
      </dt>
      <dd className="mt-1 text-[15px] font-semibold text-ink">{value}</dd>
    </div>
  );
}
