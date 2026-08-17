"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { consumeSse, type SseEvent } from "@/lib/sse";
import { StageOutputCard } from "@/components/StageOutputCard";

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
      <main className="mx-auto max-w-5xl px-4 py-10 text-sm text-chalk-400">
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
      <Link href="/" className="chalk-back">
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
                  className={`rounded-lg border-2 border-dashed px-3 py-2 text-sm ${
                    active
                      ? "chalk-yellow border-chalk-yellow/70 bg-chalk-yellow/10 font-semibold"
                      : passed
                        ? "border-chalk-50/20 text-chalk-600 line-through"
                        : "border-chalk-50/25 text-chalk-400"
                  }`}
                >
                  {STAGE_LABEL[s]}
                </li>
              );
            })}
            {lesson.status === "reflected" && (
              <li className="chalk-green rounded-lg border-2 border-dashed border-chalk-green/60 bg-chalk-green/10 px-3 py-2 text-sm font-semibold">
                ✓ 已完成反思
              </li>
            )}
          </ol>
          <div className="mt-4 space-y-2 text-sm">
            <Link href={`/prep/${id}/trace`} className="chalk-btn-ghost block text-center">
              Agent 过程
            </Link>
            {lesson.packageJson != null && (
              <Link href={`/prep/${id}/package`} className="chalk-btn-ghost block text-center">
                查看备课包
              </Link>
            )}
            {(lesson.status === "delivered" || lesson.status === "reflected") && (
              <Link href={`/prep/${id}/reflect`} className="chalk-btn-ghost block text-center">
                录入课后结果
              </Link>
            )}
          </div>
        </aside>

        {/* 右侧工作区 */}
        <section className="min-w-0 flex-1">
          {/* 输入摘要卡 */}
          <div className="chalk-panel p-4 text-sm">
            <p className="chalk-text font-chalk text-base font-bold text-chalk-50">
              {lesson.subject} {lesson.grade} {lesson.textbook} 《{lesson.title}》
            </p>
            <p className="mt-1 whitespace-pre-line text-chalk-200">{lesson.classDesc}</p>
            {lesson.classMemory && (
              <p className="mt-1 text-xs text-chalk-600">
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
                className="chalk-btn-primary"
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
              <p className="animate-pulse text-sm text-chalk-400">Agent 正在工作…</p>
            )}
          </div>

          {/* confirm_required：教师回答后重跑 */}
          {lastConfirmReq && !running && !lastDone && (
            <div className="chalk-box-yellow mt-4 bg-board-950/50 p-4">
              <p className="chalk-yellow text-sm font-semibold">Agent 需要补充信息：</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-chalk-200">
                {lastConfirmReq.questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
              {!answerMode ? (
                <button onClick={() => setAnswerMode(true)} className="chalk-btn-primary mt-3">
                  回答并重新运行
                </button>
              ) : (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    rows={3}
                    className="chalk-input"
                    placeholder="请回答上述问题"
                  />
                  <button
                    onClick={() => {
                      setAnswerMode(false);
                      runStage(currentStage, answerText);
                    }}
                    className="chalk-btn-primary"
                  >
                    提交并重跑本阶段
                  </button>
                </div>
              )}
            </div>
          )}

          {/* error 事件 */}
          {hasError && !running && (
            <div className="chalk-box-pink mt-4 bg-board-950/50 p-4 text-sm">
              <p className="chalk-pink font-semibold">本阶段执行失败，请重试。</p>
              {failCount >= 2 && (
                <p className="mt-1 text-chalk-200">
                  连续失败，请联系管理员：qinglan-prep@example.com
                </p>
              )}
              <button
                onClick={() => {
                  setFailCount((c) => c + 1);
                  runStage(currentStage);
                }}
                className="chalk-btn-primary mt-2"
              >
                重试
              </button>
            </div>
          )}

          {runError && (
            <p className="chalk-box-pink mt-3 bg-board-950/50 px-3 py-2 text-sm text-chalk-pink">
              {runError}
            </p>
          )}

          {/* 阶段产物卡 + 确认按钮 */}
          {lastDone && !running && ["diagnose", "design", "generate"].includes(currentStage) && (
            <div className="chalk-box-green mt-4 bg-board-950/50 p-4">
              <p className="chalk-green text-sm font-semibold">阶段产物已定稿</p>
              <div className="mt-2">
                <StageOutputCard stage={currentStage} output={lastDone.output} />
              </div>
              {!editMode ? (
                <div className="mt-3 flex gap-3">
                  <button onClick={() => confirmStage(currentStage)} className="chalk-btn-primary">
                    确认并进入下一步
                  </button>
                  <button onClick={() => setEditMode(true)} className="chalk-btn-ghost">
                    提出修改
                  </button>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    className="chalk-input"
                    placeholder="输入修改意见，将注入下一阶段"
                  />
                  <button onClick={() => confirmStage(currentStage)} className="chalk-btn-primary">
                    带修改意见确认
                  </button>
                </div>
              )}
            </div>
          )}

          {/* delivered 出口 */}
          {(lesson.status === "delivered" || lesson.status === "reflected") && (
            <div className="mt-4 flex gap-3">
              <Link href={`/prep/${id}/package`} className="chalk-btn-primary">
                查看备课包
              </Link>
              <Link href={`/prep/${id}/reflect`} className="chalk-btn-ghost">
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
      <details className="chalk-panel p-3 text-sm">
        <summary className="chalk-yellow cursor-pointer font-medium">💭 思考</summary>
        <p className="mt-2 whitespace-pre-line text-chalk-200">{item.text}</p>
      </details>
    );
  }
  if (item.kind === "tool_call") {
    return (
      <details className="chalk-box-blue bg-board-950/40 p-3 text-sm">
        <summary className="chalk-blue cursor-pointer font-medium">
          🔧 调用工具 {item.name}
        </summary>
        <pre className="mt-2 overflow-auto text-xs text-chalk-blue">
          {JSON.stringify(item.args, null, 2)}
        </pre>
      </details>
    );
  }
  if (item.kind === "tool_result") {
    return (
      <details className="chalk-box-blue bg-board-950/40 p-3 text-sm">
        <summary className="chalk-blue cursor-pointer font-medium">
          📦 {item.name} 返回
        </summary>
        <pre className="mt-2 max-h-48 overflow-auto text-xs text-chalk-200">
          {JSON.stringify(item.out, null, 2)}
        </pre>
      </details>
    );
  }
  if (item.kind === "stage_done") {
    return (
      <p className="chalk-green rounded-lg bg-chalk-green/10 px-3 py-2 text-sm font-medium">
        ✓ 阶段产物定稿
      </p>
    );
  }
  if (item.kind === "error") {
    return (
      <p className="chalk-pink rounded-lg bg-chalk-pink/10 px-3 py-2 text-sm">
        ✗ 失败：{item.reason}
      </p>
    );
  }
  return null;
}
