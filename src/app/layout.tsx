import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";

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
      <body className="board-surface board-smudge min-h-screen text-chalk-50 antialiased">
        <Header />
        {children}
        <footer className="relative z-10 border-t border-chalk-50/15 py-6 text-center">
          <p className="font-chalk text-sm tracking-[0.35em] text-chalk-400">
            青，取之于蓝，而青于蓝
          </p>
          <p className="mt-2 text-xs text-chalk-600">
            本内容供备课参考，教学决策由教师作出 · 演示用模拟数据，节选整理自公开课标文本
          </p>
        </footer>
      </body>
    </html>
  );
}
