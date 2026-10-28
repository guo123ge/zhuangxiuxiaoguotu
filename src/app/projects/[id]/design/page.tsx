"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/AppSidebar";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardBody, EmptyState, Badge, Button } from "@/components/ui";
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
      setError("请先在「识别与确认」页完成户型解析");
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
      <TopBar title="③ 硬软装设计" subtitle="多套方案参数化设计，可切换对比" />
      <PageContainer>
        <div className="flex h-[calc(100vh-13rem)] min-h-[480px] gap-3">
          {/* 方案侧栏 */}
          <div className="flex w-64 shrink-0 flex-col gap-2 overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink-soft">装修方案</span>
              <Button size="sm" onClick={createScheme}>+ 新建</Button>
            </div>
            {schemes.map((s) => {
              const style = styleById.get(s.styleId ?? "");
              return (
                <Card
                  key={s.id}
                  className={`cursor-pointer ${selA === s.id && !compare ? "ring-2 ring-violet-500" : ""}`}
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
                      <input
                        type="radio"
                        name="compare"
                        className="ml-1"
                        title="选为对比方案 A"
                        checked={selA === s.id}
                        onChange={() => setSelA(s.id)}
                      />
                      <input
                        type="radio"
                        name="compareB"
                        className="ml-1"
                        title="选为对比方案 B"
                        checked={selB === s.id}
                        onChange={() => setSelB(s.id)}
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        className="w-full rounded border border-white/[0.06] px-1 py-0.5 text-xs"
                        value={s.styleId ?? ""}
                        onChange={(e) => changeStyle(s.id, e.target.value)}
                      >
                        {designStyles.map((st) => (
                          <option key={st.id} value={st.id}>{st.name}</option>
                        ))}
                      </select>
                      <button className="text-xs text-ink-mute hover:text-primary-light" onClick={() => setPrimary(s.id)} title="设为主方案">设主</button>
                      <button className="text-xs text-ink-mute hover:text-red-300" onClick={() => removeScheme(s.id)} title="删除">删</button>
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
              <Card><CardBody><EmptyState title="加载中…" description="正在读取户型与方案" /></CardBody></Card>
            ) : error ? (
              <Card><CardBody><EmptyState title="暂无可设计户型" description={error} /></CardBody></Card>
            ) : (
              comparePanel
            )}
          </div>
        </div>
      </PageContainer>
    </>
  );
}
