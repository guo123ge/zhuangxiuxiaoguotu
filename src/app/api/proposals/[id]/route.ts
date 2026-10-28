import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * PATCH /api/proposals/[id] — 应用（APPLIED）或拒绝（REJECTED）提案。
 * 应用时把 patchJson 合并进主方案 overlayJson。
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const action: string = body.action ?? "APPLY";

  const proposal = await prisma.aiChangeProposal.findUnique({ where: { id: params.id } });
  if (!proposal) return NextResponse.json({ error: "提案不存在" }, { status: 404 });

  if (action === "APPLY") {
    // 合并到主方案
    const primary = await prisma.designScheme.findFirst({
      where: { projectId: proposal.projectId, isPrimary: true },
    });
    if (primary) {
      let overlay: Record<string, unknown> = {};
      try { overlay = JSON.parse(primary.overlayJson || "{}"); } catch { /* ignore */ }
      let patch: Record<string, unknown> = {};
      try { patch = JSON.parse(proposal.patchJson || "{}"); } catch { /* ignore */ }
      const merged = { ...overlay, ...patch };
      await prisma.designScheme.update({
        where: { id: primary.id },
        data: { overlayJson: JSON.stringify(merged) },
      });
    }
    await prisma.aiChangeProposal.update({
      where: { id: params.id },
      data: { status: "APPLIED", appliedAt: new Date() },
    });
    return NextResponse.json({ ok: true, status: "APPLIED" });
  }

  await prisma.aiChangeProposal.update({
    where: { id: params.id },
    data: { status: action === "UNDO" ? "UNDONE" : "REJECTED" },
  });
  return NextResponse.json({ ok: true, status: action === "UNDO" ? "UNDONE" : "REJECTED" });
}
