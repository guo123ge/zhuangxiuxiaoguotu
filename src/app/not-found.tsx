import Link from "next/link";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface/80 p-8 text-center shadow-card">
        <p aria-hidden="true" className="text-4xl font-bold tracking-tight text-primary-light">404</p>
        <h1 className="mt-3 text-subtitle font-semibold text-ink">页面不存在</h1>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          该页面可能已被删除，或项目链接已失效。
        </p>
        <Link href="/" className="mt-6 inline-block">
          <Button>返回项目列表</Button>
        </Link>
      </div>
    </div>
  );
}
