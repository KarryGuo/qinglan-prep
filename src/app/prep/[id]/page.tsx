"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { consumeSse, type SseEvent } from "@/lib/sse";

type Lesson = {
  id: string;
  subject: string;
  grade: string;
  textbook: string;
  title: string;
  classDesc: string;
  status: string;
  profileJson: unknown;
  designJson: unknown;
  packageJson: unknown;
  classMemory: { className: string; profile: unknown } | null;
  events: { id: string; stage: string; kind: string; payload: unknown }[];
};

const STAGES = ["diagnose", "design", "generate", "delivered"] as const;
const STAGE_LABEL: Record<string, string> = {
  diagnose: "① 学情诊断",
  design: "② 依标设计",
  generate: "③ 备课包生成",
  delivered: "④ 已交付",
  reflected: "已反思",
};

type StreamItem =
  | { kind: "thought"; text: string }
  | { kind: "tool_call"; name: string; args: unknown }
  | { kind: "tool_result"; name: string; out: unknown }
  | { kind: "confirm_required"; questions: string[] }
  | { kind: "stage_done"; output: unknown }
  | { kind: "error"; reason: string };

function eventToItem(stage: string, kind: string, payload: unknown): StreamItem | null {
  const p = payload as Record<string, unknown>;
  switch (kind) {
    case "thought":
      return { kind: "thought", text: String(p.text ?? "") };
    case "tool_call":
      return { kind: "tool_call", name: String(p.name), args: p.args };
    case "tool_result":
      return { kind: "tool_result", name: String(p.name), out: p.out };
    case "confirm_required":
      return { kind: "confirm_required", questions: (p.questions as string[]) ?? [] };
    case "stage_done":
      return { kind: "stage_done", output: p.output };
    case "error":
      return { kind: "error", reason: String(p.reason ?? "unknown") };
    default:
      return null;
  }
}

export default function LessonFlowPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [items, setItems] = useState<StreamItem[]>([]);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [failCount, setFailCount] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState("");
  const [answerMode, setAnswerMode] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const streamRef = useRef<StreamItem[]>([]);

  const currentStage = lesson?.status ?? "diagnose";

  const load = useCallback(async () => {
    const res = await fetch(`/api/lessons/${id}`);
    if (!res.ok) throw new Error("课程不存在");
    const data: Lesson = await res.json();
    setLesson(data);
    // 从 RunEvent 回放"最近一个已执行阶段"的历史事件
    const displayStage =
      data.status === "delivered" ? "generate" : data.status === "reflected" ? "reflect" : data.status;
    const history = data.events
      .filter((e) => e.stage === displayStage)
      .map((e) => eventToItem(e.stage, e.kind, e.payload))
      .filter((x): x is StreamItem => x !== null);
    streamRef.current = history;
    setItems(history);
    return data;
  }, [id]);

  useEffect(() => {
    load().catch(() => setRunError("加载失败，请刷新页面"));
  }, [load]);

  async function runStage(stage: string, teacherNote?: string) {
    setRunning(true);
    setRunError("");
    streamRef.current = [];
    setItems([]);
    try {
      await consumeSse(
        `/api/lessons/${id}/run`,
        { stage, teacherNote },
        (e: SseEvent) => {
          const item = eventToItem(stage, e.kind, e.payload);
          if (item) {
            streamRef.current = [...streamRef.current, item];
            setItems(streamRef.current);
          }
        }
      );
      await load();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "执行失败");
    } finally {
      setRunning(false);
    }
  }

  async function confirmStage(stage: string) {
    try {
      const res = await fetch(`/api/lessons/${id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, edits: editText || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "确认失败");
      }
      setEditMode(false);
      setEditText("");
      await load();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "确认失败");
    }
  }

  const lastDone = [...items].reverse().find((i) => i.kind === "stage_done");
  const lastConfirmReq = [...items].reverse().find((i) => i.kind === "confirm_required");
  const hasError = items.some((i) => i.kind === "error");

  if (!lesson) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 text-sm text-slate-500">
        加载中…
      </main>
    );
  }

  const runnable = ["diagnose", "design", "generate"].includes(currentStage);
  const stageHasOutput =
    (currentStage === "design" && lesson.profileJson) ||
    (currentStage === "generate" && lesson.designJson) ||
    currentStage === "diagnose";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
        ← 返回首页
      </Link>

      <div className="mt-4 flex gap-6">
        {/* 左侧步骤条 */}
        <aside className="w-48 shrink-0">
          <ol className="space-y-2">
            {STAGES.map((s) => {
              const active = s === currentStage;
              const passed = STAGES.indexOf(s as (typeof STAGES)[number]) <
                STAGES.indexOf(currentStage as (typeof STAGES)[number]);
              return (
                <li
                  key={s}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    active
                      ? "border-emerald-500 bg-emerald-50 font-semibold text-emerald-700"
                      : passed
                        ? "border-slate-200 bg-white text-slate-400 line-through"
                        : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  {STAGE_LABEL[s]}
                </li>
              );
            })}
            {lesson.status === "reflected" && (
              <li className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700">
                ✓ 已完成反思
              </li>
            )}
          </ol>
          <div className="mt-4 space-y-2 text-sm">
            <Link
              href={`/prep/${id}/trace`}
              className="block rounded-lg border border-slate-300 bg-white px-3 py-2 text-center hover:bg-slate-100"
            >
              Agent 过程
            </Link>
            {lesson.packageJson != null && (
              <Link
                href={`/prep/${id}/package`}
                className="block rounded-lg border border-slate-300 bg-white px-3 py-2 text-center hover:bg-slate-100"
              >
                查看备课包
              </Link>
            )}
            {(lesson.status === "delivered" || lesson.status === "reflected") && (
              <Link
                href={`/prep/${id}/reflect`}
                className="block rounded-lg border border-slate-300 bg-white px-3 py-2 text-center hover:bg-slate-100"
              >
                录入课后结果
              </Link>
            )}
          </div>
        </aside>

        {/* 右侧工作区 */}
        <section className="min-w-0 flex-1">
          {/* 输入摘要卡 */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <p className="font-semibold">
              {lesson.subject} {lesson.grade} {lesson.textbook} 《{lesson.title}》
            </p>
            <p className="mt-1 whitespace-pre-line text-slate-600">{lesson.classDesc}</p>
            {lesson.classMemory && (
              <p className="mt-1 text-xs text-slate-400">
                班级记忆：{lesson.classMemory.className}（已关联）
              </p>
            )}
          </div>

          {/* 运行控制 */}
          {runnable && !running && !lastDone && (
            <div className="mt-4">
              <button
                onClick={() => runStage(currentStage)}
                disabled={!stageHasOutput && currentStage !== "diagnose"}
                className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                运行 {STAGE_LABEL[currentStage]}
              </button>
            </div>
          )}

          {/* 流式事件流 */}
          <div className="mt-4 space-y-2">
            {items.map((item, idx) => (
              <EventCard key={idx} item={item} />
            ))}
            {running && (
              <p className="animate-pulse text-sm text-slate-400">Agent 正在工作…</p>
            )}
          </div>

          {/* confirm_required：教师回答后重跑 */}
          {lastConfirmReq && !running && !lastDone && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">
                Agent 需要补充信息：
              </p>
              <ul className="mt-2 list-disc pl-5 text-sm text-amber-800">
                {lastConfirmReq.questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
              {!answerMode ? (
                <button
                  onClick={() => setAnswerMode(true)}
                  className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  回答并重新运行
                </button>
              ) : (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm"
                    placeholder="请回答上述问题"
                  />
                  <button
                    onClick={() => {
                      setAnswerMode(false);
                      runStage(currentStage, answerText);
                    }}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    提交并重跑本阶段
                  </button>
                </div>
              )}
            </div>
          )}

          {/* error 事件 */}
          {hasError && !running && (
            <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-semibold">本阶段执行失败，请重试。</p>
              {failCount >= 2 && (
                <p className="mt-1">连续失败，请联系管理员：qinglan-prep@example.com</p>
              )}
              <button
                onClick={() => {
                  setFailCount((c) => c + 1);
                  runStage(currentStage);
                }}
                className="mt-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
              >
                重试
              </button>
            </div>
          )}

          {runError && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {runError}
            </p>
          )}

          {/* 阶段产物卡 + 确认按钮 */}
          {lastDone && !running && ["diagnose", "design", "generate"].includes(currentStage) && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-emerald-700">阶段产物已定稿</p>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                {JSON.stringify(lastDone.output, null, 2)}
              </pre>
              {!editMode ? (
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={() => confirmStage(currentStage)}
                    className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    确认并进入下一步
                  </button>
                  <button
                    onClick={() => setEditMode(true)}
                    className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700"
                  >
                    提出修改
                  </button>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="输入修改意见，将注入下一阶段"
                  />
                  <button
                    onClick={() => confirmStage(currentStage)}
                    className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    带修改意见确认
                  </button>
                </div>
              )}
            </div>
          )}

          {/* delivered 出口 */}
          {(lesson.status === "delivered" || lesson.status === "reflected") && (
            <div className="mt-4 flex gap-3">
              <Link
                href={`/prep/${id}/package`}
                className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                查看备课包
              </Link>
              <Link
                href={`/prep/${id}/reflect`}
                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700"
              >
                录入课后结果
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function EventCard({ item }: { item: StreamItem }) {
  if (item.kind === "thought") {
    return (
      <details className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
        <summary className="cursor-pointer font-medium text-slate-700">💭 思考</summary>
        <p className="mt-2 whitespace-pre-line text-slate-600">{item.text}</p>
      </details>
    );
  }
  if (item.kind === "tool_call") {
    return (
      <details className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm">
        <summary className="cursor-pointer font-medium text-sky-800">
          🔧 调用工具 {item.name}
        </summary>
        <pre className="mt-2 overflow-auto text-xs text-sky-700">
          {JSON.stringify(item.args, null, 2)}
        </pre>
      </details>
    );
  }
  if (item.kind === "tool_result") {
    return (
      <details className="rounded-lg border border-sky-200 bg-white p-3 text-sm">
        <summary className="cursor-pointer font-medium text-sky-800">
          📦 {item.name} 返回
        </summary>
        <pre className="mt-2 max-h-48 overflow-auto text-xs text-slate-600">
          {JSON.stringify(item.out, null, 2)}
        </pre>
      </details>
    );
  }
  if (item.kind === "stage_done") {
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
        ✓ 阶段产物定稿
      </p>
    );
  }
  if (item.kind === "error") {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
        ✗ 失败：{item.reason}
      </p>
    );
  }
  return null;
}
