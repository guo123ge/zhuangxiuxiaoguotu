import type { Metadata, Viewport } from "next";
import "./globals.css";
import AiAssistant from "@/components/ai/AiAssistantDrawer";

export const metadata: Metadata = {
  title: "AuraDesign VR · 户型三维装修",
  description:
    "上传户型图自动识别房间墙体门窗，生成三维模型与全景入户漫游，参数化调整装修方案。",
  applicationName: "AuraDesign VR",
  openGraph: {
    title: "AuraDesign VR · 户型三维装修",
    description:
      "户型识别 · 三维建模 · 方案设计 · 全景漫游，一体化装修效果工作台。",
    type: "website",
    locale: "zh_CN",
    siteName: "AuraDesign VR",
  },
  // favicon 由 src/app/icon.svg 的 App Router 文件约定自动注入
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d1229",
  colorScheme: "dark",
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
