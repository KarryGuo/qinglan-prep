import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveAdmin } from "@/lib/auth";
import { AdminNav } from "./admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await resolveAdmin();
  if (!admin) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="chalk-back">
            ← 返回首页
          </Link>
          <h1 className="chalk-text font-chalk mt-2 text-3xl font-bold text-chalk-50">
            管理后台
          </h1>
        </div>
        <span className="chalk-box-pink rounded-md px-3 py-1 text-xs font-semibold">
          管理员：{admin.name}
        </span>
      </div>

      <AdminNav />

      <div className="mt-6">{children}</div>
    </main>
  );
}
