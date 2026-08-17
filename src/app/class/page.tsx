import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { resolveTeacherId } from "@/lib/auth";
import { ClassListClient } from "./class-list-client";

export const dynamic = "force-dynamic";

export default async function ClassListPage() {
  const teacherId = await resolveTeacherId();

  if (!teacherId) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-chalk-400">
        请先 <Link href="/login" className="chalk-yellow underline">登录</Link> 后管理班级。
      </main>
    );
  }

  const memories = await prisma.classMemory.findMany({
    where: { teacherId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { lessons: true } },
    },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/" className="chalk-back">
        ← 返回首页
      </Link>
      <h1 className="chalk-text font-chalk mt-3 text-3xl font-bold text-chalk-50">我的班级</h1>
      <p className="mt-2 text-sm text-chalk-400">
        每个班级有独立的学情记忆，备课时选择对应班级即可带入其画像。
      </p>

      <ClassListClient />

      <section className="mt-6">
        {memories.length === 0 ? (
          <p className="chalk-box bg-board-950/40 p-6 text-sm text-chalk-400">
            还没有班级，先在上方新建一个。
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {memories.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/class/${m.id}`}
                  className="chalk-panel block p-5 transition hover:border-chalk-yellow/50"
                >
                  <p className="chalk-blue font-chalk font-semibold">{m.className}</p>
                  <p className="mt-1 text-xs text-chalk-500">
                    {m._count.lessons} 节课 · 更新于{" "}
                    {new Date(m.updatedAt).toLocaleDateString("zh-CN")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
