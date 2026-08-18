"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Me = {
  loggedIn: boolean;
  teacher?: {
    id: string;
    name: string;
    schoolStage: string | null;
    subject: string | null;
    grades: string | null;
    role?: string;
    verifyStatus?: string;
  };
};

export function Header() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe({ loggedIn: false }));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe({ loggedIn: false });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-chalk-50/15 bg-board-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="group flex items-center gap-3">
          {/* 粉笔字 Logo */}
          <span className="chalk-text font-chalk flex h-10 w-10 items-center justify-center rounded-md border-2 border-dashed border-chalk-yellow/70 text-xl font-bold text-chalk-yellow">
            青
          </span>
          <span className="flex flex-col leading-tight">
            <span className="chalk-text font-chalk text-lg font-bold tracking-wide text-chalk-50">
              青蓝备课
            </span>
            <span className="text-[10px] tracking-[0.3em] text-chalk-600">
              QINGLAN PREP
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link
            href="/prep/new"
            className="text-chalk-400 transition hover:text-chalk-yellow"
          >
            新建备课
          </Link>
          <Link href="/class" className="text-chalk-400 transition hover:text-chalk-yellow">
            学情记忆
          </Link>
          {me === null ? null : me.loggedIn ? (
            <div className="flex items-center gap-2">
              {me.teacher?.role === "admin" && (
                <Link
                  href="/admin"
                  className="chalk-box-pink rounded-md px-3 py-1 text-xs font-semibold transition hover:bg-chalk-pink/10"
                >
                  管理后台
                </Link>
              )}
              <span
                className="chalk-box-yellow rounded-md px-3 py-1 text-xs font-medium text-chalk-yellow"
                title={
                  me.teacher
                    ? `${me.teacher.schoolStage ?? ""} · ${me.teacher.subject ?? ""} · ${me.teacher.grades ?? ""}`
                    : undefined
                }
              >
                {me.teacher?.name}
              </span>
              {me.teacher?.role !== "admin" && me.teacher?.verifyStatus === "pending" && (
                <span
                  className="chalk-box-orange rounded-md px-2 py-1 text-[10px] text-chalk-orange"
                  title="管理员审核通过后获得认证标识"
                >
                  认证审核中
                </span>
              )}
              {me.teacher?.role !== "admin" && me.teacher?.verifyStatus === "rejected" && (
                <span className="chalk-box-pink rounded-md px-2 py-1 text-[10px] text-chalk-pink">
                  认证被驳回
                </span>
              )}
              {me.teacher?.role !== "admin" && me.teacher?.verifyStatus === "verified" && (
                <span className="chalk-box-green rounded-md px-2 py-1 text-[10px] text-chalk-green">
                  ✓ 已认证
                </span>
              )}
              <button
                onClick={logout}
                className="text-xs text-chalk-600 transition hover:text-chalk-50"
              >
                退出
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="chalk-box-yellow rounded-md bg-chalk-yellow/10 px-3.5 py-1.5 text-xs font-semibold text-chalk-yellow transition hover:bg-chalk-yellow/20"
            >
              登录 / 注册
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
