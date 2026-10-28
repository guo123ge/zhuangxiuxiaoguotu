import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  hashShareToken,
  isShareLinkActive,
  isAccessCodeValid,
  isAccessCookieValid,
} from "@/lib/client-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 从分享链接读取只读视图数据（不含 prompt / 成本等敏感字段） */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const tokenHash = hashShareToken(params.token);
  const link = await prisma.clientShareLink.findUnique({
    where: { tokenHash },
    include: { project: true },
  });
  if (!link || !isShareLinkActive(link)) {
    return NextResponse.json({ error: "链接无效或已失效" }, { status: 404 });
  }

  // 访问码校验：设了访问码且未通过 cookie
  if (link.accessCodeHash && !isAccessCookieValid(params.token, req.headers.get("cookie")?.match(/(?:^|;\s*)fp_access=([^;]+)/)?.[1])) {
    return NextResponse.json({ locked: true, projectTitle: link.project.title });
  }

  // 读取已确认户型解析结果（只读）
  const asset = await prisma.floorplanAsset.findFirst({
    where: { projectId: link.projectId, status: "SUCCEEDED" },
    orderBy: { createdAt: "desc" },
  });
  const schemes = await prisma.designScheme.findMany({
    where: { projectId: link.projectId },
    orderBy: { order: "asc" },
    select: { id: true, name: true, styleId: true, isPrimary: true, overlayJson: true },
  });

  await prisma.clientShareLink.update({
    where: { id: link.id },
    data: { viewCount: { increment: 1 } },
  });

  return NextResponse.json({
    project: {
      id: link.project.id,
      title: link.project.title,
      unitNo: link.project.unitNo,
      clientName: link.project.clientName,
      designer: link.project.designer,
    },
    floorplan: asset ? JSON.parse(asset.parseJson) : null,
    schemes,
  });
}
