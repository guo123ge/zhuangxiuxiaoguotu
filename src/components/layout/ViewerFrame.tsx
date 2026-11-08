import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * 三维 / 全景查看器统一外框。
 * 收敛 model / design / tour 三页重复的高度硬编码；使用 dvh 以适配
 * 移动端浏览器动态工具栏，避免 100vh 在手机上被地址栏挤出的留白。
 * 各页通过 className 补充 flex-col / gap-* 等方向性布局。
 */
export function ViewerFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex h-[calc(100dvh-13rem)] min-h-[480px]", className)}>
      {children}
    </div>
  );
}
