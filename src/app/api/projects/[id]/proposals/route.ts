import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { proposePatch } from "@/lib/ai/propose";
import { aiStatus } from "@/lib/ai/client";

export const runtime = "nodejs";

/** GET /api/projects/[id]/proposals — 提案列表 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const proposals = await prisma.aiChangeProposal.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ proposals });
}

/** POST /api/projects/[id]/proposals — 自然语言 → AI 变更提案 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const prompt = (body.prompt ?? "").toString().trim();
  if (!prompt) return NextResponse.json({ error: "请描述变更诉求" }, { status: 400 });

  const status = await aiStatus();
  if (!status.available) {
    return NextResponse.json(
      { error: "未配置 AI 密钥，无法生成 AI 提案。请在右侧 AI 助手中配置模型与密钥。" },
      { status: 400 },
    );
  }

  const rooms = await prisma.detectedRoom.findMany({
    where: { projectId: params.id },
    select: { id: true, name: true, roomType: true, areaM2: true },
  });

  const patch = await proposePatch(rooms, prompt);
  if (!patch) {
    return NextResponse.json({ error: "AI 生成提案失败，请重试或检查密钥额度" }, { status: 502 });
  }

  const beforeJson = await getPrimaryOverlay(params.id);
  const afterOverlay = { ...beforeJson, ...patch.overlay };
  const proposal = await prisma.aiChangeProposal.create({
    data: {
      projectId: params.id,
      prompt,
      patchJson: JSON.stringify(patch.overlay),
      affectedRoomIdsJson: JSON.stringify(Object.keys(patch.overlay)),
      beforeJson: JSON.stringify(beforeJson),
      afterJson: JSON.stringify(afterOverlay),
      status: "PROPOSED",
    },
  });
  return NextResponse.json({ proposal, summary: patch.summary }, { status: 201 });
}

async function getPrimaryOverlay(projectId: string): Promise<Record<string, unknown>> {
  const primary = await prisma.designScheme.findFirst({
    where: { projectId, isPrimary: true },
  });
  if (!primary) return {};
  try { return JSON.parse(primary.overlayJson || "{}"); } catch { return {}; }
}
