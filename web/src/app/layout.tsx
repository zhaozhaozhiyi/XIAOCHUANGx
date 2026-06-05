import type { Metadata } from "next";
import { Geist, Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const notoSerif = Noto_Serif_SC({
  variable: "--font-noto-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "小窗",
  description: "小窗智能研究助手",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={`${geist.variable} ${notoSerif.variable} h-full`}>
      <body className="flex h-full flex-col antialiased">
        {/* 桌面壳标题栏：仅 Windows / Linux 渲染；mac/浏览器 return null
            放在 root layout 让登录页 + 主应用统一吃 36px，避免登录态窗口顶部空白 */}
        <DesktopTitleBar />
        {/* DesktopTitleBar 占 36px，剩余空间分配给 children；
            min-h-0 让 children 内部的 overflow:hidden 真的会裁剪而不撑破父级 */}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
