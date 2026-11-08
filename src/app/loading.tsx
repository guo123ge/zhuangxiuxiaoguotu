import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="min-h-screen bg-canvas px-4 py-10 md:px-8">
      <div className="mx-auto max-w-[var(--container-8xl)] space-y-5">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
          <div className="space-y-5">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}
