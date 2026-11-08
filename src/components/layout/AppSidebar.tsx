"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Home,
  ScanLine,
  Box,
  Palette,
  Route,
  Sparkles,
  LogOut,
  Check,
} from "lucide-react";
import type { WorkflowStatus } from "@/lib/enums";
import { WORKFLOW_STEPS } from "@/lib/enums";

const WORKFLOW_NAV = [
  { key: "overview", label: "工作台总览", icon: Home, step: 0 },
  { key: "parse", label: "户型识别", icon: ScanLine, step: 1 },
  { key: "model", label: "三维建模", icon: Box, step: 2 },
  { key: "design", label: "方案设计", icon: Palette, step: 3 },
  { key: "tour", label: "全景漫游", icon: Route, step: 4 },
];

export function AppSidebar({
  projectId,
  workflowStatus,
}: {
  projectId: string;
  workflowStatus: string;
}) {
  const pathname = usePathname();

  const currentStepIndex = (() => {
    const s = workflowStatus as WorkflowStatus;
    for (let i = 0; i < WORKFLOW_STEPS.length; i++) {
      if (WORKFLOW_STEPS[i].statuses.includes(s)) return i;
    }
    return 0;
  })();

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-dvh w-[var(--width-sidebar)] flex-col items-center border-r border-white/5 bg-sidebar py-4">
      {/* 品牌 Logo */}
      <Link
        href="/"
        aria-label="返回项目列表"
        className="group mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-glow-purple transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      >
        <Sparkles size={18} className="text-white" aria-hidden="true" />
      </Link>

      {/* 导航图标 — 垂直排列 */}
      <nav aria-label="工作流导航" className="flex w-full flex-1 flex-col items-center gap-1 px-2">
        {WORKFLOW_NAV.map((item, index) => {
          const href =
            item.key === "overview"
              ? `/projects/${projectId}`
              : `/projects/${projectId}/${item.key}`;
          const active = pathname === href || pathname.startsWith(href + "/");
          const done = item.step < currentStepIndex;
          const current = item.step === currentStepIndex;
          const Icon = item.icon;

          return (
            <Link
              key={item.key}
              href={href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "group relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                active || current
                  ? "bg-white/12 text-white shadow-sm"
                  : done
                    ? "text-secondary/80 hover:bg-white/8 hover:text-secondary"
                    : "text-white/40 hover:bg-white/8 hover:text-white/70",
              )}
            >
              <Icon size={20} strokeWidth={active || current ? 2.2 : 1.8} aria-hidden="true" />

              {/* 激活指示条 */}
              {(active || current) && (
                <span aria-hidden="true" className="absolute -right-2 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-secondary to-primary" />
              )}

              {/* 完成勾 */}
              {done && !active && !current && (
                <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-secondary text-white">
                  <Check size={9} strokeWidth={3} />
                </span>
              )}

              {/* Tooltip：序号由 index 生成，键盘聚焦时也可见 */}
              <span
                role="tooltip"
                className="pointer-events-none absolute left-full z-40 ml-3 whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink opacity-0 shadow-pop transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                {index}. {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* 底部：返回列表 */}
      <div className="mt-2 flex w-full flex-col items-center gap-1 border-t border-white/5 px-2 pt-2">
        <Link
          href="/"
          aria-label="返回项目列表"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white/40 transition-colors hover:bg-white/8 hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <LogOut size={18} aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}

export function TopBar({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/5 bg-sidebar/60 px-4 backdrop-blur-md md:px-8">
      <div className="min-w-0">
        <h1 className="truncate text-[17px] font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 truncate text-[12px] text-ink-mute">{subtitle}</p>
        )}
      </div>
      {children}
      {right && <div className="flex shrink-0 items-center gap-3">{right}</div>}
    </header>
  );
}
