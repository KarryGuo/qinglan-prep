import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STAGE_LABEL: Record<string, string> = {
  diagnose: "学情诊断",
  design: "依标设计",
  generate: "备课包生成",
  reflect: "课后反思",
};

const KIND_META: Record<string, { label: string; cls: string }> = {
  stage_start: { label: "阶段开始", cls: "border-slate-300 bg-slate-100 text-slate-600" },
  thought: { label: "思考", cls: "border-violet-200 bg-violet-50 text-violet-700" },
  tool_call: { label: "工具调用", cls: "border-sky-200 bg-sky-50 text-sky-700" },
  tool_result: { label: "工具返回", cls: "border-sky-200 bg-white text-sky-700" },
  confirm_required: { label: "请求补充", cls: "border-amber-300 bg-amber-50 text-amber-700" },
  stage_done: { label: "定稿", cls: "border-emerald-300 bg-emerald-50 text-emerald-700" },
  error: { label: "失败", cls: "border-red-300 bg-red-50 text-red-700" },
};

export default async function TracePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      events: { orderBy: { createdAt: "asc" } },
      citations: true,
    },
  });

  if (!lesson) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-sm text-slate-500">
        课程不存在。
      </main>
    );
  }

  const toolCallCount = lesson.events.filter((e) => e.kind === "tool_call").length;
  const first = lesson.events[0]?.createdAt;
  const last = lesson.events[lesson.events.length - 1]?.createdAt;
  const durationSec =
    first && last ? Math.max(0, Math.round((last.getTime() - first.getTime()) / 1000)) : 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/prep/${id}`} className="text-sm text-slate-500 hover:text-slate-700">
            ← 返回流程
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Agent 工作过程 ·《{lesson.title}》</h1>
        </div>
        <Link
          href={`/prep/${id}/package`}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
        >
          查看备课包
        </Link>
      </div>

      {/* 顶部统计条 */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-sky-600">{toolCallCount}</p>
          <p className="mt-1 text-xs text-slate-500">工具调用次数</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-emerald-600">{durationSec}s</p>
          <p className="mt-1 text-xs text-slate-500">总耗时</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-amber-600">{lesson.citations.length}</p>
          <p className="mt-1 text-xs text-slate-500">引用条数</p>
        </div>
      </div>

      {/* 时间线 */}
      <div className="mt-8">
        {lesson.events.length === 0 ? (
          <p className="text-sm text-slate-400">
            暂无执行记录。回到流程页运行一个阶段后，这里会回放完整过程。
          </p>
        ) : (
          <ol className="relative space-y-3 border-l-2 border-slate-200 pl-6">
            {lesson.events.map((e) => {
              const meta = KIND_META[e.kind] ?? KIND_META.thought;
              const payload = e.payload as Record<string, unknown>;
              const isStageStart = e.kind === "stage_start";
              return (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[31px] top-2 h-2.5 w-2.5 rounded-full bg-slate-300" />
                  {isStageStart ? (
                    <div className="rounded-lg border border-slate-300 bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
                      ▶ 阶段：{STAGE_LABEL[String(payload.stage)] ?? String(payload.stage)}
                    </div>
                  ) : (
                    <div className={`rounded-lg border p-3 text-sm ${meta.cls}`}>
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
                        <p className="mt-1 whitespace-pre-line text-xs leading-5 text-slate-600">
                          {String(payload.text ?? "")}
                        </p>
                      )}
                      {e.kind === "tool_call" && (
                        <pre className="mt-1 overflow-auto text-xs text-slate-600">
                          {JSON.stringify(payload.args, null, 2)}
                        </pre>
                      )}
                      {e.kind === "tool_result" && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs">展开 JSON</summary>
                          <pre className="mt-1 max-h-48 overflow-auto text-xs text-slate-600">
                            {JSON.stringify(payload.out, null, 2)}
                          </pre>
                        </details>
                      )}
                      {e.kind === "stage_done" && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs">查看产物 JSON</summary>
                          <pre className="mt-1 max-h-48 overflow-auto text-xs text-slate-600">
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
