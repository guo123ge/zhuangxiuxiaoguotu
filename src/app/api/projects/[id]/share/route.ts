import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { makeShareToken, hashAccessCode } from "@/lib/client-access";

export const runtime = "nodejs";

/** GET /api/projects/[id]/share — 分享链接列表（不含明文 token） */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const links = await prisma.clientShareLink.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      tokenHash: true,
      accessCodeHash: true,
      expiresAt: true,
      revokedAt: true,
      viewCount: true,
      createdAt: true,
    },
  });
  // tokenHash 截断展示即可
  const safe = links.map((l) => ({
    ...l,
    accessCodeHash: undefined,
    shortToken: l.tokenHash.slice(0, 12) + "…",
    hasAccessCode: Boolean(l.accessCodeHash),
  }));
  return NextResponse.json({ links: safe });
}

/** POST /api/projects/[id]/share — 创建分享链接，返回一次性明文 token + 访问码 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const accessCode = (body.accessCode ?? "").toString().trim();
  const expiresInDays = Number(body.expiresInDays) || 0;

  const { token, hash } = makeShareToken();
  const link = await prisma.clientShareLink.create({
    data: {
      projectId: params.id,
      tokenHash: hash,
      accessCodeHash: accessCode ? hashAccessCode(accessCode) : null,
      expiresAt: expiresInDays > 0 ? new Date(Date.now() + expiresInDays * 86400_000) : null,
    },
  });

  // 明文 token 只在创建时返回一次
  const origin = req.headers.get("origin") || "";
  return NextResponse.json(
    {
      id: link.id,
      token,
      accessCode: accessCode || null,
      url: `${origin}/share/${token}`,
    },
    { status: 201 },
  );
}
