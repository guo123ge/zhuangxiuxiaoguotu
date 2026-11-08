"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface/80 p-8 text-center shadow-card">
        <div aria-hidden="true" className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger/15 text-on-danger">
          <AlertTriangle size={22} />
        </div>
        <h1 className="text-subtitle font-semibold text-ink">页面加载失败</h1>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          发生了意外错误，请重试。若持续出现，可返回项目列表重新进入。
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-ink-mute">错误编号：{error.digest}</p>
        )}
        <Button className="mt-6" onClick={reset}>重新加载</Button>
      </div>
    </div>
  );
}
