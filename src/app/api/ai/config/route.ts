import { NextResponse } from "next/server";
import { AI_MODELS } from "@/lib/ai/models";
import { readConfig, writeConfig } from "@/lib/ai/config";
import { aiStatus } from "@/lib/ai/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/config — 模型清单（含优劣适配度）+ 当前配置（不含明文 key） */
export async function GET() {
  const cfg = await readConfig();
  const configured = new Set(Object.keys(cfg.apiKeys).filter((id) => cfg.apiKeys[id]));
  const status = await aiStatus();
  const models = AI_MODELS.map((m) => ({
    id: m.id,
    name: m.name,
    vendor: m.vendor,
    capabilities: m.capabilities,
    pros: m.pros,
    cons: m.cons,
    fit: m.fit,
    fitScore: m.fitScore,
    hasKey: configured.has(m.id),
  }));
  return NextResponse.json({
    models,
    visionModelId: cfg.visionModelId,
    textModelId: cfg.textModelId,
    status,
  });
}

/** POST /api/ai/config — 保存某个槽位（vision/text）的模型与密钥 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const slot = body.slot === "text" ? "text" : "vision";
  const modelId = (body.modelId ?? "").toString();
  const apiKey = (body.apiKey ?? "").toString().trim();

  if (!AI_MODELS.some((m) => m.id === modelId)) {
    return NextResponse.json({ error: "未知模型" }, { status: 400 });
  }

  const cfg = await writeConfig({
    ...(slot === "vision" ? { visionModelId: modelId } : { textModelId: modelId }),
    apiKeys: apiKey ? { [modelId]: apiKey } : {},
  });
  const configured = Object.keys(cfg.apiKeys).filter((id) => cfg.apiKeys[id]);
  return NextResponse.json({
    ok: true,
    visionModelId: cfg.visionModelId,
    textModelId: cfg.textModelId,
    configuredModelIds: configured,
  });
}
