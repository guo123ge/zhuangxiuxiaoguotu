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
  FileDown,
  Info,
  Settings,
  LogOut,
} from "lucide-react";
import type { WorkflowStatus } from "@/lib/enums";
import { WORKFLOW_STEPS, WORKFLOW_STATUS } from "@/lib/enums";

const NAV = [
  { key: "overview", label: "项目信息", icon: Info },
  { key: "parse", label: "资源库", icon: ScanLine },
  { key: "model", label: "设置", icon: Settings },
];

const WORKFLOW_NAV = [
  { key: "overview", label: "工作台总览", icon: Home, step: 0 },
  { key: "parse", label: "① 户型识别", icon: ScanLine, step: 1 },
  { key: "model", label: "② 三维建模", icon: Box, step: 2 },
  { key: "design", label: "③ 方案设计", icon: Palette, step: 3 },
  { key: "tour", label: "④ 全景漫游", icon: Route, step: 4 },
];

export function AppSidebar({
  projectId,
  projectTitle,
  workflowStatus,
}: {
  projectId: string;
  projectTitle: string;
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
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-[72px] flex-col items-center bg-sidebar py-4 border-r border-white/5">
      {/* 品牌 Logo */}
      <Link href="/" className="group mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-glow-purple transition-transform hover:scale-105">
        <Sparkles size={18} className="text-white" />
      </Link>

      {/* 导航图标 — 垂直排列 */}
      <nav className="flex w-full flex-1 flex-col items-center gap-1 px-2">
        {WORKFLOW_NAV.map((item) => {
          const href =
            item.key === "overview"
              ? `/projects/${projectId}`
              : `/projects/${projectId}/${item.key}`;
          const active = pathname === href || pathname.startsWith(href + "/");
          const done = item.step !== undefined && item.step < currentStepIndex;
          const current = item.step !== undefined && item.step === currentStepIndex;
          const Icon = item.icon;

          return (
            <Link
              key={item.key}
              href={href}
              title={item.label}
              className={clsx(
                "group relative flex h-11 w-11 items-center justify-center rounded-xl text-[15px] transition-all duration-200",
                active || current
                  ? "bg-white/12 text-white shadow-sm"
                  : done
                    ? "text-secondary/80 hover:bg-white/8 hover:text-secondary"
                    : "text-white/40 hover:bg-white/8 hover:text-white/70",
              )}
            >
              <Icon size={20} strokeWidth={active || current ? 2.2 : 1.8} />

              {/* 激活指示条 */}
              {(active || current) && (
                <span className="absolute -right-2 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-secondary to-primary" />
              )}

              {/* 完成勾 */}
              {done && !active && !current && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-secondary text-[9px] font-bold text-white">
                  ✓
                </span>
              )}

              {/* Tooltip */}
              <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink opacity-0 shadow-pop transition-opacity group-hover:opacity-100 border border-border">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* 底部：返回列表 */}
      <div className="flex w-full flex-col items-center gap-1 px-2 pt-2 border-t border-white/5 mt-2">
        <Link
          href="/"
          title="返回项目列表"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white/40 transition-colors hover:bg-white/8 hover:text-white/70"
        >
          <LogOut size={18} />
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
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/5 bg-sidebar/60 backdrop-blur-md px-8">
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

/** AuraDesign VR 风格的渐变曲线进度步骤条 */
export function AuraStepBar({
  steps,
  current,
}: {
  steps: { key: string; label: string; status?: "done" | "active" | "pending" }[];
  current: number;
}) {
  return (
    <div className="relative flex items-center justify-between px-4 py-6">
      {/* 背景渐变曲线 */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 800 60">
        <defs>
          <linearGradient id="stepGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        {/* 曲线路径 — 贝塞尔连接各步骤点 */}
        <path
          d="M 60 30 Q 180 5, 230 30 T 400 30 T 570 30 T 740 30"
          fill="none"
          stroke="url(#stepGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.35"
        />
      </svg>

      {/* 步骤点 */}
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={step.key} className="relative z-10 flex flex-col items-center gap-2.5">
            {/* 圆点 */}
            <div
              className={clsx(
                "flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-bold transition-all duration-300",
                done && "bg-secondary/90 text-white glow-dot-cyan scale-105",
                active && "bg-gradient-to-br from-primary to-purple-400 text-white glow-dot-purple scale-110 ring-4 ring-primary/25",
                !done && !active && "bg-white/8 text-ink-mute border border-white/10",
              )}
            >
              {done ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                i + 1
              )}
            </div>

            {/* 标签 */}
            <div className="text-center">
              <p
                className={clsx(
                  "text-[12px] font-medium leading-tight whitespace-nowrap",
                  active ? "text-white" : done ? "text-secondary-light" : "text-ink-mute",
                )}
              >
                {step.label.split("\n")[0]}
              </p>
              <p
                className={clsx(
                  "text-[10.5px] mt-0.5",
                  active ? "text-primary-light font-medium" : done ? "text-secondary/70" : "text-ink-mute/60",
                )}
              >
                {step.label.includes("\n") ? step.label.split("\n")[1] : (active ? "进行中" : done ? "已完成" : "待处理")}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
