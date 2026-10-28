import type { Metadata } from "next";
import "./globals.css";
import AiAssistant from "@/components/ai/AiAssistantDrawer";

export const metadata: Metadata = {
  title: "户型图智能分析与三维可视化系统",
  description:
    "上传户型图自动识别房间墙体门窗，生成精确三维模型，参数化调整硬装软装，输出全景入户路径漫游。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-canvas text-ink antialiased">
        {children}
        <AiAssistant />
      </body>
    </html>
  );
}
