"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { DesignOutput, GenerateOutput, ReflectOutput } from "@/agent/schemas";

type Citation = {
  id: string;
  stage: string;
  citeType: string;
  ref: string;
  snippet: string;
};

type Lesson = {
  id: string;
  title: string;
  subject: string;
  grade: string;
  textbook: string;
  status: string;
  designJson: DesignOutput | null;
  packageJson: GenerateOutput | null;
  reflectionJson: ReflectOutput | null;
  citations: Citation[];
};

const TABS = ["教案", "课件", "板书", "分层作业", "随堂测"] as const;
const TIER_NAME: Record<string, string> = {
  basic: "基础",
  advanced: "提高",
  extension: "拓展",
};
const TIER_CLS: Record<string, string> = {
  basic: "chalk-green border-chalk-green/60",
  advanced: "chalk-yellow border-chalk-yellow/60",
  extension: "chalk-blue border-chalk-blue/60",
};
const CITE_LABEL: Record<string, string> = {
  curriculum: "课标",
  textbook: "教材",
  classdata: "学情",
  teacher: "教师",
};
const CITE_CLS: Record<string, string> = {
  curriculum: "chalk-yellow border-chalk-yellow/50 bg-chalk-yellow/10 hover:bg-chalk-yellow/20",
  textbook: "chalk-blue border-chalk-blue/50 bg-chalk-blue/10 hover:bg-chalk-blue/20",
  classdata: "chalk-green border-chalk-green/50 bg-chalk-green/10 hover:bg-chalk-green/20",
  teacher: "chalk-pink border-chalk-pink/50 bg-chalk-pink/10 hover:bg-chalk-pink/20",
};

export default function PackagePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("教案");
  const [activeCite, setActiveCite] = useState<Citation[] | null>(null);
  const [activeTitle, setActiveTitle] = useState("");

  useEffect(() => {
    fetch(`/api/lessons/${id}`)
      .then((r) => r.json())
      .then(setLesson)
      .catch(() => {});
  }, [id]);

  if (!lesson) {
    return <main className="mx-auto max-w-5xl px-4 py-10 text-sm text-chalk-400">加载中…</main>;
  }
  if (!lesson.packageJson) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 text-sm text-chalk-400">
        备课包尚未生成。<Link className="chalk-yellow underline" href={`/prep/${id}`}>返回流程页</Link>
      </main>
    );
  }

  const pkg = lesson.packageJson;
  const design = lesson.designJson;
  const citesByStage = (stage: string) => lesson.citations.filter((c) => c.stage === stage);

  function openCites(title: string, cites: Citation[]) {
    setActiveTitle(title);
    setActiveCite(cites);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/prep/${id}`} className="chalk-back">
            ← 返回流程
          </Link>
          <h1 className="chalk-text font-chalk mt-3 text-3xl font-bold text-chalk-50">
            《{lesson.title}》备课包
          </h1>
          <p className="mt-1 text-sm text-chalk-400">
            {lesson.subject} {lesson.grade} {lesson.textbook}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/prep/${id}/trace`} className="chalk-btn-ghost">
            Agent 过程
          </Link>
          <a href={`/api/lessons/${id}/export?format=doc`} className="chalk-btn-primary">
            导出 Word
          </a>
          <Link href={`/prep/${id}/print`} className="chalk-btn-ghost">
            导出 PDF
          </Link>
          <a href={`/api/lessons/${id}/export`} className="chalk-btn-ghost">
            Markdown
          </a>
        </div>
      </div>

      {/* 标签页：粉笔书签式 */}
      <div className="mt-6 flex flex-wrap gap-2 border-b-2 border-dashed border-chalk-50/25 pb-3">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t-lg border-2 border-b-0 px-4 py-1.5 text-sm font-semibold transition ${
              tab === t
                ? "chalk-yellow border-chalk-yellow/70 bg-chalk-yellow/10"
                : "border-chalk-50/20 text-chalk-400 hover:border-chalk-50/40 hover:text-chalk-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          {tab === "教案" && design && (
            <div className="chalk-panel space-y-6 p-6">
              <section>
                <h2 className="chalk-yellow font-chalk text-base font-bold">一、教学目标</h2>
                <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
                  {design.objectives.map((o, i) => (
                    <li key={i} className="text-chalk-200">
                      {o.text}
                      <button
                        onClick={() =>
                          openCites(
                            `目标 ${i + 1}（${o.curriculumRef}）`,
                            citesByStage("design").filter((c) => c.citeType === "curriculum")
                          )
                        }
                        className={`ml-2 rounded border px-1.5 py-0.5 text-xs ${CITE_CLS.curriculum}`}
                        title={o.curriculumRef}
                      >
                        [课标]
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
              <section>
                <h2 className="chalk-yellow font-chalk text-base font-bold">二、重点与难点</h2>
                <p className="mt-2 text-sm text-chalk-200">
                  重点：{design.keyPoints}
                  {citesByStage("diagnose").some((c) => c.citeType === "textbook") && (
                    <button
                      onClick={() =>
                        openCites(
                          "重点与难点（教材依据）",
                          citesByStage("diagnose").filter((c) => c.citeType === "textbook")
                        )
                      }
                      className={`ml-2 rounded border px-1.5 py-0.5 text-xs ${CITE_CLS.textbook}`}
                    >
                      [教材]
                    </button>
                  )}
                </p>
                <p className="mt-1 text-sm text-chalk-200">难点：{design.difficultPoints}</p>
              </section>
              <section>
                <h2 className="chalk-yellow font-chalk text-base font-bold">三、教学环节</h2>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-dashed border-chalk-50/30 text-left text-xs text-chalk-400">
                        <th className="py-2 pr-2">环节</th>
                        <th className="py-2 pr-2">时长</th>
                        <th className="py-2 pr-2">教师活动</th>
                        <th className="py-2 pr-2">学生活动</th>
                        <th className="py-2">设计意图</th>
                      </tr>
                    </thead>
                    <tbody>
                      {design.stages.map((s, i) => (
                        <tr key={i} className="border-b border-dashed border-chalk-50/15 align-top">
                          <td className="py-2 pr-2 font-medium text-chalk-50">
                            {s.name}
                            {s.citations.length > 0 && (
                              <button
                                onClick={() =>
                                  openCites(
                                    `环节「${s.name}」`,
                                    s.citations.map((c) => {
                                      const found = lesson.citations.find(
                                        (x) => x.stage === "design" && x.ref.includes(s.name) && x.citeType === c.type
                                      );
                                      return (
                                        found ?? {
                                          id: `${i}-${c.type}`,
                                          stage: "design",
                                          citeType: c.type,
                                          ref: c.ref,
                                          snippet: c.ref,
                                        }
                                      );
                                    })
                                  )
                                }
                                className={`ml-1 rounded border px-1.5 py-0.5 text-xs ${CITE_CLS.textbook}`}
                              >
                                [{s.citations.map((c) => CITE_LABEL[c.type]).join("][")}]
                              </button>
                            )}
                          </td>
                          <td className="chalk-orange py-2 pr-2">{s.minutes}分</td>
                          <td className="py-2 pr-2 text-chalk-300">{s.teacherActivity}</td>
                          <td className="py-2 pr-2 text-chalk-300">{s.studentActivity}</td>
                          <td className="py-2 text-chalk-300">{s.intent}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section>
                <h2 className="chalk-yellow font-chalk text-base font-bold">四、完整教案</h2>
                <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-board-950/60 p-4 text-sm leading-6 text-chalk-200">
                  {pkg.planMarkdown}
                </pre>
              </section>
            </div>
          )}

          {tab === "课件" && (
            <div className="grid gap-4 sm:grid-cols-2">
              {pkg.slides.map((s, i) => (
                <div key={i} className="chalk-panel p-4">
                  <p className="text-xs text-chalk-500">第 {i + 1} 页</p>
                  <p className="chalk-blue font-chalk mt-1 font-semibold">{s.pageTitle}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-chalk-300">
                    {s.bullets.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {tab === "板书" && (
            <div className="chalk-box bg-board-950/50 p-6">
              <p className="mb-3 text-center text-xs text-chalk-500">—— 板书设计 ——</p>
              <pre className="whitespace-pre-wrap text-sm leading-7 text-chalk-100">{pkg.board}</pre>
            </div>
          )}

          {tab === "分层作业" && (
            <div className="space-y-4">
              {pkg.homework.map((h) => (
                <div key={h.tier} className="chalk-panel p-5">
                  <h3 className={`font-chalk text-base font-bold ${TIER_CLS[h.tier]?.split(" ")[0] ?? "chalk-yellow"}`}>
                    {TIER_NAME[h.tier] ?? h.tier}层
                  </h3>
                  <ol className="mt-2 list-decimal space-y-3 pl-5 text-sm">
                    {h.items.map((item, i) => (
                      <li key={i} className="text-chalk-200">
                        {item.text}
                        <button
                          onClick={() =>
                            openCites(
                              `作业题`,
                              citesByStage("generate").filter((c) => c.citeType === "classdata")
                            )
                          }
                          className={`ml-2 rounded border px-1.5 py-0.5 text-xs ${CITE_CLS.classdata}`}
                        >
                          [学情]
                        </button>
                        <p className="mt-1 text-xs text-chalk-500">
                          知识点：{item.knowledgePoint} ｜ 参考答案：{item.answer}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}

          {tab === "随堂测" && (
            <div className="chalk-panel p-5">
              <ol className="list-decimal space-y-3 pl-5 text-sm">
                {pkg.quiz.map((q, i) => (
                  <li key={i} className="text-chalk-200">
                    {q.text}
                    <button
                      onClick={() => openCites(`随堂测第 ${i + 1} 题`, citesByStage("generate"))}
                      className={`ml-2 rounded border px-1.5 py-0.5 text-xs ${CITE_CLS.classdata}`}
                    >
                      [溯源]
                    </button>
                    <p className="mt-1 text-xs text-chalk-500">
                      知识点：{q.knowledgePoint} ｜ 参考答案：{q.answer}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <p className="mt-6 text-center text-xs text-chalk-500">
            本内容供备课参考，教学决策由教师作出。
          </p>
        </div>

        {/* 溯源面板 */}
        <aside className="w-full shrink-0 lg:w-80">
          <div className="chalk-panel sticky top-4 p-4">
            <h3 className="chalk-text font-chalk text-sm font-bold text-chalk-50">溯源面板</h3>
            {activeCite === null ? (
              <p className="mt-2 text-xs leading-5 text-chalk-400">
                点击内容中的引用角标（[课标][教材][学情]），在此查看依据。
              </p>
            ) : (
              <div className="mt-2">
                <p className="text-xs font-medium text-chalk-300">{activeTitle}</p>
                {activeCite.length === 0 ? (
                  <p className="mt-2 text-xs text-chalk-400">暂无引用记录</p>
                ) : (
                  <ul className="mt-2 space-y-3">
                    {activeCite.map((c) => (
                      <li key={c.id} className="rounded-lg bg-board-950/60 p-3">
                        <p className={`text-xs font-semibold ${CITE_CLS[c.citeType]?.split(" ")[0] ?? "chalk-yellow"}`}>
                          [{CITE_LABEL[c.citeType] ?? c.citeType}] {c.ref}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-chalk-300">{c.snippet}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
