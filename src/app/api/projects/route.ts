import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { WORKFLOW_STATUS, PAGE_KIND } from "@/lib/enums";
import { sampleFloorplans } from "@/lib/samples";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { rooms: true, floorplans: true, routes: true } },
    },
  });
  return NextResponse.json({ projects });
}

const createSchema = z.object({
  title: z.string().min(1, "项目名称不能为空").max(80),
  unitNo: z.string().max(40).optional().default(""),
  clientName: z.string().max(40).optional().default(""),
  brandName: z.string().max(40).optional().default("全景装修"),
  address: z.string().max(120).optional().default(""),
  designer: z.string().max(40).optional().default(""),
  floorHeightMm: z.number().int().min(2200).max(4000).optional().default(2800),
  /** 从内置标准户型图库创建时传入样例 id */
  sampleFloorplanId: z.string().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON。" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "参数不合法",
      },
      { status: 400 },
    );
  }

  const { sampleFloorplanId, ...projectData } = parsed.data;

  const sample = sampleFloorplanId
    ? sampleFloorplans.find((s) => s.id === sampleFloorplanId)
    : undefined;

  const project = await prisma.project.create({
    data: {
      ...projectData,
      workflowStatus: sample
        ? WORKFLOW_STATUS.FLOORPLAN_UPLOADED
        : WORKFLOW_STATUS.CREATED,
      // 从样例创建时，后续识别可对照验证
      floorplans: sample
        ? {
            create: {
              fileType: "IMAGE",
              pageKind: PAGE_KIND.BLUEPRINT,
              originalName: `${sample.name}（标准户型图）`,
              fileUrl: sample.fileUrl,
              previewUrl: sample.previewUrl,
              width: sample.width,
              height: sample.height,
              size: 0,
              status: "UPLOADED",
              reviewStatus: "PENDING",
            },
          }
        : undefined,
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
