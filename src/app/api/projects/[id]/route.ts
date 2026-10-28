import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

type Ctx = { params: { id: string } };

export async function GET(_request: Request, { params }: Ctx) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      floorplans: { orderBy: { createdAt: "desc" } },
      rooms: { orderBy: { order: "asc" } },
      walls: { orderBy: { order: "asc" } },
      openings: { orderBy: { order: "asc" } },
      schemes: { orderBy: { order: "asc" } },
      routes: { orderBy: { createdAt: "desc" } },
      _count: { select: { elements: true } },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "项目不存在。" }, { status: 404 });
  }
  return NextResponse.json({ project });
}

const patchSchema = z.object({
  title: z.string().min(1).max(80).optional(),
  unitNo: z.string().max(40).optional(),
  clientName: z.string().max(40).optional(),
  brandName: z.string().max(40).optional(),
  address: z.string().max(120).optional(),
  designer: z.string().max(40).optional(),
  floorHeightMm: z.number().int().min(2200).max(4000).optional(),
  designBrief: z.string().max(2000).optional(),
  workflowStatus: z.string().optional(),
  status: z.string().optional(),
  coverUrl: z.string().optional(),
  selectedStyleId: z.string().nullable().optional(),
  selectedSchemeId: z.string().nullable().optional(),
});

export async function PATCH(request: Request, { params }: Ctx) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON。" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "参数不合法" },
      { status: 400 },
    );
  }
  try {
    const project = await prisma.project.update({
      where: { id: params.id },
      data: parsed.data,
    });
    return NextResponse.json({ project });
  } catch {
    return NextResponse.json({ error: "项目不存在。" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    await prisma.project.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "项目不存在。" }, { status: 404 });
  }
}
