export function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1440px] px-8 py-6">
      <div className="space-y-5">{children}</div>
    </div>
  );
}

export function SectionGrid({
  children,
  cols = 2,
}: {
  children: React.ReactNode;
  cols?: 1 | 2 | 3;
}) {
  const cls =
    cols === 1
      ? "grid grid-cols-1 gap-5"
      : cols === 2
        ? "grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]"
        : "grid grid-cols-1 gap-5 lg:grid-cols-3";
  return <div className={cls}>{children}</div>;
}
