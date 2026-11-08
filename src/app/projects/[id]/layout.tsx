import { notFound } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, workflowStatus: true },
  });
  if (!project) notFound();

  return (
    <div className="min-h-screen bg-canvas">
      <AppSidebar projectId={project.id} workflowStatus={project.workflowStatus} />
      <main className="ml-[var(--width-sidebar)] min-h-screen">{children}</main>
    </div>
  );
}
