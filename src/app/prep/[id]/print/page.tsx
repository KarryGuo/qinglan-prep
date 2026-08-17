import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { DesignOutput, GenerateOutput } from "@/agent/schemas";
import { PrintToolbar } from "./print-toolbar";

export const dynamic = "force-dynamic";

const TIER_NAME: Record<string, string> = {
  basic: "基础",
  advanced: "提高",
  extension: "拓展",
};

/** 打印友好页：浏览器 Ctrl+P 即可导出 PDF，零依赖。 */
export default async function PrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lesson = await prisma.lesson.findUnique({ where: { id } });
  if (!lesson || !lesson.packageJson) notFound();

  const pkg = lesson.packageJson as GenerateOutput;
  const design = lesson.designJson as DesignOutput | null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 print:max-w-none print:px-0 print:py-0">
      <PrintToolbar lessonId={id} />

      <article className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <h1 className="text-center text-2xl font-bold">《{lesson.title}》备课包</h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          学科：{lesson.subject} ｜ 年级：{lesson.grade} ｜ 教材：{lesson.textbook}
        </p>

        {design && (
          <section className="mt-6">
            <h2 className="border-b border-slate-200 pb-1 text-lg font-bold">教学设计</h2>
            <p className="mt-2 text-sm">
              <b>重点</b>：{design.keyPoints}
              <br />
              <b>难点</b>：{design.difficultPoints}
            </p>
            <h3 className="mt-3 text-sm font-bold">教学目标</h3>
            <ol className="mt-1 list-decimal pl-5 text-sm">
              {design.objectives.map((o, i) => (
                <li key={i}>
                  {o.text}（依据：{o.curriculumRef}）
                </li>
              ))}
            </ol>
            <h3 className="mt-3 text-sm font-bold">教学环节</h3>
            <table className="mt-1 w-full border-collapse text-xs">
              <thead>
                <tr>
                  {["环节", "时长", "教师活动", "学生活动", "设计意图"].map((h) => (
                    <th key={h} className="border border-slate-300 bg-slate-50 px-2 py-1 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {design.stages.map((s, i) => (
                  <tr key={i}>
                    <td className="border border-slate-300 px-2 py-1">{s.name}</td>
                    <td className="border border-slate-300 px-2 py-1">{s.minutes}分钟</td>
                    <td className="border border-slate-300 px-2 py-1">{s.teacherActivity}</td>
                    <td className="border border-slate-300 px-2 py-1">{s.studentActivity}</td>
                    <td className="border border-slate-300 px-2 py-1">{s.intent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="mt-6">
          <h2 className="border-b border-slate-200 pb-1 text-lg font-bold">教案</h2>
          <div className="mt-2 whitespace-pre-line text-sm leading-6">{pkg.planMarkdown}</div>
        </section>

        <section className="mt-6">
          <h2 className="border-b border-slate-200 pb-1 text-lg font-bold">课件大纲</h2>
          {pkg.slides.map((s, i) => (
            <div key={i} className="mt-2">
              <h3 className="text-sm font-bold">
                第 {i + 1} 页 {s.pageTitle}
              </h3>
              <ul className="list-disc pl-5 text-sm">
                {s.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="mt-6">
          <h2 className="border-b border-slate-200 pb-1 text-lg font-bold">板书设计</h2>
          <div className="mt-2 whitespace-pre-line text-sm leading-6">{pkg.board}</div>
        </section>

        <section className="mt-6">
          <h2 className="border-b border-slate-200 pb-1 text-lg font-bold">分层作业</h2>
          {pkg.homework.map((h, i) => (
            <div key={i} className="mt-2">
              <h3 className="text-sm font-bold">{TIER_NAME[h.tier] ?? h.tier}</h3>
              <ol className="list-decimal pl-5 text-sm">
                {h.items.map((it, j) => (
                  <li key={j}>
                    {it.text}
                    <br />
                    <span className="text-slate-500">
                      参考答案：{it.answer}（知识点：{it.knowledgePoint}）
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </section>

        <section className="mt-6">
          <h2 className="border-b border-slate-200 pb-1 text-lg font-bold">随堂测</h2>
          <ol className="mt-2 list-decimal pl-5 text-sm">
            {pkg.quiz.map((q, i) => (
              <li key={i}>
                {q.text}
                <br />
                <span className="text-slate-500">
                  参考答案：{q.answer}（知识点：{q.knowledgePoint}）
                </span>
              </li>
            ))}
          </ol>
        </section>

        <p className="mt-8 border-t border-slate-200 pt-3 text-center text-xs text-slate-400">
          本内容供备课参考，教学决策由教师作出。
        </p>
      </article>
    </main>
  );
}
