import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { resolveTeacherId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const stages = [
  {
    num: "01",
    key: "诊",
    title: "学情诊断",
    desc: "读取班级记忆与教材节点，先摸清你的班，再谈怎么教。",
    color: "chalk-yellow",
    box: "chalk-box-yellow",
  },
  {
    num: "02",
    key: "设",
    title: "依标设计",
    desc: "对齐课程标准，每个目标都标注课标依据，弱点有专门环节回应。",
    color: "chalk-blue",
    box: "chalk-box-blue",
  },
  {
    num: "03",
    key: "生",
    title: "备课包生成",
    desc: "教案、课件大纲、板书、分层作业与随堂测一次生成，作业跟着学情走。",
    color: "chalk-pink",
    box: "chalk-box-pink",
  },
  {
    num: "04",
    key: "思",
    title: "课后反思",
    desc: "录入作业正确率，复盘预测与实际，写回学情记忆，下一节课更准。",
    color: "chalk-green",
    box: "chalk-box-green",
  },
];

const pillars = [
  {
    title: "过程可见",
    body: "思考、工具调用、校验、定稿全程留痕，trace 页一键回放，Agent 不再是黑箱。",
    color: "chalk-yellow",
  },
  {
    title: "结果可溯",
    body: "每个目标、环节、作业题都带课标 / 教材 / 学情引用角标，点开即见依据。",
    color: "chalk-blue",
  },
  {
    title: "越用越懂",
    body: "班级学情记忆随反思增量更新，备课越久，它越懂你的学生。",
    color: "chalk-green",
  },
];

/** 旋转飞轮：四阶段首尾相接，中心是学情记忆 */
function Flywheel() {
  return (
    <div className="relative mx-auto h-[340px] w-[340px] sm:h-[400px] sm:w-[400px]">
      {/* 旋转的虚线圆环 + 四个阶段字 */}
      <svg viewBox="0 0 400 400" className="slow-spin absolute inset-0 h-full w-full">
        <circle
          cx="200"
          cy="200"
          r="150"
          fill="none"
          stroke="rgba(251,250,246,0.4)"
          strokeWidth="2"
          strokeDasharray="10 8"
        />
        {/* 圆环上的箭头点缀 */}
        <path
          d="M 340 160 L 352 178 L 330 182"
          fill="none"
          stroke="#ffd95e"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 60 240 L 48 222 L 70 218"
          fill="none"
          stroke="#ffd95e"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* 四个阶段标签（不随圆环转，固定在四角） */}
      <span className="chalk-fade chalk-yellow font-chalk absolute left-1/2 top-1 -translate-x-1/2 text-2xl font-bold" style={{ animationDelay: "500ms" }}>
        诊
      </span>
      <span className="chalk-fade chalk-blue font-chalk absolute right-1 top-1/2 -translate-y-1/2 text-2xl font-bold" style={{ animationDelay: "650ms" }}>
        设
      </span>
      <span className="chalk-fade chalk-pink font-chalk absolute bottom-1 left-1/2 -translate-x-1/2 text-2xl font-bold" style={{ animationDelay: "800ms" }}>
        生
      </span>
      <span className="chalk-fade chalk-green font-chalk absolute left-1 top-1/2 -translate-y-1/2 text-2xl font-bold" style={{ animationDelay: "950ms" }}>
        思
      </span>

      {/* 中心：学情记忆 */}
      <div className="chalk-fade absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center" style={{ animationDelay: "1100ms" }}>
        <div className="chalk-box mx-auto flex h-28 w-28 flex-col items-center justify-center bg-board-800/60">
          <span className="chalk-text font-chalk text-lg font-bold leading-tight">
            学情
            <br />
            记忆
          </span>
        </div>
        <p className="mt-3 text-xs tracking-widest text-chalk-400">越用越懂你的班</p>
      </div>
    </div>
  );
}

export default async function HomePage() {
  // 找"属于当前教师"的最近一节有执行记录的课（匿名演示会话解析为种子教师），
  // 避免入口指向他人课程触发越权拦截
  let traceLessonId: string | null = null;
  try {
    const teacherId = await resolveTeacherId();
    if (teacherId) {
      const ev = await prisma.runEvent.findFirst({
        where: { lesson: { teacherId } },
        orderBy: { createdAt: "desc" },
        select: { lessonId: true },
      });
      traceLessonId = ev?.lessonId ?? null;
    }
  } catch {
    /* 数据库未就绪时降级为不显示 trace 入口 */
  }

  return (
    <main className="relative z-10 overflow-hidden">
      {/* ===== Hero：黑板开篇 ===== */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p
              className="chalk-pop flex items-center gap-3 text-sm tracking-[0.3em] text-chalk-400"
              style={{ animationDelay: "0ms" }}
            >
              <span className="inline-block h-px w-10 bg-chalk-yellow/70" />
              备课 AGENT · 诊 — 设 — 生 — 思
            </p>

            <h1
              className="chalk-pop chalk-text font-chalk mt-7 text-5xl font-bold leading-[1.2] text-chalk-50 sm:text-6xl"
              style={{ animationDelay: "130ms" }}
            >
              让每一节课，
              <br />
              都<span className="chalk-underline chalk-yellow mx-1">有备而来</span>
            </h1>

            <p
              className="chalk-pop mt-8 max-w-xl text-base leading-8 text-chalk-200"
              style={{ animationDelay: "260ms" }}
            >
              教师输入课题与学情，Agent 完成学情诊断、依标设计、备课包生成，
              并在课后接收作业数据写回学情记忆。每一步思考与工具调用都留痕、可追溯——
              <span className="chalk-yellow font-semibold">不是替你备课，而是陪你备课。</span>
            </p>

            <div
              className="chalk-pop mt-10 flex flex-wrap items-center gap-4"
              style={{ animationDelay: "390ms" }}
            >
              <Link
                href="/prep/new?demo=hehua"
                className="group rounded-lg bg-chalk-yellow px-7 py-3.5 text-sm font-bold text-board-950 shadow-[0_8px_24px_-6px_rgba(255,217,94,0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-6px_rgba(255,217,94,0.55)]"
              >
                开始一节示范课
                <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
              {traceLessonId ? (
                <Link
                  href={`/prep/${traceLessonId}/trace`}
                  className="chalk-box rounded-lg px-7 py-3.5 text-sm font-semibold text-chalk-50 transition hover:border-chalk-50/80 hover:bg-chalk-50/5"
                >
                  查看 Agent 工作过程
                </Link>
              ) : (
                <span className="chalk-box rounded-lg px-7 py-3.5 text-sm text-chalk-600">
                  先完成一节课，即可查看 Agent 工作过程
                </span>
              )}
            </div>
          </div>

          {/* 飞轮 */}
          <div className="chalk-pop hidden lg:block" style={{ animationDelay: "300ms" }}>
            <Flywheel />
          </div>
        </div>
      </section>

      {/* ===== 粉笔槽分隔（装饰） ===== */}
      <div className="mx-auto max-w-6xl px-4">
        <div className="chalk-tray flex items-center gap-3 rounded-md px-4 py-2.5">
          <span className="h-2.5 w-14 rounded-full bg-chalk-50/85 shadow-sm" />
          <span className="h-2.5 w-9 rounded-full bg-chalk-yellow/85 shadow-sm" />
          <span className="h-2.5 w-11 rounded-full bg-chalk-pink/80 shadow-sm" />
          <span className="h-2.5 w-7 rounded-full bg-chalk-blue/80 shadow-sm" />
          <span className="ml-auto font-chalk text-xs tracking-[0.3em] text-chalk-400">
            一节课的完整闭环
          </span>
        </div>
      </div>

      {/* ===== 四阶段：粉笔卡片 ===== */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stages.map((s, i) => (
            <div
              key={s.key}
              className={`chalk-card chalk-pop ${s.box} relative bg-board-800/40 p-6`}
              style={{ animationDelay: `${i * 130}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className={`font-chalk text-3xl font-bold ${s.color}`}>{s.key}</span>
                <span className="text-xs tracking-widest text-chalk-600">{s.num}</span>
              </div>
              <h3 className={`font-chalk mt-4 text-xl font-bold ${s.color}`}>{s.title}</h3>
              <p className="mt-2 text-sm leading-6 text-chalk-200">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== 三大理念：板书批注 ===== */}
      <section className="border-t border-chalk-50/10 bg-board-950/40 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-10 lg:grid-cols-[300px_1fr]">
            <div>
              <p className="text-xs tracking-[0.3em] text-chalk-pink">WHY AGENT</p>
              <h2 className="chalk-text font-chalk mt-3 text-3xl font-bold leading-snug text-chalk-50">
                为什么是 Agent，
                <br />
                而不是模板？
              </h2>
              <p className="mt-5 text-sm leading-6 text-chalk-400">
                模板给你一份"能交差的教案"，
                <br />
                Agent 给你一套"经得起追问的备课过程"。
              </p>
            </div>

            <div className="divide-y divide-chalk-50/10">
              {pillars.map((p, i) => (
                <div
                  key={p.title}
                  className="chalk-pop flex gap-6 py-7 first:pt-0 last:pb-0"
                  style={{ animationDelay: `${i * 130}ms` }}
                >
                  <span className={`font-chalk text-3xl font-bold ${p.color}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className={`font-chalk text-xl font-bold ${p.color}`}>{p.title}</h3>
                    <p className="mt-2 max-w-lg text-sm leading-7 text-chalk-200">{p.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== 底部行动区 ===== */}
      <section className="py-16">
        <div className="mx-auto flex max-w-6xl flex-col items-center px-4 text-center">
          <h2 className="chalk-text font-chalk text-3xl font-bold text-chalk-50">
            备好下一节课，<span className="chalk-yellow">从此刻开始</span>
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-chalk-400">
            注册后创建你的班级，学情记忆将随每一次备课与反思沉淀下来——
            这是属于你和你的学生的数据资产。
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <Link
              href="/login"
              className="rounded-lg bg-chalk-yellow px-8 py-3.5 text-sm font-bold text-board-950 shadow-[0_8px_24px_-6px_rgba(255,217,94,0.45)] transition hover:-translate-y-0.5"
            >
              免费注册教师账号
            </Link>
            <Link
              href="/prep/new?demo=hehua"
              className="chalk-box rounded-lg px-8 py-3.5 text-sm font-semibold text-chalk-50 transition hover:border-chalk-50/80 hover:bg-chalk-50/5"
            >
              先体验示范课
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
