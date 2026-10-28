import { NextResponse } from "next/server";
import { testConnection } from "@/lib/ai/client";

export const runtime = "nodejs";

/** POST /api/ai/test — 测试模型连接（校验密钥有效性） */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const modelId = (body.modelId ?? "").toString();
  const apiKey = (body.apiKey ?? "").toString().trim();

  if (!modelId) return NextResponse.json({ error: "缺少模型" }, { status: 400 });
  const result = await testConnection(modelId, apiKey);
  return NextResponse.json(result, { status: result.ok ? 200 : 200 });
}
