import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/* ============ 卡片 — 玻璃拟态深色 ============ */

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-white/[0.06] bg-surface/80 backdrop-blur-sm shadow-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] px-5 py-4">
      <div className="min-w-0">
        <h3 className="text-[14px] font-semibold tracking-wide text-ink">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-[12px] text-ink-mute">{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={clsx("px-5 py-4", className)}>{children}</div>;
}

/* ============ 按钮 ============ */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "cyan";
  size?: "sm" | "md";
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "active:scale-[0.97]",
        size === "sm"
          ? "h-8 px-3 text-[12.5px]"
          : "h-10 px-4.5 text-[13.5px]",
        variant === "primary" &&
          "bg-gradient-to-r from-primary to-purple-500 text-white shadow-glow-purple hover:shadow-lg hover:brightness-110 disabled:hover:brightness-100",
        variant === "secondary" &&
          "border border-border bg-surface text-ink hover:bg-surface-hi hover:border-border-hover",
        variant === "ghost" && "text-ink-soft hover:bg-white/6 hover:text-ink",
        variant === "danger" && "bg-danger/90 text-white hover:bg-danger shadow-sm",
        variant === "cyan" &&
          "bg-gradient-to-r from-secondary to-cyan-400 text-white shadow-glow-cyan hover:shadow-lg hover:brightness-110",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ============ 徽标 ============ */

const BADGE_TONE = {
  neutral: "bg-white/8 text-ink-soft border border-white/[0.06]",
  primary: "bg-primary/15 text-primary-light border border-primary/20",
  success: "bg-secondary/15 text-secondary-light border border-secondary/20",
  warning: "bg-warning/15 text-yellow-300 border border-warning/20",
  danger: "bg-danger/15 text-red-300 border border-danger/20",
  info: "bg-secondary/15 text-cyan-300 border border-secondary/20",
} as const;

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_TONE;
}) {
  return (
    <span
      className={clsx(
        "inline-flex h-6 items-center rounded-full px-2.5 text-[11.5px] font-medium",
        BADGE_TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

/* ============ 状态点 ============ */

export function StatusDot({ tone }: { tone: keyof typeof BADGE_TONE }) {
  const color = {
    neutral: "bg-ink-mute",
    primary: "bg-primary",
    success: "bg-secondary",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-secondary",
  }[tone];
  return <span className={clsx("inline-block h-2 w-2 rounded-full", color)} />;
}

/* ============ 空态 ============ */

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-surface/50 px-6 py-14 text-center">
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-md text-[13px] text-ink-mute">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ============ 提示条 — 深色半透明 ============ */

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: string;
  children?: ReactNode;
}) {
  const cls = {
    info: "border-secondary/25 bg-secondary/8 text-cyan-200",
    warning: "border-warning/25 bg-warning/8 text-yellow-200",
    danger: "border-danger/25 bg-danger/8 text-red-200",
    success: "border-success/25 bg-success/8 text-emerald-200",
  }[tone];

  const iconColor = {
    info: "text-secondary",
    warning: "text-warning",
    danger: "text-danger",
    success: "text-success",
  }[tone];

  return (
    <div
      className={clsx(
        "rounded-xl border px-4 py-3 text-[13px] leading-5 backdrop-blur-sm",
        cls,
      )}
    >
      {title && <p className="font-semibold flex items-center gap-2"><span className={iconColor}>●</span>{title}</p>}
      {children && <div className={title ? "mt-1 opacity-85" : ""}>{children}</div>}
    </div>
  );
}

/* ============ 进度条 ============ */

export function ProgressBar({
  value,
  total,
}: {
  value: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/6">
      <div
        className="h-full rounded-full gradient-line transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ============ 步骤进度条 — AuraDesign VR 风格（兼容旧接口） ============ */

export function StepBar({
  steps,
  current,
}: {
  steps: { key: string; label: string }[];
  current: number;
}) {
  return (
    <div className="relative flex items-center justify-between px-2 py-5 overflow-visible">
      {/* 渐变连接线 */}
      <div className="absolute top-7 left-8 right-8 h-px gradient-line opacity-30" />

      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={step.key} className="relative z-10 flex flex-col items-center gap-1.5">
            <div
              className={clsx(
                "flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold transition-all duration-300",
                done && "bg-secondary/90 text-white glow-dot-cyan",
                active && "bg-gradient-to-br from-primary to-purple-400 text-white glow-dot-purple scale-110 ring-2 ring-primary/30",
                !done && !active && "bg-white/6 text-ink-mute border border-white/10",
              )}
            >
              {done ? "✓" : i + 1}
            </div>
            <span
              className={clsx(
                "text-[11.5px] font-medium text-center leading-tight max-w-[80px]",
                active ? "text-white" : done ? "text-secondary-light" : "text-ink-mute",
              )}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ============ 字段 ============ */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-mute">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-ink-mute/70">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "h-10 w-full rounded-lg border border-white/[0.08] bg-surface/80 backdrop-blur-sm px-3.5 text-[13.5px] text-ink outline-none transition-all placeholder:text-ink-mute focus:border-primary/50 focus:ring-1 focus:ring-primary/25";

export const selectCls =
  "h-10 w-full rounded-lg border border-white/[0.08] bg-surface/80 backdrop-blur-sm px-3.5 text-[13.5px] text-ink outline-none transition-all focus:border-primary/50 focus:ring-1 focus:ring-primary/25";
