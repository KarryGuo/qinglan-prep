import { prisma } from "@/lib/prisma";
import { chat, type ChatMessage } from "@/lib/llm";
import { buildContext } from "./context";
import { makeEmitter, type Emitter } from "./events";
import { systemPrompt, userPrompt } from "./prompts";
import {
  STAGE_OUTPUT_SCHEMA,
  type DiagnoseOutput,
  type DesignOutput,
  type GenerateOutput,
  type ReflectOutput,
  type Stage,
} from "./schemas";
import { TOOLS, executeTool } from "./tools";

const MAX_TURNS = 6;

type RunOptions = {
  /** 教师对 confirm_required 的回答或修改意见，作为用户消息注入 */
  teacherNote?: string;
  /** reflect 阶段的作业结果文本 */
  results?: string;
};

/** Plan-Execute-Reflect：有上限的工具调用循环。 */
export async function runStage(
  lessonId: string,
  stage: Stage,
  forward: (e: Parameters<Emitter>[0]) => void,
  opts: RunOptions = {}
): Promise<void> {
  const emit = makeEmitter(lessonId, stage, forward);
  emit({ kind: "stage_start", payload: { stage } });

  try {
    const ctx = await buildContext(lessonId, stage);
    if (opts.results) ctx.results = opts.results;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt(stage, ctx) },
      { role: "user", content: userPrompt(stage, ctx) },
    ];
    if (opts.teacherNote) {
      messages.push({
        role: "user",
        content: `教师补充说明（用户提供的教学背景）：${opts.teacherNote}`,
      });
    }

    // 轮次预算管理与两类纠正（评测驱动改进）：
    // 1. 检索预算感知收敛：模型可能陷入"反复检索不输出"的循环，
    //    倒数第二轮注入收敛提示，最后一轮禁用工具强制输出；
    // 2. 引用闭集纠正：模型自拟 curriculumRef（幻觉）时，纠正消息直接列出
    //    全部可用 code，把开放式引用变为闭集选择；纠正轮不消耗预算。
    let turn = 0;
    let refRetried = false;
    let schemaRetried = false;
    while (turn < MAX_TURNS) {
      const isLastTurn = turn === MAX_TURNS - 1;
      const res = await chat({
        messages,
        tools: TOOLS[stage],
        tool_choice: isLastTurn ? "none" : "auto",
      });

      if (res.tool_calls?.length && !isLastTurn) {
        messages.push({
          role: "assistant",
          content: res.content,
          tool_calls: res.tool_calls,
        });
        for (const call of res.tool_calls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            /* 入参解析失败按空参数处理，工具层会报错 */
          }
          emit({
            kind: "tool_call",
            payload: { id: call.id, name: call.function.name, args },
          });
          let out: unknown;
          try {
            out = await executeTool(call.function.name, args);
          } catch (err) {
            out = { error: err instanceof Error ? err.message : String(err) };
          }
          emit({ kind: "tool_result", payload: { name: call.function.name, out } });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(out),
          });
        }
        turn += 1;
        if (turn === MAX_TURNS - 2) {
          messages.push({
            role: "user",
            content: "检索预算即将用尽：请基于已获取的信息立即输出最终 JSON，不要再调用工具。",
          });
        }
        continue;
      }

      if (res.content) {
        emit({ kind: "thought", payload: { text: res.content.slice(0, 500) } });
      }

      const parsed = validateStageOutput(stage, res.content ?? "");
      if (parsed.ok) {
        // diagnose：questionsForTeacher 非空时触发 confirm_required，不定稿
        if (stage === "diagnose") {
          const diag = parsed.value as DiagnoseOutput;
          if (diag.questionsForTeacher?.length) {
            emit({
              kind: "confirm_required",
              payload: { questions: diag.questionsForTeacher },
            });
            return;
          }
        }
        // design：引用存在性检查，不存在则闭集纠正（一次）
        if (stage === "design") {
          const refErrors = await validateDesignRefs(parsed.value as DesignOutput);
          if (refErrors.length) {
            if (refRetried) {
              emit({ kind: "error", payload: { reason: "invalid_curriculum_ref" } });
              return;
            }
            refRetried = true;
            const codes = await prisma.curriculumClause.findMany({
              where: { subject: ctx.subject },
              select: { code: true },
            });
            messages.push({ role: "assistant", content: res.content });
            messages.push({
              role: "user",
              content: `引用校验失败：\n${refErrors.join("\n")}\n以下是可用的全部课标 code，curriculumRef 只能从中选择最贴切的（逐字复制）：\n${codes
                .map((c) => `- ${c.code}`)
                .join("\n")}\n请重新输出完整 JSON。`,
            });
            continue; // 纠正轮不消耗预算
          }
        }
        await persist(lessonId, stage, parsed.value);
        await writeCitations(lessonId, stage, parsed.value);
        if (stage === "reflect") {
          await applyMemoryPatch(lessonId, parsed.value as ReflectOutput);
        }
        emit({ kind: "stage_done", payload: { output: parsed.value } });
        return;
      }

      // Schema 纠正（一次，不消耗预算）
      if (schemaRetried) {
        emit({ kind: "error", payload: { reason: "schema_invalid" } });
        return;
      }
      schemaRetried = true;
      messages.push({ role: "assistant", content: res.content });
      messages.push({
        role: "user",
        content: `你的输出未通过校验，错误如下：\n${parsed.errors.join("\n")}\n请严格按 JSON Schema 重新输出，只输出 JSON。`,
      });
    }
    emit({ kind: "error", payload: { reason: "max_turns" } });
  } catch (err) {
    emit({
      kind: "error",
      payload: { reason: err instanceof Error ? err.message : "unknown" },
    });
  }
}

function validateStageOutput(
  stage: Stage,
  content: string
): { ok: true; value: unknown } | { ok: false; errors: string[] } {
  // 从模型输出中提取 JSON（容忍 ```json 包裹与前后缀文字）
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return { ok: false, errors: ["输出中未找到 JSON 对象"] };
  let json: unknown;
  try {
    json = JSON.parse(match[0]);
  } catch (e) {
    return { ok: false, errors: [`JSON 解析失败: ${(e as Error).message}`] };
  }
  const result = STAGE_OUTPUT_SCHEMA[stage].safeParse(json);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`
      ),
    };
  }
  return { ok: true, value: result.data };
}

/** design 阶段引用存在性检查在持久化前执行（校验层职责）。 */
async function validateDesignRefs(output: DesignOutput): Promise<string[]> {
  const errors: string[] = [];
  for (const obj of output.objectives) {
    const clause = await prisma.curriculumClause.findFirst({
      where: { code: obj.curriculumRef },
    });
    if (!clause) errors.push(`objective 的 curriculumRef 不存在: ${obj.curriculumRef}`);
  }
  return errors;
}

async function persist(lessonId: string, stage: Stage, value: unknown) {
  const field = {
    diagnose: "profileJson",
    design: "designJson",
    generate: "packageJson",
    reflect: "reflectionJson",
  }[stage];
  await prisma.lesson.update({
    where: { id: lessonId },
    data: { [field]: value as object },
  });
}

/** 从阶段产物中提取 Citation 写入数据库（溯源载体）。 */
async function writeCitations(lessonId: string, stage: Stage, value: unknown) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { classMemory: true },
  });
  if (!lesson) return;
  const rows: { stage: string; citeType: string; ref: string; sourceId: string; snippet: string }[] = [];

  if (stage === "diagnose") {
    const node = await prisma.textbookNode.findFirst({
      where: { lessonTitle: { contains: lesson.title }, subject: lesson.subject },
    });
    if (node) {
      rows.push({
        stage,
        citeType: "textbook",
        ref: `教材·${lesson.grade}${node.volume}·《${node.lessonTitle}》`,
        sourceId: node.id,
        snippet: `要点：${(node.keyPoints as string[]).join("；")}；易错点：${(node.commonErrors as string[]).join("；")}`,
      });
    }
    if (lesson.classMemory) {
      const profile = lesson.classMemory.profile as {
        weakPoints?: { name: string; evidence: string }[];
      };
      rows.push({
        stage,
        citeType: "classdata",
        ref: `学情记忆·${lesson.classMemory.className}`,
        sourceId: lesson.classMemory.id,
        snippet: (profile.weakPoints ?? [])
          .map((w) => `${w.name}：${w.evidence}`)
          .join("；"),
      });
    }
  }

  if (stage === "design") {
    const out = value as DesignOutput;
    for (const obj of out.objectives) {
      const clause = await prisma.curriculumClause.findFirst({
        where: { code: obj.curriculumRef },
      });
      if (clause) {
        rows.push({
          stage,
          citeType: "curriculum",
          ref: `课标·${clause.stage}·${clause.code.split("·").slice(2, 3).join("")}`,
          sourceId: clause.id,
          snippet: clause.text,
        });
      }
    }
    for (const st of out.stages) {
      for (const c of st.citations) {
        if (c.type === "classdata" && lesson.classMemory) {
          rows.push({
            stage,
            citeType: "classdata",
            ref: `学情记忆·${lesson.classMemory.className}·环节「${st.name}」`,
            sourceId: lesson.classMemory.id,
            snippet: c.ref,
          });
        } else if (c.type === "curriculum") {
          const clause = await prisma.curriculumClause.findFirst({
            where: { code: c.ref },
          });
          if (clause) {
            rows.push({
              stage,
              citeType: "curriculum",
              ref: `课标·${clause.code}·环节「${st.name}」`,
              sourceId: clause.id,
              snippet: clause.text,
            });
          }
        } else if (c.type === "textbook") {
          const node = await prisma.textbookNode.findFirst({
            where: { lessonTitle: { contains: lesson.title }, subject: lesson.subject },
          });
          rows.push({
            stage,
            citeType: "textbook",
            ref: `教材·《${lesson.title}》·环节「${st.name}」`,
            sourceId: node?.id ?? "",
            snippet: c.ref,
          });
        }
      }
    }
  }

  if (stage === "generate") {
    // 继承 design 的目标依据，并为覆盖弱点的作业补充学情引用
    const design = lesson.designJson as DesignOutput | null;
    if (lesson.classMemory) {
      const profile = lesson.classMemory.profile as {
        weakPoints?: { name: string; evidence: string }[];
      };
      const out = value as GenerateOutput;
      const covered = new Set(
        [...out.homework.flatMap((h) => h.items), ...out.quiz].map((i) => i.knowledgePoint)
      );
      for (const w of profile.weakPoints ?? []) {
        if ([...covered].some((k) => w.name.includes(k) || k.includes(w.name))) {
          rows.push({
            stage,
            citeType: "classdata",
            ref: `学情记忆·${lesson.classMemory.className}·作业覆盖弱点「${w.name}」`,
            sourceId: lesson.classMemory.id,
            snippet: w.evidence,
          });
        }
      }
    }
    if (design) {
      for (const obj of design.objectives) {
        const clause = await prisma.curriculumClause.findFirst({
          where: { code: obj.curriculumRef },
        });
        if (clause) {
          rows.push({
            stage,
            citeType: "curriculum",
            ref: `课标·${clause.code}`,
            sourceId: clause.id,
            snippet: clause.text,
          });
        }
      }
    }
  }

  if (stage === "reflect" && lesson.classMemory) {
    rows.push({
      stage,
      citeType: "classdata",
      ref: `学情记忆·${lesson.classMemory.className}·反思写回`,
      sourceId: lesson.classMemory.id,
      snippet: "依据本次作业正确率与既有记忆画像进行复盘并增量更新。",
    });
  }

  if (rows.length) {
    await prisma.citation.createMany({ data: rows.map((r) => ({ ...r, lessonId })) });
  }
}

/** reflect 完成后由编排层写回班级记忆（不让模型直接改库）。 */
async function applyMemoryPatch(lessonId: string, output: ReflectOutput) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { classMemory: true },
  });
  const mem = lesson?.classMemory;
  if (!mem) return;

  const profile = mem.profile as {
    weakPoints: { name: string; severity: number; evidence: string; updatedAt?: string }[];
    resolved: { name: string; resolvedAt?: string }[] | string[];
  };
  const resolvedNames = new Set(output.memoryPatch.resolved);
  const now = new Date().toISOString();

  const kept = (profile.weakPoints ?? []).filter((w) => !resolvedNames.has(w.name));
  const resolvedList: { name: string; resolvedAt: string }[] = (
    Array.isArray(profile.resolved) ? profile.resolved : []
  )
    .map((r) =>
      typeof r === "string"
        ? { name: r, resolvedAt: now }
        : { name: r.name, resolvedAt: r.resolvedAt ?? now }
    )
    .concat(
      output.memoryPatch.resolved.map((name) => ({ name, resolvedAt: now }))
    );
  const newWeakPoints = output.memoryPatch.newWeakPoints.map((w) => ({
    ...w,
    updatedAt: now,
  }));

  await prisma.classMemory.update({
    where: { id: mem.id },
    data: {
      profile: {
        weakPoints: [...kept, ...newWeakPoints],
        resolved: resolvedList,
      },
    },
  });
}
