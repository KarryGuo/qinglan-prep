import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type WeakPoint = {
  name: string;
  severity: number;
  evidence: string;
  updatedAt?: string;
};

export default async function ClassPage() {
  const memory = await prisma.classMemory.findFirst({
    orderBy: { updatedAt: "desc" },
    include: {
      lessons: {
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, status: true, createdAt: true, reflectionJson: true },
      },
    },
  });

  if (!memory) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-slate-500">
        暂无班级记忆数据。
      </main>
    );
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
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
        ← 返回首页
      </Link>
      <h1 className="mt-3 text-2xl font-bold">学情记忆 · {memory.className}</h1>
      <p className="mt-1 text-sm text-slate-500">
        班级级持久画像，随每次课后反思增量更新。演示用模拟数据，节选整理自公开课标文本。
      </p>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold">弱点了表</h2>
        {weakPoints.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">当前无未解决弱点。</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {weakPoints.map((w) => (
              <li key={w.name} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{w.name}</span>
                  <span className="text-amber-500" title={`严重度 ${w.severity}/3`}>
                    {"★".repeat(w.severity)}
                    {"☆".repeat(3 - w.severity)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{w.evidence}</p>
                {w.updatedAt && (
                  <p className="mt-1 text-xs text-slate-400">
                    最近更新：{new Date(w.updatedAt).toLocaleString("zh-CN")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        {resolved.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-emerald-700">已解决弱点</h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {resolved.map((r, i) => (
                <li
                  key={i}
                  className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
                >
                  ✓ {r.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold">历史课</h2>
        {memory.lessons.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">还没有备过课。</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {memory.lessons.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <Link
                    href={`/prep/${l.id}`}
                    className="font-medium text-slate-800 hover:text-emerald-600"
                  >
                    《{l.title}》
                  </Link>
                  <span className="ml-2 text-xs text-slate-400">
                    {new Date(l.createdAt).toLocaleDateString("zh-CN")}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{l.status}</span>
                  {l.reflectionJson && (
                    <Link
                      href={`/prep/${l.id}/reflect`}
                      className="text-xs text-emerald-600 underline"
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
