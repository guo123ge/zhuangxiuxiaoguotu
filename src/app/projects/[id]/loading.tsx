import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[var(--container-8xl)] space-y-5">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    </div>
  );
}
