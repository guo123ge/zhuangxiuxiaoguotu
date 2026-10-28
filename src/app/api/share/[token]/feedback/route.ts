import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashShareToken, isAccessCookieValid, isShareLinkActive } from "@/lib/client-access";

export const runtime = "nodejs";

/** POST /api/share/[token]/feedback — 客户提交反馈/确认 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const tokenHash = hashShareToken(params.token);
  const link = await prisma.clientShareLink.findUnique({ where: { tokenHash } });
  if (!link || !isShareLinkActive(link)) {
    return NextResponse.json({ error: "链接无效" }, { status: 404 });
  }
  if (link.accessCodeHash && !isAccessCookieValid(params.token, req.headers.get("cookie")?.match(/(?:^|;\s*)fp_access=([^;]+)/)?.[1])) {
    return NextResponse.json({ error: "请先验证访问码" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const content = (body.content ?? "").toString().trim();
  const type = (body.type ?? "NEED_CHANGE").toString();
  const decision = (body.decision ?? "").toString();
  const clientName = (body.clientName ?? "").toString().slice(0, 60);
  const clientContact = (body.clientContact ?? "").toString().slice(0, 60);
  if (!content && !decision) {
    return NextResponse.json({ error: "请填写反馈内容或确认决定" }, { status: 400 });
  }

  const result: Record<string, unknown> = { ok: true };

  if (content) {
    await prisma.clientFeedback.create({
      data: {
        projectId: link.projectId,
        shareLinkId: link.id,
        roomId: (body.roomId ?? null) as string | null,
        type,
        content,
      },
    });
  }
  if (decision && ["APPROVED", "NEED_CHANGE", "UNDECIDED"].includes(decision)) {
    await prisma.clientApproval.create({
      data: {
        projectId: link.projectId,
        shareLinkId: link.id,
        scope: (body.scope ?? "ALL").toString(),
        roomId: (body.roomId ?? null) as string | null,
        decision,
        clientName,
        clientContact,
      },
    });
    result.decision = decision;
  }

  return NextResponse.json(result, { status: 201 });
}
