import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { WORKFLOW_STATUS } from "@/lib/enums";

export const runtime = "nodejs";

/** POST /api/floorplans/[id]/confirm — 人工确认识别结果，进入三维建模 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const asset = await prisma.floorplanAsset.findUnique({ where: { id: params.id } });
  if (!asset) return NextResponse.json({ error: "户型图不存在" }, { status: 404 });
  if (asset.status !== "SUCCEEDED") {
    return NextResponse.json({ error: "请先完成识别" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.floorplanAsset.update({
      where: { id: asset.id },
      data: { reviewStatus: "CONFIRMED" },
    }),
    prisma.detectedRoom.updateMany({
      where: { projectId: asset.projectId },
      data: { isConfirmed: true, needsReview: false },
    }),
    prisma.project.update({
      where: { id: asset.projectId },
      data: { workflowStatus: WORKFLOW_STATUS.CONFIRMED },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
