"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/AppSidebar";
import { PageContainer } from "@/components/layout/PageContainer";
import { ViewerFrame } from "@/components/layout/ViewerFrame";
import { Card, CardBody, EmptyState, Badge, Spinner } from "@/components/ui";
import ModelViewer from "@/components/model3d/ModelViewer";
import type { FloorplanJson } from "@/lib/parse/pipeline";

type AssetLite = {
  id: string;
  status: string;
  reviewStatus: string;
  parseJson: string;
  originalName: string;
};

export default function ModelPage() {
  const params = useParams<{ id: string }>();
  const [json, setJson] = useState<FloorplanJson | null>(null);
  const [loading, setLoading] = useState(true);
  const [assetName, setAssetName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${params.id}/floorplans`);
        if (!res.ok) throw new Error(`读取户型数据失败（${res.status}）`);
        const data = await res.json();
        const assets: AssetLite[] = data.assets ?? [];
        // 优先已确认，其次最新识别成功
        const picked =
          assets.find((a) => a.reviewStatus === "CONFIRMED" && a.status === "SUCCEEDED") ??
          [...assets].reverse().find((a) => a.status === "SUCCEEDED");
        if (!picked) {
          setError("尚未有识别成功的户型图，请先在「户型识别」页完成解析。");
          return;
        }
        const parsed = JSON.parse(picked.parseJson) as FloorplanJson;
        if (!parsed.rooms || parsed.rooms.length === 0) {
          setError("该户型图尚未包含房间数据，请先运行识别。");
          return;
        }
        if (cancelled) return;
        setAssetName(picked.originalName);
        setJson(parsed);
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
      <TopBar title="三维建模" subtitle="基于识别结果生成三维模型，可切换 16 套装修风格" />
      <PageContainer>
        <ViewerFrame className="flex-col">
          {loading ? (
            <Card>
              <CardBody>
                <div className="flex items-center justify-center gap-2 py-14 text-sm text-ink-soft">
                  <Spinner label="加载中" />
                  正在读取户型数据
                </div>
              </CardBody>
            </Card>
          ) : error ? (
            <Card>
              <CardBody>
                <EmptyState title="暂无可建模的户型" description={error} />
              </CardBody>
            </Card>
          ) : (
            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="relative flex items-center gap-2 border-b border-white/[0.05] px-4 py-2 text-xs text-ink-mute">
                <Badge tone="success">已生成</Badge>
                <span className="truncate">{assetName}</span>
                {/* 技术参数收进折叠区，默认不暴露给客户视角 */}
                <details className="group ml-auto shrink-0">
                  <summary className="cursor-pointer list-none text-ink-mute transition-colors hover:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
                    模型信息
                  </summary>
                  <div className="absolute right-4 z-10 mt-2 whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-2 text-ink-soft shadow-pop">
                    比例 {json?.mmPerPx.toFixed(2)} mm/px（{json?.scaleSource}）· 置信度{" "}
                    {Math.round((json?.scaleConfidence ?? 0) * 100)}%
                  </div>
                </details>
              </div>
              <div className="min-h-0 flex-1">
                <ModelViewer json={json} />
              </div>
            </Card>
          )}
        </ViewerFrame>
      </PageContainer>
    </>
  );
}
