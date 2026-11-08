"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Star, Trash2 } from "lucide-react";
import { TopBar } from "@/components/layout/AppSidebar";
import { PageContainer } from "@/components/layout/PageContainer";
import { ViewerFrame } from "@/components/layout/ViewerFrame";
import { Card, CardBody, EmptyState, Badge, Button, Spinner } from "@/components/ui";
import ModelViewer from "@/components/model3d/ModelViewer";
import { designStyles, styleById } from "@/lib/styles";
import type { FloorplanJson } from "@/lib/parse/pipeline";

type Scheme = {
  id: string;
  name: string;
  styleId: string | null;
  isPrimary: boolean;
  overlayJson: string;
};
type AssetLite = { id: string; status: string; reviewStatus: string; parseJson: string; originalName: string };
type Overlay = Record<string, Partial<Record<"floor" | "wall" | "ceiling" | "cabinet", string>>>;

// 与 selectCls 保持一致的圆角 / 边框 / 焦点态，仅尺寸更紧凑
const compactSelectCls =
  "w-full rounded-lg border border-white/[0.08] bg-surface/80 px-1.5 py-1 text-xs text-ink outline-none transition-all focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/45";

export default function DesignPage() {
  const params = useParams<{ id: string }>();
  const [json, setJson] = useState<FloorplanJson | null>(null);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [selA, setSelA] = useState<string | null>(null);
  const [selB, setSelB] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    const res = await fetch(`/api/projects/${params.id}/floorplans`);
    const data = await res.json();
    const assets: AssetLite[] = data.assets ?? [];
    const picked =
      assets.find((a) => a.reviewStatus === "CONFIRMED" && a.status === "SUCCEEDED") ??
      [...assets].reverse().find((a) => a.status === "SUCCEEDED");
    if (!picked) {
      setError("请先在「户型识别」页完成户型解析");
      return;
    }
    setJson(JSON.parse(picked.parseJson));

    const sres = await fetch(`/api/projects/${params.id}/schemes`);
    const sdata = await sres.json();
    const list: Scheme[] = sdata.schemes ?? [];
    setSchemes(list);
    if (list.length > 0) {
      setSelA(list.find((s) => s.isPrimary)?.id ?? list[0].id);
      setSelB(list[1]?.id ?? list[0].id);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "读取方案数据失败");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const createScheme = async () => {
    const res = await fetch(`/api/projects/${params.id}/schemes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ styleId: "modern-minimal" }),
    });
    const data = await res.json();
    if (data.scheme) {
      setSchemes((s) => [...s, data.scheme]);
      setSelA(data.scheme.id);
    }
  };

  const changeStyle = async (schemeId: string, styleId: string) => {
    await fetch(`/api/schemes/${schemeId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ styleId }),
    });
    setSchemes((s) => s.map((x) => (x.id === schemeId ? { ...x, styleId } : x)));
  };

  const setPrimary = async (schemeId: string) => {
    await fetch(`/api/schemes/${schemeId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isPrimary: true }),
    });
    setSchemes((s) => s.map((x) => ({ ...x, isPrimary: x.id === schemeId })));
  };

  const removeScheme = async (schemeId: string) => {
    await fetch(`/api/schemes/${schemeId}`, { method: "DELETE" });
    setSchemes((s) => s.filter((x) => x.id !== schemeId));
  };

  const schemeA = schemes.find((s) => s.id === selA);
  const schemeB = schemes.find((s) => s.id === selB);
  const overlayOf = (s?: Scheme): Overlay | undefined => {
    if (!s?.overlayJson) return undefined;
    try { return JSON.parse(s.overlayJson); } catch { return undefined; }
  };

  const comparePanel = useMemo(
    () =>
      compare && schemeA && schemeB ? (
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
          <div className="flex min-h-0 flex-col">
            <div className="px-3 py-1 text-xs font-medium text-ink-soft">{schemeA.name}</div>
            <div className="min-h-0 flex-1"><ModelViewer json={json} defaultStyleId={schemeA.styleId ?? "modern-minimal"} overlay={overlayOf(schemeA)} /></div>
          </div>
          <div className="flex min-h-0 flex-col">
            <div className="px-3 py-1 text-xs font-medium text-ink-soft">{schemeB.name}</div>
            <div className="min-h-0 flex-1"><ModelViewer json={json} defaultStyleId={schemeB.styleId ?? "modern-minimal"} overlay={overlayOf(schemeB)} /></div>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <ModelViewer json={json} defaultStyleId={schemeA?.styleId ?? "modern-minimal"} overlay={overlayOf(schemeA)} />
        </div>
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [compare, schemeA, schemeB, json],
  );

  return (
    <>
      <TopBar title="方案设计" subtitle="多套装修方案参数化切换，支持同屏对比" />
      <PageContainer>
        <ViewerFrame className="flex-col gap-3 md:flex-row">
          {/* 方案侧栏 */}
          <div className="flex w-full shrink-0 flex-col gap-2 overflow-y-auto md:w-64">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink-soft">装修方案</span>
              <Button size="sm" onClick={createScheme} aria-label="新建方案">
                <Plus size={14} aria-hidden="true" /> 新建
              </Button>
            </div>
            {schemes.map((s) => {
              const style = styleById.get(s.styleId ?? "");
              return (
                <Card
                  key={s.id}
                  className={`cursor-pointer ${selA === s.id && !compare ? "ring-2 ring-primary" : ""}`}
                >
                  <CardBody className="py-2">
                    <div className="flex items-center gap-2" onClick={() => { setSelA(s.id); setCompare(false); }}>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-ink">
                          {s.name}
                          {s.isPrimary && <Badge tone="primary">主</Badge>}
                        </div>
                        <div className="truncate text-xs text-ink-mute">{style?.name ?? "未选风格"}</div>
                      </div>
                      <label className="flex items-center gap-1 text-2xs text-ink-mute" title="选为对比方案 A">
                        <input
                          type="radio"
                          name="compare"
                          aria-label={`将 ${s.name} 选为对比方案 A`}
                          checked={selA === s.id}
                          onChange={() => setSelA(s.id)}
                        />
                        A
                      </label>
                      <label className="flex items-center gap-1 text-2xs text-ink-mute" title="选为对比方案 B">
                        <input
                          type="radio"
                          name="compareB"
                          aria-label={`将 ${s.name} 选为对比方案 B`}
                          checked={selB === s.id}
                          onChange={() => setSelB(s.id)}
                        />
                        B
                      </label>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        aria-label={`${s.name} 的装修风格`}
                        className={compactSelectCls}
                        value={s.styleId ?? ""}
                        onChange={(e) => changeStyle(s.id, e.target.value)}
                      >
                        {designStyles.map((st) => (
                          <option key={st.id} value={st.id}>{st.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        aria-label={`将 ${s.name} 设为主方案`}
                        title="设为主方案"
                        className="rounded p-1 text-ink-mute transition-colors hover:bg-white/6 hover:text-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        onClick={() => setPrimary(s.id)}
                      >
                        <Star size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`删除 ${s.name}`}
                        title="删除方案"
                        className="rounded p-1 text-ink-mute transition-colors hover:bg-danger/10 hover:text-on-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        onClick={() => removeScheme(s.id)}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
            {schemes.length === 0 && !loading && (
              <EmptyState title="暂无方案" description="点击「新建」从风格模板创建第一套方案" />
            )}
            {schemes.length >= 2 && (
              <Button
                variant={compare ? "primary" : "ghost"}
                onClick={() => setCompare((v) => !v)}
              >
                {compare ? "退出对比" : "A/B 同屏对比"}
              </Button>
            )}
          </div>

          {/* 查看区 */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {loading ? (
              <Card><CardBody><div className="flex items-center justify-center gap-2 py-14 text-sm text-ink-soft"><Spinner label="加载中" />正在读取户型与方案</div></CardBody></Card>
            ) : error ? (
              <Card><CardBody><EmptyState title="暂无可设计户型" description={error} /></CardBody></Card>
            ) : (
              comparePanel
            )}
          </div>
        </ViewerFrame>
      </PageContainer>
    </>
  );
}
