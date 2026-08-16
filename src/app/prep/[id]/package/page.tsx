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
const CITE_LABEL: Record<string, string> = {
  curriculum: "课标",
  textbook: "教材",
  classdata: "学情",
  teacher: "教师",
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
    return <main className="mx-auto max-w-5xl px-4 py-10 text-sm text-slate-500">加载中…</main>;
  }
  if (!lesson.packageJson) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 text-sm text-slate-500">
        备课包尚未生成。<Link className="text-emerald-600 underline" href={`/prep/${id}`}>返回流程页</Link>
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
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/prep/${id}`} className="text-sm text-slate-500 hover:text-slate-700">
            ← 返回流程
          </Link>
          <h1 className="mt-2 text-2xl font-bold">《{lesson.title}》备课包</h1>
          <p className="text-sm text-slate-500">
            {lesson.subject} {lesson.grade} {lesson.textbook}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/prep/${id}/trace`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
          >
            Agent 过程
          </Link>
          <a
            href={`/api/lessons/${id}/export`}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            导出 Markdown
          </a>
        </div>
      </div>

      {/* 标签页 */}
      <div className="mt-6 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t
                ? "border-b-2 border-emerald-600 text-emerald-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6 flex gap-6">
        <div className="min-w-0 flex-1">
          {tab === "教案" && design && (
            <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <section>
                <h2 className="text-base font-semibold">教学目标</h2>
                <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
                  {design.objectives.map((o, i) => (
                    <li key={i} className="text-slate-700">
                      {o.text}
                      <button
                        onClick={() =>
                          openCites(
                            `目标 ${i + 1}（${o.curriculumRef}）`,
                            citesByStage("design").filter((c) => c.citeType === "curriculum")
                          )
                        }
                        className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700 hover:bg-emerald-100"
                        title={o.curriculumRef}
                      >
                        [课标]
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
              <section>
                <h2 className="text-base font-semibold">重点与难点</h2>
                <p className="mt-2 text-sm text-slate-700">
                  重点：{design.keyPoints}
                  {citesByStage("diagnose").some((c) => c.citeType === "textbook") && (
                    <button
                      onClick={() =>
                        openCites(
                          "重点与难点（教材依据）",
                          citesByStage("diagnose").filter((c) => c.citeType === "textbook")
                        )
                      }
                      className="ml-2 rounded bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700 hover:bg-sky-100"
                    >
                      [教材]
                    </button>
                  )}
                </p>
                <p className="mt-1 text-sm text-slate-700">难点：{design.difficultPoints}</p>
              </section>
              <section>
                <h2 className="text-base font-semibold">教学环节</h2>
                <table className="mt-2 w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                      <th className="py-2 pr-2">环节</th>
                      <th className="py-2 pr-2">时长</th>
                      <th className="py-2 pr-2">教师活动</th>
                      <th className="py-2 pr-2">学生活动</th>
                      <th className="py-2">设计意图</th>
                    </tr>
                  </thead>
                  <tbody>
                    {design.stages.map((s, i) => (
                      <tr key={i} className="border-b border-slate-100 align-top">
                        <td className="py-2 pr-2 font-medium text-slate-800">
                          {s.name}
                          {s.citations.length > 0 && (
                            <button
                              onClick={() =>
                                openCites(
                                  `环节「${s.name}」`,
                                  s.citations
                                    .map((c) => {
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
                              className="ml-1 rounded bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700 hover:bg-sky-100"
                            >
                              [{s.citations.map((c) => CITE_LABEL[c.type]).join("][")}]
                            </button>
                          )}
                        </td>
                        <td className="py-2 pr-2 text-slate-600">{s.minutes}分</td>
                        <td className="py-2 pr-2 text-slate-600">{s.teacherActivity}</td>
                        <td className="py-2 pr-2 text-slate-600">{s.studentActivity}</td>
                        <td className="py-2 text-slate-600">{s.intent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <section>
                <h2 className="text-base font-semibold">完整教案</h2>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                  {pkg.planMarkdown}
                </pre>
              </section>
            </div>
          )}

          {tab === "课件" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {pkg.slides.map((s, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs text-slate-400">第 {i + 1} 页</p>
                  <p className="mt-1 font-semibold text-slate-800">{s.pageTitle}</p>
                  <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
                    {s.bullets.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {tab === "板书" && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <pre className="whitespace-pre-wrap text-sm text-slate-700">{pkg.board}</pre>
            </div>
          )}

          {tab === "分层作业" && (
            <div className="space-y-4">
              {pkg.homework.map((h) => (
                <div key={h.tier} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-semibold text-slate-800">{TIER_NAME[h.tier] ?? h.tier}层</h3>
                  <ol className="mt-2 list-decimal space-y-3 pl-5 text-sm">
                    {h.items.map((item, i) => (
                      <li key={i} className="text-slate-700">
                        {item.text}
                        <button
                          onClick={() =>
                            openCites(
                              `作业题`,
                              citesByStage("generate").filter((c) => c.citeType === "classdata")
                            )
                          }
                          className="ml-2 rounded bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700 hover:bg-sky-100"
                        >
                          [学情]
                        </button>
                        <p className="mt-1 text-xs text-slate-400">
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
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <ol className="list-decimal space-y-3 pl-5 text-sm">
                {pkg.quiz.map((q, i) => (
                  <li key={i} className="text-slate-700">
                    {q.text}
                    <button
                      onClick={() =>
                        openCites(`随堂测第 ${i + 1} 题`, citesByStage("generate"))
                      }
                      className="ml-2 rounded bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700 hover:bg-sky-100"
                    >
                      [溯源]
                    </button>
                    <p className="mt-1 text-xs text-slate-400">
                      知识点：{q.knowledgePoint} ｜ 参考答案：{q.answer}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <p className="mt-6 text-center text-xs text-slate-400">
            本内容供备课参考，教学决策由教师作出。
          </p>
        </div>

        {/* 溯源面板 */}
        <aside className="w-80 shrink-0">
          <div className="sticky top-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">溯源面板</h3>
            {activeCite === null ? (
              <p className="mt-2 text-xs text-slate-400">
                点击内容中的引用角标（[课标][教材][学情]），在此查看依据。
              </p>
            ) : (
              <div className="mt-2">
                <p className="text-xs font-medium text-slate-500">{activeTitle}</p>
                {activeCite.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">暂无引用记录</p>
                ) : (
                  <ul className="mt-2 space-y-3">
                    {activeCite.map((c) => (
                      <li key={c.id} className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-emerald-700">
                          [{CITE_LABEL[c.citeType] ?? c.citeType}] {c.ref}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{c.snippet}</p>
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
