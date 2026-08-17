"use client";

import type { DiagnoseOutput, DesignOutput, GenerateOutput } from "@/agent/schemas";

/**
 * 阶段产物可视化卡片：教师视角的结构化报告，底部保留可折叠的原始 JSON（可追溯）。
 * 黑板粉笔主题。
 */
export function StageOutputCard({ stage, output }: { stage: string; output: unknown }) {
  return (
    <div>
      {stage === "diagnose" && <DiagnoseCard data={output as DiagnoseOutput} />}
      {stage === "design" && <DesignCard data={output as DesignOutput} />}
      {stage === "generate" && <GenerateCard data={output as GenerateOutput} />}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-chalk-600 hover:text-chalk-400">
          查看原始数据（Agent 定稿 JSON，供追溯）
        </summary>
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-board-950/70 p-3 text-xs text-chalk-200">
          {JSON.stringify(output, null, 2)}
        </pre>
      </details>
    </div>
  );
}

/* ---------------- 学情诊断 ---------------- */

const MASTERY_META: Record<string, { label: string; cls: string }> = {
  solid: { label: "扎实", cls: "chalk-green border-chalk-green/60 bg-chalk-green/10" },
  average: { label: "一般", cls: "chalk-yellow border-chalk-yellow/60 bg-chalk-yellow/10" },
  weak: { label: "薄弱", cls: "chalk-pink border-chalk-pink/60 bg-chalk-pink/10" },
};

const SEVERITY_META: Record<number, { label: string; cls: string; bar: string }> = {
  1: { label: "轻度", cls: "chalk-yellow border-chalk-yellow/60 bg-chalk-yellow/10", bar: "bg-chalk-yellow" },
  2: { label: "中度", cls: "chalk-orange border-chalk-orange/60 bg-chalk-orange/10", bar: "bg-chalk-orange" },
  3: { label: "重度", cls: "chalk-pink border-chalk-pink/60 bg-chalk-pink/10", bar: "bg-chalk-pink" },
};

function DiagnoseCard({ data }: { data: DiagnoseOutput }) {
  if (!data || typeof data.summary !== "string") return <FallbackJson data={data} />;
  return (
    <div className="space-y-4 text-sm">
      {/* 诊断总结 */}
      <div className="chalk-box-green bg-board-950/40 p-3">
        <p className="chalk-green font-chalk font-semibold">诊断总结</p>
        <p className="mt-1 whitespace-pre-line text-chalk-200">{data.summary}</p>
      </div>

      {/* 前置知识掌握度 */}
      <div>
        <p className="chalk-text font-chalk font-semibold text-chalk-50">前置知识掌握度</p>
        <ul className="mt-2 space-y-2">
          {(data.prerequisites ?? []).map((p, i) => {
            const m = MASTERY_META[p.mastery] ?? MASTERY_META.average;
            return (
              <li key={i} className="chalk-panel p-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${m.cls}`}>
                    {m.label}
                  </span>
                  <span className="font-medium text-chalk-50">{p.name}</span>
                </div>
                <p className="mt-1 text-xs text-chalk-400">依据：{p.basis}</p>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 薄弱点 */}
      <div>
        <p className="chalk-text font-chalk font-semibold text-chalk-50">薄弱点与教学建议</p>
        <ul className="mt-2 space-y-2">
          {(data.weakPoints ?? []).map((w, i) => {
            const s = SEVERITY_META[w.severity] ?? SEVERITY_META[1];
            return (
              <li key={i} className="chalk-panel p-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${s.cls}`}>
                    {s.label}
                  </span>
                  <span className="font-medium text-chalk-50">{w.name}</span>
                </div>
                <div className="mt-2 h-1 w-full rounded-full bg-chalk-50/10">
                  <div
                    className={`h-1 rounded-full ${s.bar}`}
                    style={{ width: `${(w.severity / 3) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-chalk-400">证据：{w.evidence}</p>
                <p className="mt-1 text-xs text-chalk-green">建议：{w.suggestion}</p>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 注意力提示 */}
      {data.attentionNote && (
        <div className="chalk-box-blue bg-board-950/40 p-3 text-chalk-blue">
          <span className="font-semibold">课堂提示：</span>
          {data.attentionNote}
        </div>
      )}

      {/* 待教师补充 */}
      {data.questionsForTeacher && data.questionsForTeacher.length > 0 && (
        <div className="chalk-box-yellow bg-board-950/40 p-3">
          <p className="chalk-yellow font-semibold">需要您补充的信息</p>
          <ul className="mt-1 list-disc pl-5 text-chalk-200">
            {data.questionsForTeacher.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------------- 依标设计 ---------------- */

const CITE_LABEL: Record<string, string> = {
  curriculum: "课标",
  textbook: "教材",
  classdata: "学情",
};

function DesignCard({ data }: { data: DesignOutput }) {
  if (!data || typeof data.keyPoints !== "string") return <FallbackJson data={data} />;
  const totalMinutes = (data.stages ?? []).reduce((s, x) => s + (x.minutes || 0), 0);
  return (
    <div className="space-y-4 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="chalk-box-green bg-board-950/40 p-3">
          <p className="chalk-green font-chalk font-semibold">教学重点</p>
          <p className="mt-1 text-chalk-200">{data.keyPoints}</p>
        </div>
        <div className="chalk-box-pink bg-board-950/40 p-3">
          <p className="chalk-pink font-chalk font-semibold">教学难点</p>
          <p className="mt-1 text-chalk-200">{data.difficultPoints}</p>
        </div>
      </div>

      <div>
        <p className="chalk-text font-chalk font-semibold text-chalk-50">教学目标（附课标依据）</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-chalk-200">
          {(data.objectives ?? []).map((o, i) => (
            <li key={i}>
              {o.text}
              <span className="ml-1 rounded bg-chalk-50/10 px-1.5 py-0.5 text-xs text-chalk-400">
                课标 {o.curriculumRef}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <p className="chalk-text font-chalk font-semibold text-chalk-50">
          教学环节（共 {totalMinutes} 分钟）
        </p>
        <div className="mt-2 space-y-2">
          {(data.stages ?? []).map((st, i) => (
            <div key={i} className="chalk-panel p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-chalk-50">
                  {i + 1}. {st.name}
                </span>
                <span className="rounded bg-chalk-50/10 px-1.5 py-0.5 text-xs text-chalk-400">
                  {st.minutes} 分钟
                </span>
              </div>
              <div className="mt-2 grid gap-2 text-xs text-chalk-200 sm:grid-cols-2">
                <p>
                  <span className="font-medium text-chalk-50">教师活动：</span>
                  {st.teacherActivity}
                </p>
                <p>
                  <span className="font-medium text-chalk-50">学生活动：</span>
                  {st.studentActivity}
                </p>
              </div>
              <p className="mt-1 text-xs text-chalk-400">设计意图：{st.intent}</p>
              {st.citations && st.citations.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {st.citations.map((c, j) => (
                    <span
                      key={j}
                      className="rounded bg-chalk-blue/10 px-1.5 py-0.5 text-xs text-chalk-blue"
                      title={c.ref}
                    >
                      {CITE_LABEL[c.type] ?? c.type}·{c.ref}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="chalk-panel p-3">
        <p className="chalk-text font-chalk font-semibold text-chalk-50">板书设计</p>
        <p className="mt-1 whitespace-pre-line text-chalk-200">{data.boardDesign}</p>
      </div>
    </div>
  );
}

/* ---------------- 备课包生成 ---------------- */

const TIER_LABEL: Record<string, string> = {
  basic: "基础",
  advanced: "提高",
  extension: "拓展",
};

function GenerateCard({ data }: { data: GenerateOutput }) {
  if (!data || typeof data.planMarkdown !== "string") return <FallbackJson data={data} />;
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="教案" value="已生成" />
        <Stat label="课件" value={`${(data.slides ?? []).length} 页`} />
        <Stat
          label="分层作业"
          value={`${(data.homework ?? []).reduce((s, t) => s + t.items.length, 0)} 题`}
        />
        <Stat label="随堂测" value={`${(data.quiz ?? []).length} 题`} />
      </div>
      <div className="flex flex-wrap gap-2">
        {(data.homework ?? []).map((t, i) => (
          <span key={i} className="rounded bg-chalk-50/10 px-2 py-1 text-xs text-chalk-200">
            {TIER_LABEL[t.tier] ?? t.tier}层 {t.items.length} 题
          </span>
        ))}
      </div>
      <p className="text-xs text-chalk-400">
        完整备课包请前往「查看备课包」页面，含教案全文、课件、板书与题目详情。
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="chalk-panel p-3 text-center">
      <p className="text-xs text-chalk-400">{label}</p>
      <p className="chalk-yellow mt-1 font-semibold">{value}</p>
    </div>
  );
}

/* ---------------- 兜底 ---------------- */

function FallbackJson({ data }: { data: unknown }) {
  return (
    <pre className="max-h-64 overflow-auto rounded-lg bg-board-950/70 p-3 text-xs text-chalk-200">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
