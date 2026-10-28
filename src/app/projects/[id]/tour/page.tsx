"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/AppSidebar";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardBody, EmptyState } from "@/components/ui";
import TourViewer from "@/components/tour/TourViewer";
import { styleById, designStyles } from "@/lib/styles";
import type { FloorplanJson } from "@/lib/parse/pipeline";

type AssetLite = { id: string; status: string; reviewStatus: string; parseJson: string; originalName: string };
type Scheme = { id: string; name: string; styleId: string | null; isPrimary: boolean };

export default function TourPage() {
  const params = useParams<{ id: string }>();
  const [json, setJson] = useState<FloorplanJson | null>(null);
  const [styleId, setStyleId] = useState("modern-minimal");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
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
        const schemes: Scheme[] = sdata.schemes ?? [];
        const primary = schemes.find((s) => s.isPrimary) ?? schemes[0];
        if (primary?.styleId && styleById.has(primary.styleId)) setStyleId(primary.styleId);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  return (
    <>
      <TopBar title="④ 全景漫游" subtitle="入户路径沉浸式体验装修效果" />
      <PageContainer>
        <div className="flex h-[calc(100vh-13rem)] min-h-[480px] flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink-mute">风格</span>
            <select
              value={styleId}
              onChange={(e) => setStyleId(e.target.value)}
              className="rounded-lg border border-white/[0.08] bg-surface/80 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-primary/50"
            >
              {designStyles.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <span className="ml-auto text-xs text-ink-mute/60">几何、路径与全景均由三维场景渲染，同源一致</span>
          </div>
          <div className="min-h-0 flex-1">
            {loading ? (
              <Card><CardBody><EmptyState title="加载中…" description="正在读取户型数据" /></CardBody></Card>
            ) : error ? (
              <Card><CardBody><EmptyState title="暂无可漫游户型" description={error} /></CardBody></Card>
            ) : (
              <TourViewer json={json!} styleId={styleId} projectId={params.id} />
            )}
          </div>
        </div>
      </PageContainer>
    </>
  );
}
