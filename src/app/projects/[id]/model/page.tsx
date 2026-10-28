"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/AppSidebar";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardBody, EmptyState, Badge } from "@/components/ui";
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
    (async () => {
      try {
        const res = await fetch(`/api/projects/${params.id}/floorplans`);
        const data = await res.json();
        const assets: AssetLite[] = data.assets ?? [];
        // 优先已确认，其次最新识别成功
        const picked =
          assets.find((a) => a.reviewStatus === "CONFIRMED" && a.status === "SUCCEEDED") ??
          [...assets].reverse().find((a) => a.status === "SUCCEEDED");
        if (!picked) {
          setError("尚未有识别成功的户型图，请先在「识别与确认」页完成解析。");
          return;
        }
        const parsed = JSON.parse(picked.parseJson) as FloorplanJson;
        if (!parsed.rooms || parsed.rooms.length === 0) {
          setError("该户型图尚未包含房间数据，请先运行识别。");
          return;
        }
        setAssetName(picked.originalName);
        setJson(parsed);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  return (
    <>
      <TopBar title="② 三维建模" subtitle="基于确认后的识别结果生成精确三维模型，可切换 16 套装修风格" />
      <PageContainer>
        <div className="flex h-[calc(100vh-13rem)] min-h-[480px] flex-col">
          {loading ? (
            <Card>
              <CardBody>
                <EmptyState title="加载中…" description="正在读取户型数据" />
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
              <div className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-2 text-xs text-ink-mute">
                <Badge tone="success">已生成</Badge>
                <span>{assetName}</span>
                <span className="ml-auto">
                  比例 {json?.mmPerPx.toFixed(2)}mm/px（{json?.scaleSource}）· 比例置信度{" "}
                  {Math.round((json?.scaleConfidence ?? 0) * 100)}%
                </span>
              </div>
              <div className="min-h-0 flex-1">
                <ModelViewer json={json} />
              </div>
            </Card>
          )}
        </div>
      </PageContainer>
    </>
  );
}
