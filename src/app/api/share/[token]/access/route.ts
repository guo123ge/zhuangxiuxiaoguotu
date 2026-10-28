import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashShareToken, isAccessCodeValid, makeAccessCookie } from "@/lib/client-access";

export const runtime = "nodejs";

/** POST /api/share/[token]/access — 校验访问码并下发 HMAC 签名 cookie */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const body = await req.json().catch(() => ({}));
  const accessCode = (body.accessCode ?? "").toString().trim();

  const tokenHash = hashShareToken(params.token);
  const link = await prisma.clientShareLink.findUnique({ where: { tokenHash } });
  if (!link) return NextResponse.json({ error: "链接无效" }, { status: 404 });

  if (!isAccessCodeValid(accessCode, link.accessCodeHash)) {
    return NextResponse.json({ error: "访问码不正确" }, { status: 401 });
  }

  const cookie = makeAccessCookie(params.token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("fp_access", cookie, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return res;
}
