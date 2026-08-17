import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTeacherId } from "@/lib/auth";

export const dynamic = "force-dynamic";

type WeakPoint = {
  name: string;
  severity: number;
  evidence: string;
  updatedAt?: string;
};

const SEVERITY_CLS: Record<number, string> = {
  1: "chalk-yellow",
  2: "chalk-orange",
  3: "chalk-pink",
};

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teacherId = await resolveTeacherId();

  const memory = await prisma.classMemory.findUnique({
    where: { id },
    include: {
      lessons: {
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, status: true, createdAt: true, reflectionJson: true },
      },
    },
  });

  if (!memory || (teacherId && memory.teacherId !== teacherId)) {
    notFound();
  }

  const profile = memory.profile as {
    weakPoints?: WeakPoint[];
    resolved?: ({ name: string; resolvedAt?: string } | string)[];
  };
  const weakPoints = profile.weakPoints ?? [];
  const resolved = (profile.resolved ?? []).map((r) =>
    typeof r === "string" ? { name: r } : r
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/class" className="chalk-back">
        ← 返回我的班级
      </Link>
      <h1 className="chalk-text font-chalk mt-3 text-3xl font-bold text-chalk-50">
        学情记忆 · {memory.className}
      </h1>
      <p className="mt-2 text-sm text-chalk-400">
        班级级持久画像，随每次课后反思增量更新。演示用模拟数据，节选整理自公开课标文本。
      </p>

      <section className="chalk-panel mt-6 p-6">
        <h2 className="chalk-yellow font-chalk text-base font-bold">弱点清单</h2>
        {weakPoints.length === 0 ? (
          <p className="mt-2 text-sm text-chalk-400">当前无未解决弱点。</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {weakPoints.map((w) => (
              <li key={w.name} className="rounded-lg bg-board-950/50 p-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-chalk-50">{w.name}</span>
                  <span
                    className={SEVERITY_CLS[w.severity] ?? "chalk-yellow"}
                    title={`严重度 ${w.severity}/3`}
                  >
                    {"★".repeat(w.severity)}
                    {"☆".repeat(3 - w.severity)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-chalk-300">{w.evidence}</p>
                {w.updatedAt && (
                  <p className="mt-1 text-xs text-chalk-500">
                    最近更新：{new Date(w.updatedAt).toLocaleString("zh-CN")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        {resolved.length > 0 && (
          <div className="mt-4">
            <h3 className="chalk-green text-sm font-semibold">已解决弱点</h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {resolved.map((r, i) => (
                <li
                  key={i}
                  className="chalk-green rounded-full border border-chalk-green/40 bg-chalk-green/10 px-3 py-1 text-xs"
                >
                  ✓ {r.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="chalk-panel mt-6 p-6">
        <h2 className="chalk-yellow font-chalk text-base font-bold">历史课</h2>
        {memory.lessons.length === 0 ? (
          <p className="mt-2 text-sm text-chalk-400">还没有备过课。</p>
        ) : (
          <ul className="mt-3 divide-y divide-chalk-50/10">
            {memory.lessons.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <Link
                    href={`/prep/${l.id}`}
                    className="font-medium text-chalk-100 hover:text-chalk-yellow"
                  >
                    《{l.title}》
                  </Link>
                  <span className="ml-2 text-xs text-chalk-500">
                    {new Date(l.createdAt).toLocaleDateString("zh-CN")}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-chalk-500">{l.status}</span>
                  {l.reflectionJson && (
                    <Link
                      href={`/prep/${l.id}/reflect`}
                      className="chalk-green text-xs underline"
                    >
                      反思摘要
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
