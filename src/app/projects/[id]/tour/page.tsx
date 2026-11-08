"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/AppSidebar";
import { PageContainer } from "@/components/layout/PageContainer";
import { ViewerFrame } from "@/components/layout/ViewerFrame";
import { Card, CardBody, EmptyState, Spinner } from "@/components/ui";
import TourViewer from "@/components/tour/TourViewer";
import { styleById, designStyles } from "@/lib/styles";
import type { FloorplanJson } from "@/lib/parse/pipeline";

type AssetLite = { id: string; status: string; reviewStatus: string; parseJson: string; originalName: string };
type Scheme = { id: string; name: string; styleId: string | null; isPrimary: boolean };

// 与 selectCls 保持一致的圆角 / 边框 / 焦点态，仅尺寸更紧凑
const compactSelectCls =
  "rounded-lg border border-white/[0.08] bg-surface/80 px-2.5 py-1.5 text-sm text-ink outline-none transition-all focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/45";

export default function TourPage() {
  const params = useParams<{ id: string }>();
  const [json, setJson] = useState<FloorplanJson | null>(null);
  const [styleId, setStyleId] = useState("modern-minimal");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${params.id}/floorplans`);
        if (!res.ok) throw new Error(`读取户型数据失败（${res.status}）`);
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
        const schemes: Scheme[] = sdata.schemes ?? [];
        const primary = schemes.find((s) => s.isPrimary) ?? schemes[0];
        if (primary?.styleId && styleById.has(primary.styleId)) setStyleId(primary.styleId);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "读取户型数据失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  return (
    <>
      <TopBar title="全景漫游" subtitle="按入户路径沉浸式查看装修效果" />
      <PageContainer>
        <ViewerFrame className="flex-col gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="tour-style" className="text-xs font-medium text-ink-mute">风格</label>
            <select
              id="tour-style"
              value={styleId}
              onChange={(e) => setStyleId(e.target.value)}
              className={compactSelectCls}
            >
              {designStyles.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <span className="ml-auto hidden text-xs text-ink-mute/60 sm:block">切换风格后自动重新生成漫游</span>
          </div>
          <div className="min-h-0 flex-1">
            {loading ? (
              <Card><CardBody><div className="flex items-center justify-center gap-2 py-14 text-sm text-ink-soft"><Spinner label="加载中" />正在读取户型数据</div></CardBody></Card>
            ) : error ? (
              <Card><CardBody><EmptyState title="暂无可漫游户型" description={error} /></CardBody></Card>
            ) : (
              <TourViewer json={json!} styleId={styleId} projectId={params.id} />
            )}
          </div>
        </ViewerFrame>
      </PageContainer>
    </>
  );
}
