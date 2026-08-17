"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { consumeSse, type SseEvent } from "@/lib/sse";
import type { GenerateOutput, ReflectOutput } from "@/agent/schemas";

type Lesson = {
  id: string;
  title: string;
  status: string;
  packageJson: GenerateOutput | null;
  reflectionJson: ReflectOutput | null;
};

export default function ReflectPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [accuracies, setAccuracies] = useState<Record<number, string>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [events, setEvents] = useState<{ kind: string; text: string }[]>([]);

  useEffect(() => {
    fetch(`/api/lessons/${id}`)
      .then((r) => r.json())
      .then((d: Lesson) => {
        setLesson(d);
        // 默认用 generate 产出的 quiz 初始化正确率输入
        if (d.packageJson?.quiz) {
          const init: Record<number, string> = {};
          d.packageJson.quiz.forEach((_, i) => (init[i] = ""));
          setAccuracies(init);
        }
      })
      .catch(() => setError("加载失败"));
  }, [id]);

  async function submit() {
    if (!lesson?.packageJson?.quiz) return;
    const lines = lesson.packageJson.quiz.map((q, i) => {
      const v = accuracies[i]?.trim();
      return `第${i + 1}题（${q.knowledgePoint}）：${v ? `${v}%` : "未填写"}`;
    });
    const results = lines.join("；");
    setRunning(true);
    setError("");
    setEvents([]);
    try {
      await consumeSse(`/api/lessons/${id}/reflect`, { results }, (e: SseEvent) => {
        const p = e.payload as Record<string, unknown>;
        if (e.kind === "thought") setEvents((ev) => [...ev, { kind: "思考", text: String(p.text) }]);
        if (e.kind === "tool_call") setEvents((ev) => [...ev, { kind: "工具调用", text: String(p.name) }]);
        if (e.kind === "stage_done") setEvents((ev) => [...ev, { kind: "定稿", text: "反思报告已生成" }]);
        if (e.kind === "error") setEvents((ev) => [...ev, { kind: "失败", text: String(p.reason) }]);
      });
      const res = await fetch(`/api/lessons/${id}`);
      setLesson(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "执行失败");
    } finally {
      setRunning(false);
    }
  }

  if (!lesson) {
    return <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-chalk-400">加载中…</main>;
  }

  const reflection = lesson.reflectionJson;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href={`/prep/${id}`} className="chalk-back">
        ← 返回流程
      </Link>
      <h1 className="chalk-text font-chalk mt-3 text-3xl font-bold text-chalk-50">
        课后反思 ·《{lesson.title}》
      </h1>
      <p className="mt-2 text-sm text-chalk-400">
        填写随堂测各题正确率，Agent 将复盘"预测 vs 实际"并更新班级学情记忆。
      </p>

      {lesson.status !== "delivered" && lesson.status !== "reflected" && (
        <p className="chalk-box-yellow mt-4 bg-chalk-yellow/5 px-3 py-2 text-sm text-chalk-200">
          请先完成备课流程（当前状态：{lesson.status}）。
        </p>
      )}

      {lesson.packageJson?.quiz && (lesson.status === "delivered" || lesson.status === "reflected") && (
        <div className="chalk-panel mt-6 p-6">
          <h2 className="chalk-yellow font-chalk text-sm font-bold">随堂测正确率（%）</h2>
          <div className="mt-3 space-y-3">
            {lesson.packageJson.quiz.map((q, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="w-16 shrink-0 text-chalk-400">第 {i + 1} 题</span>
                <span className="min-w-0 flex-1 truncate text-chalk-200" title={q.text}>
                  {q.text}
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={accuracies[i] ?? ""}
                  onChange={(e) => setAccuracies((a) => ({ ...a, [i]: e.target.value }))}
                  className="chalk-input w-24 text-right"
                  placeholder="0-100"
                />
              </div>
            ))}
          </div>
          <button onClick={submit} disabled={running} className="chalk-btn-primary mt-4 disabled:opacity-50">
            {running ? "Agent 复盘中…" : "提交并生成反思"}
          </button>
          {error && <p className="mt-2 text-sm text-chalk-pink">{error}</p>}
          {events.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-chalk-400">
              {events.map((e, i) => (
                <li key={i}>
                  [{e.kind}] {e.text.slice(0, 120)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {reflection && (
        <div className="mt-6 space-y-4">
          <div className="chalk-panel p-6">
            <h2 className="chalk-yellow font-chalk text-sm font-bold">总体判断</h2>
            <p className="mt-2 text-sm leading-6 text-chalk-200">{reflection.overall}</p>
          </div>
          <div className="chalk-panel p-6">
            <h2 className="chalk-yellow font-chalk text-sm font-bold">逐知识点：预测 vs 实际</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dashed border-chalk-50/30 text-left text-xs text-chalk-400">
                    <th className="py-2 pr-2">知识点</th>
                    <th className="py-2 pr-2">预测</th>
                    <th className="py-2 pr-2">实际</th>
                    <th className="py-2">变化</th>
                  </tr>
                </thead>
                <tbody>
                  {reflection.perKnowledgePoint.map((k, i) => (
                    <tr key={i} className="border-b border-dashed border-chalk-50/15">
                      <td className="py-2 pr-2 font-medium text-chalk-50">{k.name}</td>
                      <td className="py-2 pr-2 text-chalk-300">{k.predicted}</td>
                      <td className="py-2 pr-2 text-chalk-300">{k.actual}</td>
                      <td className="chalk-blue py-2">{k.delta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="chalk-panel p-6">
            <h2 className="chalk-yellow font-chalk text-sm font-bold">下一课建议</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-chalk-200">
              {reflection.nextLessonSuggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
          <div className="chalk-box-green bg-chalk-green/5 p-6">
            <h2 className="chalk-green font-chalk text-sm font-bold">记忆更新摘要</h2>
            {reflection.memoryPatch.resolved.length > 0 && (
              <p className="mt-2 text-sm text-chalk-200">
                已解决弱点：{reflection.memoryPatch.resolved.join("、")}
              </p>
            )}
            {reflection.memoryPatch.newWeakPoints.length > 0 && (
              <p className="mt-1 text-sm text-chalk-200">
                新增弱点：
                {reflection.memoryPatch.newWeakPoints
                  .map((w) => `${w.name}（severity ${w.severity}）`)
                  .join("、")}
              </p>
            )}
            <Link href="/class" className="chalk-green mt-3 inline-block text-sm font-medium underline">
              查看学情记忆页 →
            </Link>
          </div>
          <p className="text-center text-xs text-chalk-500">
            本内容供备课参考，教学决策由教师作出。
          </p>
        </div>
      )}
    </main>
  );
}
