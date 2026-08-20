import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTeacherId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STAGE_LABEL: Record<string, string> = {
  diagnose: "学情诊断",
  design: "依标设计",
  generate: "备课包生成",
  reflect: "课后反思",
};

const KIND_META: Record<string, { label: string; cls: string }> = {
  stage_start: { label: "阶段开始", cls: "border-chalk-50/30 bg-board-950/50 text-chalk-300" },
  thought: { label: "思考", cls: "border-chalk-pink/40 bg-chalk-pink/5 text-chalk-pink" },
  tool_call: { label: "工具调用", cls: "border-chalk-blue/40 bg-chalk-blue/5 text-chalk-blue" },
  tool_result: { label: "工具返回", cls: "border-chalk-blue/30 bg-board-950/40 text-chalk-blue" },
  confirm_required: { label: "请求补充", cls: "border-chalk-orange/50 bg-chalk-orange/5 text-chalk-orange" },
  stage_done: { label: "定稿", cls: "border-chalk-green/50 bg-chalk-green/5 text-chalk-green" },
  error: { label: "失败", cls: "border-chalk-pink/60 bg-chalk-pink/10 text-chalk-pink" },
};

export default async function TracePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // 归属校验：课程不存在 / 未登录 / 非本人课程一律 404，不泄露资源存在性
  const teacherId = await resolveTeacherId();
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      events: { orderBy: { createdAt: "asc" } },
      citations: true,
    },
  });

  if (!lesson || !teacherId || lesson.teacherId !== teacherId) {
    notFound();
  }

  const toolCallCount = lesson.events.filter((e) => e.kind === "tool_call").length;
  const first = lesson.events[0]?.createdAt;
  const last = lesson.events[lesson.events.length - 1]?.createdAt;
  const durationSec =
    first && last ? Math.max(0, Math.round((last.getTime() - first.getTime()) / 1000)) : 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/prep/${id}`} className="chalk-back">
            ← 返回流程
          </Link>
          <h1 className="chalk-text font-chalk mt-3 text-3xl font-bold text-chalk-50">
            Agent 工作过程 ·《{lesson.title}》
          </h1>
        </div>
        <Link href={`/prep/${id}/package`} className="chalk-btn-ghost">
          查看备课包
        </Link>
      </div>

      {/* 顶部统计条 */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="chalk-panel p-4 text-center">
          <p className="chalk-blue font-chalk text-2xl font-bold">{toolCallCount}</p>
          <p className="mt-1 text-xs text-chalk-400">工具调用次数</p>
        </div>
        <div className="chalk-panel p-4 text-center">
          <p className="chalk-green font-chalk text-2xl font-bold">{durationSec}s</p>
          <p className="mt-1 text-xs text-chalk-400">总耗时</p>
        </div>
        <div className="chalk-panel p-4 text-center">
          <p className="chalk-yellow font-chalk text-2xl font-bold">{lesson.citations.length}</p>
          <p className="mt-1 text-xs text-chalk-400">引用条数</p>
        </div>
      </div>

      {/* 时间线 */}
      <div className="mt-8">
        {lesson.events.length === 0 ? (
          <p className="text-sm text-chalk-400">
            暂无执行记录。回到流程页运行一个阶段后，这里会回放完整过程。
          </p>
        ) : (
          <ol className="relative space-y-3 border-l-2 border-dashed border-chalk-50/25 pl-6">
            {lesson.events.map((e) => {
              const meta = KIND_META[e.kind] ?? KIND_META.thought;
              const payload = e.payload as Record<string, unknown>;
              const isStageStart = e.kind === "stage_start";
              return (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[31px] top-2 h-2.5 w-2.5 rounded-full bg-chalk-50/40" />
                  {isStageStart ? (
                    <div className="chalk-yellow rounded-lg border-2 border-dashed border-chalk-yellow/60 bg-chalk-yellow/10 px-4 py-2 text-sm font-bold">
                      ▶ 阶段：{STAGE_LABEL[String(payload.stage)] ?? String(payload.stage)}
                    </div>
                  ) : (
                    <div className={`rounded-lg border border-dashed p-3 text-sm ${meta.cls}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">
                          {meta.label}
                          {e.kind === "tool_call" && ` · ${String(payload.name ?? "")}`}
                          {e.kind === "tool_result" && ` · ${String(payload.name ?? "")}`}
                        </span>
                        <span className="text-[10px] opacity-60">
                          {new Date(e.createdAt).toLocaleTimeString("zh-CN")}
                        </span>
                      </div>
                      {e.kind === "thought" && (
                        <p className="mt-1 whitespace-pre-line text-xs leading-5 text-chalk-300">
                          {String(payload.text ?? "")}
                        </p>
                      )}
                      {e.kind === "tool_call" && (
                        <pre className="mt-1 overflow-auto text-xs text-chalk-300">
                          {JSON.stringify(payload.args, null, 2)}
                        </pre>
                      )}
                      {e.kind === "tool_result" && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs">展开 JSON</summary>
                          <pre className="mt-1 max-h-48 overflow-auto text-xs text-chalk-300">
                            {JSON.stringify(payload.out, null, 2)}
                          </pre>
                        </details>
                      )}
                      {e.kind === "stage_done" && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs">查看产物 JSON</summary>
                          <pre className="mt-1 max-h-48 overflow-auto text-xs text-chalk-300">
                            {JSON.stringify(payload.output, null, 2)}
                          </pre>
                        </details>
                      )}
                      {e.kind === "error" && (
                        <p className="mt-1 text-xs">原因：{String(payload.reason ?? "")}</p>
                      )}
                      {e.kind === "confirm_required" && (
                        <ul className="mt-1 list-disc pl-4 text-xs">
                          {((payload.questions as string[]) ?? []).map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </main>
  );
}
