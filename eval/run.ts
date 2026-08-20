/**
 * 青蓝备课 · 评测运行器（P0 评测体系）
 *
 * 目标：为参赛评审提供可复现的量化证据（阶段成功率 / 引用真实率 / 记忆写回正确率 / 工具调用覆盖率）。
 * 原则：
 * 1. 复用生产编排 runStage —— 评测的就是产品真实链路（同一份提示词、工具注册表、zod 校验）；
 * 2. 全部断言可机检 —— 查库、查事件流，无人工打分，`npm run eval` 任何人可复现；
 * 3. 独立评测库 —— prisma/eval.db，与演示/生产数据完全隔离；
 * 4. 关键结论独立复核 —— 课标引用存在性、记忆写回结果直接查库验证，不信任编排层兜底。
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { CASES, type EvalCase, type MemoryCheck } from "./cases";
import type { AgentEvent } from "../src/agent/events";
import type {
  DiagnoseOutput,
  DesignOutput,
  GenerateOutput,
  ReflectOutput,
  Stage,
} from "../src/agent/schemas";

// ---------- 0. 环境隔离：先载入 .env（LLM 密钥等），再强制指向独立评测库 ----------
// 必须在任何会触发 src/lib/env 初始化的 import 之前完成（故运行期依赖全部动态 import）
function loadDotEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadDotEnv(path.resolve(__dirname, "../.env"));
const EVAL_DB_URL =
  "file:" +
  path.resolve(__dirname, "../prisma/eval.db").split(path.sep).join("/");
process.env.TURSO_DATABASE_URL = EVAL_DB_URL;

// 同步建表：在独立评测库上执行 prisma db push（子进程继承已定向的 TURSO_DATABASE_URL）
const push = spawnSync("npx", ["prisma", "db", "push", "--skip-generate"], {
  cwd: path.resolve(__dirname, ".."),
  env: process.env,
  shell: true,
  encoding: "utf8",
});
if (push.status !== 0) {
  console.error("[eval] 评测库初始化失败：", push.stdout, push.stderr);
  process.exit(1);
}

// ---------- 类型 ----------
type Assertion = { id: string; desc: string; pass: boolean; detail: string };

type StageRun = {
  stage: Stage;
  done: boolean;
  ms: number;
  attempts: number; // runStage 调用次数（confirm_required 重跑 +1）
  confirmTriggered: boolean;
  toolCalls: string[]; // 工具调用名序列（按发生顺序）
  errorReason?: string; // 失败时编排层 error 事件的 reason（如 invalid_curriculum_ref）
  output?: unknown; // stage_done 产物
};

type CaseResult = {
  caseDef: EvalCase;
  stages: Partial<Record<Stage, StageRun>>;
  assertions: Assertion[];
  citationCount: number;
  runEventCount: number;
};

type Metrics = {
  stageSuccessRate: string;
  refRealRate: string;
  memoryWritebackRate: string;
  toolCoverageRate: string;
  e2eCompletionRate: string;
  assertionPassRate: string;
  avgStageSeconds: string;
};

// ---------- 断言工具 ----------
function assert(
  list: Assertion[],
  id: string,
  desc: string,
  pass: boolean,
  detail = ""
) {
  list.push({ id, desc, pass, detail });
}

/**
 * 语义重叠匹配：字面包含，或存在 ≥2 字公共子串（中文关键词级重叠）。
 * 用于"知识点是否覆盖弱点"类断言——诊断弱点是描述性长句
 * （如"文言文语感缺失，难以自然转译为现代汉语"），作业知识点是短语
 * （如"文言句子转译"），字面匹配会误判语义等价的对。
 */
function overlaps(a: string, b: string): boolean {
  if (a.includes(b) || b.includes(a)) return true;
  for (let i = 0; i + 2 <= a.length; i++) {
    if (b.includes(a.slice(i, i + 2))) return true;
  }
  return false;
}

/** 各阶段期望被调用的工具（提示词工作步骤的落地验证） */
function expectedTools(c: EvalCase, stage: Stage): string[] {
  switch (stage) {
    case "diagnose":
      return ["read_class_memory", "search_textbook"];
    case "design":
      return ["search_curriculum"];
    case "generate":
      return ["search_questions"];
    case "reflect":
      return ["read_class_memory"];
  }
}

async function runStageWithEvents(
  runStage: (lessonId: string, stage: Stage, forward: (e: AgentEvent) => void, opts: { teacherNote?: string; results?: string }) => Promise<void>,
  lessonId: string,
  stage: Stage,
  events: AgentEvent[],
  opts: { teacherNote?: string; results?: string } = {}
): Promise<void> {
  await runStage(lessonId, stage, (e) => events.push(e), opts);
}

// ---------- 主流程 ----------
async function main() {
  console.log("[eval] 评测库：", EVAL_DB_URL);
  console.log("[eval] 模型：", process.env.LLM_MODEL ?? "(默认)");

  // 动态 import：此时环境变量已定向评测库
  const { prisma } = await import("../src/lib/prisma");
  const { runStage } = await import("../src/agent/orchestrator");
  const curriculum = (await import("../src/data/curriculum.json")).default;
  const textbook = (await import("../src/data/textbook.json")).default;
  const questions = (await import("../src/data/questions.json")).default;

  // ---------- 1. 种子数据（知识表每轮先清后灌，与当前 JSON 强一致；教师/记忆每轮新建） ----------
  {
    const prev = await prisma.curriculumClause.count();
    await prisma.curriculumClause.deleteMany();
    await prisma.textbookNode.deleteMany();
    await prisma.question.deleteMany();
    await prisma.curriculumClause.createMany({ data: curriculum });
    await prisma.textbookNode.createMany({ data: textbook });
    await prisma.question.createMany({ data: questions });
    console.log(
      `[eval] 同步种子（${prev > 0 ? "重建" : "初次灌入"}）：课标 ${curriculum.length} 条 / 教材 ${textbook.length} 节 / 题目 ${questions.length} 道`
    );
  }

  let teacher = await prisma.teacher.findFirst({ where: { name: "评测教师" } });
  if (!teacher) {
    teacher = await prisma.teacher.create({
      data: { name: "评测教师", verifyStatus: "verified" },
    });
  }

  const results: CaseResult[] = [];
  const startedAt = Date.now();

  // ---------- 2. 逐用例执行四阶段闭环 ----------
  for (const c of CASES) {
    console.log(`\n[eval] ===== ${c.name} =====`);
    const result: CaseResult = {
      caseDef: c,
      stages: {},
      assertions: [],
      citationCount: 0,
      runEventCount: 0,
    };

    const runStamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const memory = await prisma.classMemory.create({
      data: {
        teacherId: teacher.id,
        className: `评测班-${runStamp}-${c.id}`,
        profile: {
          weakPoints: c.initialMemory.weakPoints.map((w) => ({ ...w })),
          resolved: c.initialMemory.resolved,
        },
      },
    });
    const lesson = await prisma.lesson.create({
      data: {
        teacherId: teacher.id,
        classMemoryId: memory.id,
        subject: c.subject,
        grade: c.grade,
        textbook: c.textbook,
        title: c.title,
        classDesc: c.classDesc,
      },
    });

    // diagnose（可能触发 confirm_required → 模拟教师回答后重跑）
    {
      const t0 = Date.now();
      const events: AgentEvent[] = [];
      let attempts = 1;
      await runStageWithEvents(runStage, lesson.id, "diagnose", events);
      let confirmTriggered = events.some((e) => e.kind === "confirm_required");
      let done = events.some((e) => e.kind === "stage_done");
      if (!done && confirmTriggered) {
        console.log("[eval] diagnose 触发教师确认提问，注入标准回答后重跑");
        events.length = 0;
        attempts = 2;
        await runStageWithEvents(runStage, lesson.id, "diagnose", events, {
          teacherNote: c.teacherAnswer,
        });
        done = events.some((e) => e.kind === "stage_done");
      }
      const run: StageRun = {
        stage: "diagnose",
        done,
        ms: Date.now() - t0,
        attempts,
        confirmTriggered,
        toolCalls: events
          .filter((e) => e.kind === "tool_call")
          .map((e) => (e.payload as { name: string }).name),
        errorReason: (events.find((e) => e.kind === "error")?.payload as { reason?: string } | undefined)?.reason,
        output: events.find((e) => e.kind === "stage_done")?.payload,
      };
      result.stages.diagnose = run;
      const errReason = events.find((e) => e.kind === "error")?.payload;
      console.log(
        `[eval] diagnose 完成=${done} 耗时=${(run.ms / 1000).toFixed(1)}s 工具=[${run.toolCalls.join(", ")}]${
          errReason ? ` 失败原因=${JSON.stringify(errReason)}` : ""
        }`
      );
    }

    const advance = async (from: "diagnose" | "design" | "generate") => {
      const next = { diagnose: "design", design: "generate", generate: "delivered" }[from];
      await prisma.lesson.update({ where: { id: lesson.id }, data: { status: next } });
    };

    // design / generate / reflect：结构相同的执行块
    const runPlain = async (stage: "design" | "generate" | "reflect") => {
      const t0 = Date.now();
      const events: AgentEvent[] = [];
      const opts =
        stage === "reflect" ? { results: c.reflectCsv } : {};
      await runStageWithEvents(runStage, lesson.id, stage, events, opts);
      const run: StageRun = {
        stage,
        done: events.some((e) => e.kind === "stage_done"),
        ms: Date.now() - t0,
        attempts: 1,
        confirmTriggered: false,
        toolCalls: events
          .filter((e) => e.kind === "tool_call")
          .map((e) => (e.payload as { name: string }).name),
        errorReason: (events.find((e) => e.kind === "error")?.payload as { reason?: string } | undefined)?.reason,
        output: events.find((e) => e.kind === "stage_done")?.payload,
      };
      result.stages[stage] = run;
      const errReason = events.find((e) => e.kind === "error")?.payload;
      console.log(
        `[eval] ${stage} 完成=${run.done} 耗时=${(run.ms / 1000).toFixed(1)}s 工具=[${run.toolCalls.join(", ")}]${
          errReason ? ` 失败原因=${JSON.stringify(errReason)}` : ""
        }`
      );
    };

    if (result.stages.diagnose!.done) await advance("diagnose");
    await runPlain("design");
    if (result.stages.design?.done) await advance("design");
    await runPlain("generate");
    if (result.stages.generate?.done) await advance("generate");
    await runPlain("reflect");

    // ---------- 3. 断言 ----------
    const A = result.assertions;
    const fresh = await prisma.lesson.findUniqueOrThrow({
      where: { id: lesson.id },
      include: { classMemory: true },
    });
    const diag = fresh.profileJson as DiagnoseOutput | null;
    const design = fresh.designJson as DesignOutput | null;
    const gen = fresh.packageJson as GenerateOutput | null;
    const refl = fresh.reflectionJson as ReflectOutput | null;
    const memBefore = {
      weakPoints: c.initialMemory.weakPoints.map((w) => w.name),
      resolved: c.initialMemory.resolved,
    };
    const memAfter = fresh.classMemory
      ? (fresh.classMemory.profile as {
          weakPoints: { name: string; severity: number; evidence: string }[];
          resolved: { name: string }[];
        })
      : null;

    // 3.1 阶段完成（done 即 zod Schema 校验通过且已持久化）
    for (const stage of ["diagnose", "design", "generate", "reflect"] as Stage[]) {
      const run = result.stages[stage]!;
      assert(
        A,
        `${stage}:done`,
        `${stage} 阶段完成（输出通过 zod Schema 校验并持久化）`,
        run.done,
        run.done ? "" : `编排层终止：${run.errorReason ?? "未收到 stage_done 事件（Schema 校验失败或达到轮次上限）"}`
      );
    }

    // 3.2 工具调用覆盖（期望工具必须出现在 tool_call 事件流）
    for (const stage of ["diagnose", "design", "generate", "reflect"] as Stage[]) {
      const run = result.stages[stage]!;
      for (const tool of expectedTools(c, stage)) {
        assert(
          A,
          `${stage}:tool-${tool}`,
          `${stage} 阶段调用了工具 ${tool}`,
          run.toolCalls.includes(tool),
          `实际调用：[${run.toolCalls.join(", ") || "无"}]`
        );
      }
    }

    // 3.3 diagnose：学情诊断与记忆/教材锚定
    if (diag) {
      if (c.initialMemory.weakPoints.length > 0) {
        const hit = diag.weakPoints.some((w) =>
          c.initialMemory.weakPoints.some((m) => overlaps(w.name, m.name))
        );
        assert(
          A,
          "diagnose:memory-grounded",
          "诊断弱点与班级记忆锚定（至少一项与既有弱点对应）",
          hit,
          `诊断弱点：[${diag.weakPoints.map((w) => w.name).join("、")}]`
        );
      }
      if (result.stages.diagnose!.confirmTriggered) {
        assert(
          A,
          "diagnose:confirm-recoverable",
          "触发教师确认提问后，注入回答可完成阶段（人在环路可恢复）",
          result.stages.diagnose!.done,
          `重跑次数：${result.stages.diagnose!.attempts}`
        );
      }
    }

    // 3.4 design：课标引用真实存在（独立查库复核，不信任编排层兜底）
    if (design) {
      let real = 0;
      for (const obj of design.objectives) {
        const clause = await prisma.curriculumClause.findFirst({
          where: { code: obj.curriculumRef },
        });
        if (clause) real++;
      }
      assert(
        A,
        "design:refs-real",
        "教学目标的课标引用全部真实存在（独立复核）",
        real === design.objectives.length && design.objectives.length > 0,
        `${real}/${design.objectives.length} 条引用真实`
      );
      const totalMin = design.stages.reduce((s, st) => s + st.minutes, 0);
      assert(
        A,
        "design:duration-reasonable",
        "各环节时长合计在 30-50 分钟（一节课合理范围）",
        totalMin >= 30 && totalMin <= 50,
        `合计 ${totalMin} 分钟`
      );
      if (c.initialMemory.weakPoints.length > 0) {
        const hasClassdata = design.stages.some((st) =>
          st.citations.some((ct) => ct.type === "classdata")
        );
        assert(
          A,
          "design:responds-weakness",
          "教学环节含学情引用（classdata），体现对既有弱点的回应",
          hasClassdata,
          hasClassdata ? "" : "所有环节均无 classdata 引用"
        );
      }
    }

    // 3.5 generate：作业/随堂测覆盖诊断弱点（诊—设—生闭环）
    if (diag && gen) {
      const kps = new Set(
        [...gen.homework.flatMap((h) => h.items), ...gen.quiz].map((i) => i.knowledgePoint)
      );
      const covered = diag.weakPoints.some((w) =>
        [...kps].some((k) => overlaps(k, w.name))
      );
      assert(
        A,
        "generate:covers-weakness",
        "作业/随堂测知识点覆盖诊断出的弱点",
        covered,
        `作业知识点：[${[...kps].join("、")}]；诊断弱点：[${diag.weakPoints.map((w) => w.name).join("、")}]`
      );
      const tiers = new Set(gen.homework.map((h) => h.tier));
      assert(
        A,
        "generate:tiers-complete",
        "作业三档难度齐备（basic/advanced/extension）",
        tiers.has("basic") && tiers.has("advanced") && tiers.has("extension"),
        `实际分层：[${[...tiers].join("、")}]`
      );
    }

    // 3.6 reflect：记忆写回（写回前后对比，直接查库验证）
    if (refl && memAfter) {
      const patch = refl.memoryPatch;
      const ok = patch.resolved.every((n) => memBefore.weakPoints.includes(n));
      assert(
        A,
        "reflect:patch-consistent",
        "memoryPatch.resolved 仅含既有弱点名称（不许自造）",
        ok,
        `resolved=[${patch.resolved.join("、") || "无"}]；既有弱点=[${memBefore.weakPoints.join("、") || "无"}]`
      );

      const check: MemoryCheck = c.memoryCheck;
      if (check.kind === "preserved") {
        const kept = memAfter.weakPoints.some((w) => overlaps(w.name, check.target));
        assert(
          A,
          "reflect:memory-preserved",
          `弱点「${check.target}」仍显著（正确率未达标），记忆中必须保留`,
          kept,
          `写回后弱点：[${memAfter.weakPoints.map((w) => w.name).join("、") || "无"}]`
        );
      } else if (check.kind === "grown") {
        assert(
          A,
          "reflect:memory-grown",
          "空记忆班级经反思后长出新弱点（记忆从零生长）",
          memAfter.weakPoints.length >= 1,
          `写回后弱点：[${memAfter.weakPoints.map((w) => w.name).join("、") || "无"}]`
        );
      } else if (check.kind === "resolved") {
        const removed = !memAfter.weakPoints.some((w) => overlaps(w.name, check.target));
        const recorded = memAfter.resolved.some((r) => overlaps(r.name, check.target));
        assert(
          A,
          "reflect:memory-resolved",
          `弱点「${check.target}」正确率达标（≥90%），记忆应移除并记入已解决`,
          removed && recorded,
          `写回后弱点：[${memAfter.weakPoints.map((w) => w.name).join("、") || "无"}]；已解决：[${memAfter.resolved.map((r) => r.name).join("、") || "无"}]`
        );
      }
    }

    // 3.7 端到端：引用与事件留痕（查库验证，对应"可观察、可追溯"）
    result.citationCount = await prisma.citation.count({
      where: { lessonId: lesson.id },
    });
    result.runEventCount = await prisma.runEvent.count({
      where: { lessonId: lesson.id },
    });
    const e2e = (["diagnose", "design", "generate", "reflect"] as Stage[]).every(
      (s) => result.stages[s]?.done
    );
    assert(
      A,
      "e2e:completed",
      "四阶段全部完成（诊—设—生—思闭环）",
      e2e,
      ""
    );
    assert(
      A,
      "e2e:citations-recorded",
      `溯源引用留痕 ≥ ${c.citationFloor} 条（Citation 表）`,
      result.citationCount >= c.citationFloor,
      `实际 ${result.citationCount} 条`
    );
    assert(
      A,
      "e2e:events-recorded",
      "Agent 执行事件留痕 ≥ 10 条（RunEvent 表，可追溯性）",
      result.runEventCount >= 10,
      `实际 ${result.runEventCount} 条`
    );

    const passed = A.filter((a) => a.pass).length;
    console.log(`[eval] 断言：${passed}/${A.length} 通过`);
    results.push(result);
  }

  const totalMs = Date.now() - startedAt;

  // ---------- 4. 指标汇总 ----------
  const allAssertions = results.flatMap((r) => r.assertions);
  const stageRuns = results.flatMap((r) =>
    (["diagnose", "design", "generate", "reflect"] as Stage[]).map((s) => r.stages[s]!)
  );
  const refAssertions = allAssertions.filter((a) => a.id === "design:refs-real");
  const memoryAssertions = allAssertions.filter((a) =>
    ["reflect:patch-consistent", "reflect:memory-preserved", "reflect:memory-grown", "reflect:memory-resolved"].includes(a.id)
  );
  const toolAssertions = allAssertions.filter((a) => a.id.includes(":tool-"));
  const e2eAssertions = allAssertions.filter((a) => a.id === "e2e:completed");

  const pct = (a: number, b: number) => (b === 0 ? "—" : `${((a / b) * 100).toFixed(1)}% (${a}/${b})`);
  const metrics: Metrics = {
    stageSuccessRate: pct(stageRuns.filter((r) => r.done).length, stageRuns.length),
    refRealRate: pct(refAssertions.filter((a) => a.pass).length, refAssertions.length),
    memoryWritebackRate: pct(memoryAssertions.filter((a) => a.pass).length, memoryAssertions.length),
    toolCoverageRate: pct(toolAssertions.filter((a) => a.pass).length, toolAssertions.length),
    e2eCompletionRate: pct(e2eAssertions.filter((a) => a.pass).length, e2eAssertions.length),
    assertionPassRate: pct(allAssertions.filter((a) => a.pass).length, allAssertions.length),
    avgStageSeconds: `${(stageRuns.reduce((s, r) => s + r.ms, 0) / stageRuns.length / 1000).toFixed(1)}s`,
  };

  // ---------- 5. 报告 ----------
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes()
  ).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;

  const jsonReport = {
    generatedAt: now.toISOString(),
    model: process.env.LLM_MODEL ?? "(默认)",
    dbUrl: EVAL_DB_URL,
    totalMs,
    metrics,
    cases: results.map((r) => ({
      caseId: r.caseDef.id,
      name: r.caseDef.name,
      memoryCheck: r.caseDef.memoryCheck,
      stages: Object.fromEntries(
        (["diagnose", "design", "generate", "reflect"] as Stage[]).map((s) => [
          s,
          r.stages[s] && {
            done: r.stages[s]!.done,
            ms: r.stages[s]!.ms,
            attempts: r.stages[s]!.attempts,
            toolCalls: r.stages[s]!.toolCalls,
            errorReason: r.stages[s]!.errorReason,
          },
        ])
      ),
      citationCount: r.citationCount,
      runEventCount: r.runEventCount,
      assertions: r.assertions,
    })),
  };
  fs.mkdirSync(path.resolve(__dirname, "reports"), { recursive: true });
  const jsonPath = path.resolve(__dirname, "reports", `eval-${stamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2), "utf8");

  const md = renderMarkdown(now, metrics, results, totalMs, {
    curriculum: curriculum.length,
    textbook: textbook.length,
    questions: questions.length,
  });
  const mdPath = path.resolve(__dirname, "../docs/评测报告.md");
  fs.writeFileSync(mdPath, md, "utf8");

  // ---------- 6. 汇总输出 ----------
  const passAll = allAssertions.every((a) => a.pass);
  console.log("\n[eval] ================ 指标汇总 ================");
  console.log(`阶段成功率（含 Schema 校验）  ${metrics.stageSuccessRate}`);
  console.log(`课标引用真实率（独立复核）  ${metrics.refRealRate}`);
  console.log(`记忆写回正确率              ${metrics.memoryWritebackRate}`);
  console.log(`工具调用覆盖率              ${metrics.toolCoverageRate}`);
  console.log(`端到端完成率                ${metrics.e2eCompletionRate}`);
  console.log(`断言总通过率                ${metrics.assertionPassRate}`);
  console.log(`平均阶段耗时                ${metrics.avgStageSeconds}`);
  console.log(`总耗时 ${(totalMs / 60000).toFixed(1)} 分钟`);
  console.log(`[eval] JSON 明细：${jsonPath}`);
  console.log(`[eval] Markdown 报告：${mdPath}`);
  console.log(`[eval] 结论：${passAll ? "全部断言通过" : "存在失败断言，详见报告"}`);

  await prisma.$disconnect();
  process.exit(passAll ? 0 : 1);
}

// ---------- Markdown 报告渲染 ----------
function renderMarkdown(
  now: Date,
  metrics: Metrics,
  results: CaseResult[],
  totalMs: number,
  seedCounts: { curriculum: number; textbook: number; questions: number }
): string {
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes()
    ).padStart(2, "0")}`;

  const lines: string[] = [];
  lines.push("# 青蓝备课 · Agent 评测报告");
  lines.push("");
  lines.push(
    `> 本报告由 \`npm run eval\` 自动生成，生成时间 ${fmt(now)}，模型 \`${process.env.LLM_MODEL ?? "(默认)"}\`，总耗时 ${(totalMs / 60000).toFixed(1)} 分钟。`
  );
  lines.push("");
  lines.push("## 一、指标汇总");
  lines.push("");
  lines.push("| 指标 | 数值 | 定义 |");
  lines.push("|---|---|---|");
  lines.push(`| 阶段成功率 | ${metrics.stageSuccessRate} | 四阶段运行中输出通过 zod Schema 校验并完成持久化的比例 |`);
  lines.push(`| 课标引用真实率 | ${metrics.refRealRate} | 教学目标 curriculumRef 在课标库中真实存在的比例（评测独立查库复核，不信任编排层兜底） |`);
  lines.push(`| 记忆写回正确率 | ${metrics.memoryWritebackRate} | memoryPatch 合法性 + 记忆迁移断言（保留/生长/消退）通过比例 |`);
  lines.push(`| 工具调用覆盖率 | ${metrics.toolCoverageRate} | 各阶段提示词要求的工具在事件流中实际被调用的比例 |`);
  lines.push(`| 端到端完成率 | ${metrics.e2eCompletionRate} | 单用例四阶段（诊—设—生—思）连续完成的用例比例 |`);
  lines.push(`| 断言总通过率 | ${metrics.assertionPassRate} | 全部可机检断言通过比例 |`);
  lines.push(`| 平均阶段耗时 | ${metrics.avgStageSeconds} | 单阶段端到端平均耗时 |`);
  lines.push("");
  lines.push("## 二、用例明细");
  lines.push("");

  for (const r of results) {
    const passed = r.assertions.filter((a) => a.pass).length;
    lines.push(`### ${r.caseDef.name}`);
    lines.push("");
    const stageLine = (["diagnose", "design", "generate", "reflect"] as Stage[])
      .map((s) => {
        const run = r.stages[s];
        const failTag = run && !run.done && run.errorReason ? `，失败：${run.errorReason}` : "";
        return `${s}：${run?.done ? "✓" : "✗"}（${(run ? run.ms / 1000 : 0).toFixed(1)}s，工具：${run?.toolCalls.join("/") || "无"}${failTag}）`;
      })
      .join(" · ");
    lines.push(`阶段执行：${stageLine}`);
    lines.push("");
    lines.push(`溯源引用 ${r.citationCount} 条 · 执行事件留痕 ${r.runEventCount} 条 · 断言 ${passed}/${r.assertions.length} 通过`);
    lines.push("");
    lines.push("| 断言 | 结果 | 说明 |");
    lines.push("|---|---|---|");
    for (const a of r.assertions) {
      lines.push(`| ${a.desc} | ${a.pass ? "✓" : "✗"} | ${a.pass ? "—" : a.detail} |`);
    }
    lines.push("");
  }

  lines.push("## 三、方法说明");
  lines.push("");
  lines.push("1. **测的是产品本身**：评测直接复用生产编排 `runStage`（同一份提示词模板、工具注册表、zod Schema 校验与持久化逻辑），不经过任何评测专用旁路。");
  lines.push("2. **断言全部可机检**：Schema 校验、课标引用存在性、工具调用（RunEvent 事件流）、记忆写回（ClassMemory 写回前后对比）均直接查库验证，无人工打分。");
  lines.push(`3. **独立评测库**：运行在 \`prisma/eval.db\`（本地 SQLite），与演示/生产数据完全隔离；知识库种子（课标 ${seedCounts.curriculum} 条 / 教材 ${seedCounts.textbook} 节 / 题目 ${seedCounts.questions} 道）与线上一致。`);
  lines.push("4. **记忆闭环覆盖三种迁移**：用例 A 验证弱点仍显著时记忆必须保留（不许凭空清除）；用例 B 验证新接手班级从空记忆生长新弱点；用例 C 验证弱点达标后正确消退并记入已解决。");
  lines.push("5. **波动性说明**：LLM 输出具有随机性（temperature 0.4），多次运行的指标可能在小范围内波动；失败断言如实记录、不修改产物，报告可由任何人运行 `npm run eval` 复现。");
  lines.push("");
  lines.push("## 四、复现方式");
  lines.push("");
  lines.push("```bash");
  lines.push("npm run eval   # 初始化评测库 → 执行 3 用例 × 4 阶段 → 生成本报告与 JSON 明细");
  lines.push("```");
  lines.push("");
  lines.push("前提：`.env` 中配置可用的 `LLM_API_KEY`；JSON 明细位于 `eval/reports/eval-<时间戳>.json`。");
  lines.push("");
  return lines.join("\n");
}

main().catch(async (err) => {
  console.error("[eval] 运行失败：", err);
  process.exit(1);
});
