import clsx from "clsx";
import { Fragment } from "react";
import type {
  ButtonHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Info,
  Loader2,
  XCircle,
} from "lucide-react";

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
      {right && <div className="min-w-0 shrink-0">{right}</div>}
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
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
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
  success: "bg-success/15 text-on-success border border-success/20",
  warning: "bg-warning/15 text-on-warning border border-warning/20",
  danger: "bg-danger/15 text-on-danger border border-danger/20",
  info: "bg-secondary/15 text-on-info border border-secondary/20",
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
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-secondary",
  }[tone];
  return (
    <span
      aria-hidden="true"
      className={clsx("inline-block h-2 w-2 rounded-full", color)}
    />
  );
}

/* ============ 加载指示 ============ */

export function Spinner({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Loader2
      className={clsx("h-4 w-4 shrink-0 animate-spin", className)}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={clsx("animate-pulse rounded-lg bg-white/6", className)}
    />
  );
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
      <div aria-hidden="true" className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5">
        <BoxGlyph />
      </div>
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-md text-[13px] text-ink-soft">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function BoxGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="text-ink-mute">
      <path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Z" />
      <path d="M3 7.5 12 12l9-4.5M12 12v9" />
    </svg>
  );
}

/* ============ 提示条 — 深色半透明（全站统一通知样式） ============ */

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const cls = {
    info: "border-secondary/25 bg-secondary/8 text-on-info",
    warning: "border-warning/25 bg-warning/8 text-on-warning",
    danger: "border-danger/25 bg-danger/8 text-on-danger",
    success: "border-success/25 bg-success/8 text-on-success",
  }[tone];

  const iconColor = {
    info: "text-secondary",
    warning: "text-warning",
    danger: "text-danger",
    success: "text-success",
  }[tone];

  const Icon = {
    info: Info,
    warning: AlertTriangle,
    danger: XCircle,
    success: CheckCircle2,
  }[tone];

  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={clsx(
        "flex gap-2.5 rounded-xl border px-4 py-3 text-[13px] leading-5 backdrop-blur-sm",
        cls,
        className,
      )}
    >
      <Icon size={16} className={clsx("mt-0.5 shrink-0", iconColor)} aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-1 opacity-90" : ""}>{children}</div>}
      </div>
    </div>
  );
}

/** 通知条的语义别名：各页面统一使用 Notice，避免多套内联提示样式。 */
export const Notice = Alert;

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
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={total}
      className="h-1.5 w-full overflow-hidden rounded-full bg-white/6"
    >
      <div
        className="h-full rounded-full gradient-line transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ============ 步骤进度条 — 由 flex 连接线对齐圆点中心 ============ */

export function StepBar({
  steps,
  current,
}: {
  steps: { key: string; label: string }[];
  current: number;
}) {
  return (
    <div className="flex items-start px-2 py-5">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <Fragment key={step.key}>
            {i > 0 && (
              <div aria-hidden="true" className="mt-4 h-px flex-1 gradient-line opacity-30" />
            )}
            <div className="flex shrink-0 flex-col items-center gap-1.5 px-2">
              <div
                className={clsx(
                  "flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold transition-all duration-300",
                  done && "bg-secondary/90 text-white glow-dot-cyan",
                  active && "bg-gradient-to-br from-primary to-purple-400 text-white glow-dot-purple scale-110 ring-2 ring-primary/30",
                  !done && !active && "bg-white/6 text-ink-mute border border-white/10",
                )}
              >
                {done ? <Check size={15} strokeWidth={2.6} aria-hidden="true" /> : i + 1}
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
          </Fragment>
        );
      })}
    </div>
  );
}

/* ============ 字段与表单控件 ============ */

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
  "h-10 w-full rounded-lg border border-white/[0.08] bg-surface/80 px-3.5 text-[13.5px] text-ink outline-none transition-all placeholder:text-ink-mute focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/45";

export const selectCls =
  "h-10 w-full rounded-lg border border-white/[0.08] bg-surface/80 px-3.5 text-[13.5px] text-ink outline-none transition-all focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/45";

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(selectCls, className)} {...props}>
      {children}
    </select>
  );
}
