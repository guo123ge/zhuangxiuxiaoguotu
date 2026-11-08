export function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[var(--container-8xl)] px-4 py-6 md:px-8">
      <div className="space-y-5">{children}</div>
    </div>
  );
}
