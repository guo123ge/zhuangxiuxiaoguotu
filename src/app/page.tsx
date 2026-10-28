import { HomeClient } from "@/components/HomeClient";
import { prisma } from "@/lib/db";
import { sampleFloorplans } from "@/lib/samples";
import { WORKFLOW_LABEL } from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { rooms: true, floorplans: true, routes: true } },
    },
  });

  const serialized = projects.map((p) => ({
    id: p.id,
    title: p.title,
    unitNo: p.unitNo,
    clientName: p.clientName,
    status: p.status,
    workflowStatus: p.workflowStatus,
    workflowLabel:
      WORKFLOW_LABEL[p.workflowStatus as keyof typeof WORKFLOW_LABEL] ??
      p.workflowStatus,
    coverUrl: p.coverUrl,
    viewCount: p.viewCount,
    updatedAt: p.updatedAt.toISOString(),
    roomCount: p._count.rooms,
    floorplanCount: p._count.floorplans,
    routeCount: p._count.routes,
  }));

  return <HomeClient projects={serialized} samples={sampleFloorplans} />;
}
