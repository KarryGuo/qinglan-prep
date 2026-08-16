import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "青蓝备课 · 让每一节课，都有备而来",
  description:
    "面向中小学教师的备课 Agent：学情诊断、依标设计、备课包生成、课后反思与学情记忆。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
        <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
          本内容供备课参考，教学决策由教师作出 · 演示用模拟数据，节选整理自公开课标文本
        </footer>
      </body>
    </html>
  );
}
