import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const stages = [
  {
    key: "诊",
    title: "学情诊断",
    desc: "读取班级记忆与教材节点，输出前置知识掌握度与弱点了表，先懂你的班再备课。",
  },
  {
    key: "设",
    title: "依标设计",
    desc: "对齐课程标准，每个教学目标都标注课标依据，弱点有专门的教学环节回应。",
  },
  {
    key: "生",
    title: "备课包生成",
    desc: "教案、课件大纲、板书、分层作业与随堂测一次生成，作业跟着学情走。",
  },
  {
    key: "思",
    title: "课后反思",
    desc: "录入作业正确率，复盘预测与实际，写回班级学情记忆，下一节课更准。",
  },
];

export default async function HomePage() {
  // 找最近一节有执行记录的课，供"查看 Agent 工作过程"入口使用
  let traceLessonId: string | null = null;
  try {
    const ev = await prisma.runEvent.findFirst({
      orderBy: { createdAt: "desc" },
      select: { lessonId: true },
    });
    traceLessonId = ev?.lessonId ?? null;
  } catch {
    /* 数据库未就绪时降级为不显示 trace 入口 */
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <header className="text-center">
        <p className="text-sm font-medium tracking-widest text-emerald-600">
          备课 Agent · 诊—设—生—思
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          青蓝备课
        </h1>
        <p className="mt-3 text-xl text-slate-600">
          让每一节课，都有备而来
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-500">
          教师输入课题与学情，Agent 完成学情诊断、依标设计、备课包生成，
          并在课后接收作业数据生成教学反思、写回学情记忆。每一步思考与工具调用都留痕、可追溯。
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/prep/new?demo=hehua"
            className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-700"
          >
            开始一节示范课
          </Link>
          {traceLessonId ? (
            <Link
              href={`/prep/${traceLessonId}/trace`}
              className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              查看 Agent 工作过程
            </Link>
          ) : (
            <span className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-3 text-sm text-slate-400">
              先完成一节课，即可查看 Agent 工作过程
            </span>
          )}
        </div>
      </header>

      <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map((s) => (
          <div
            key={s.key}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-lg font-bold text-emerald-600">
              {s.key}
            </div>
            <h2 className="mt-3 text-base font-semibold">{s.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{s.desc}</p>
          </div>
        ))}
      </section>

      <section className="mt-16 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold">为什么是 Agent，而不是模板？</h2>
        <ul className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
          <li className="rounded-lg bg-slate-50 p-4">
            <span className="font-medium text-slate-800">过程可见</span>
            ：思考、工具调用、校验、定稿全程留痕，trace 页一键回放。
          </li>
          <li className="rounded-lg bg-slate-50 p-4">
            <span className="font-medium text-slate-800">结果可溯</span>
            ：每个目标、环节、作业题都带课标 / 教材 / 学情引用角标。
          </li>
          <li className="rounded-lg bg-slate-50 p-4">
            <span className="font-medium text-slate-800">越用越懂</span>
            ：班级学情记忆随反思增量更新，下一次备课自动更准。
          </li>
        </ul>
      </section>
    </main>
  );
}
