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
    select: { id: true, title: true, workflowStatus: true },
  });
  if (!project) notFound();

  return (
    <div className="min-h-screen bg-canvas">
      <AppSidebar
        projectId={project.id}
        projectTitle={project.title}
        workflowStatus={project.workflowStatus}
      />
      <main className="ml-[72px] min-h-screen">{children}</main>
    </div>
  );
}
