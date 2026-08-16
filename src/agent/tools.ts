import { prisma } from "@/lib/prisma";
import type { ToolDef } from "@/lib/llm";
import type { Stage } from "./schemas";

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

/** SQLite 无 ILIKE，检索用 LIKE（ASCII 天然不区分大小写，中文不受影响）。 */
function like(q: string) {
  return `%${q}%`;
}

const handlers: Record<string, ToolHandler> = {
  async search_curriculum(args) {
    const subject = String(args.subject ?? "语文");
    const query = String(args.query ?? "");
    const limit = Math.min(Number(args.limit ?? 3), 6);
    const clauses = await prisma.curriculumClause.findMany({
      where: {
        subject,
        ...(query ? { text: { contains: query } } : {}),
      },
      take: limit,
    });
    return clauses.map((c) => ({ id: c.id, code: c.code, text: c.text }));
  },

  async search_textbook(args) {
    const subject = String(args.subject ?? "语文");
    const grade = String(args.grade ?? "");
    const lessonTitle = String(args.lessonTitle ?? "");
    const node = await prisma.textbookNode.findFirst({
      where: {
        subject,
        ...(grade ? { grade } : {}),
        ...(lessonTitle ? { lessonTitle: { contains: lessonTitle } } : {}),
      },
    });
    if (!node) return null;
    return {
      id: node.id,
      lessonTitle: node.lessonTitle,
      grade: node.grade,
      volume: node.volume,
      keyPoints: node.keyPoints,
      prerequisites: node.prerequisites,
      commonErrors: node.commonErrors,
    };
  },

  async search_questions(args) {
    const subject = String(args.subject ?? "语文");
    const grade = String(args.grade ?? "");
    const knowledgePoint = String(args.knowledgePoint ?? "");
    const tier = String(args.tier ?? "");
    const limit = Math.min(Number(args.limit ?? 3), 8);
    const items = await prisma.question.findMany({
      where: {
        subject,
        ...(grade ? { grade } : {}),
        ...(knowledgePoint ? { knowledgePoint: { contains: knowledgePoint } } : {}),
        ...(tier ? { tier } : {}),
      },
      take: limit,
    });
    return items.map((q) => ({
      id: q.id,
      tier: q.tier,
      knowledgePoint: q.knowledgePoint,
      text: q.text,
      answer: q.answer,
    }));
  },

  async read_class_memory(args) {
    const id = String(args.classMemoryId ?? "");
    if (!id) throw new Error("classMemoryId 不能为空");
    const mem = await prisma.classMemory.findUnique({ where: { id } });
    if (!mem) throw new Error("班级记忆不存在");
    return { id: mem.id, className: mem.className, profile: mem.profile };
  },

  // write_class_memory 由编排层在 stage_done 后执行，不注册给模型直接调用
  async parse_scores(args) {
    const csvText = String(args.csvText ?? "");
    const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error("成绩数据为空或格式不正确");
    const header = lines[0].split(/[,，\t]/).map((s) => s.trim());
    const rows = lines.slice(1).map((l) => l.split(/[,，\t]/).map((s) => s.trim()));
    // 仅解析"题号-正确率"，不保留任何学生个人信息
    const qIdx = header.findIndex((h) => h.includes("题号"));
    const rIdx = header.findIndex((h) => h.includes("正确率"));
    if (qIdx < 0 || rIdx < 0) throw new Error("表头需包含'题号'与'正确率'列");
    return rows.map((r) => ({ questionNo: r[qIdx], accuracy: r[rIdx] }));
  },
};

export const TOOL_DEFS: Record<string, ToolDef> = {
  search_curriculum: {
    type: "function",
    function: {
      name: "search_curriculum",
      description: "检索语文课程标准条目，返回 id、code、原文。引用课标时必须使用返回的 code。",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string", description: "学科，如 语文" },
          grade: { type: "string", description: "年级，如 三年级" },
          query: { type: "string", description: "关键词，如 阅读与鉴赏、主要内容" },
          limit: { type: "number", description: "返回条数，默认 3" },
        },
        required: ["subject"],
      },
    },
  },
  search_textbook: {
    type: "function",
    function: {
      name: "search_textbook",
      description: "检索教材节点，返回要点、前置知识、易错点。",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string" },
          grade: { type: "string" },
          lessonTitle: { type: "string", description: "课题名，如 荷花" },
        },
        required: ["subject", "lessonTitle"],
      },
    },
  },
  search_questions: {
    type: "function",
    function: {
      name: "search_questions",
      description: "按知识点与难度检索题库，返回题目列表。组题时优先使用返回的题目。",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string" },
          grade: { type: "string" },
          knowledgePoint: { type: "string", description: "知识点，如 段落大意概括" },
          tier: { type: "string", enum: ["basic", "advanced", "extension"] },
          limit: { type: "number" },
        },
        required: ["subject"],
      },
    },
  },
  read_class_memory: {
    type: "function",
    function: {
      name: "read_class_memory",
      description: "读取班级学情记忆画像（弱点了表与已解决弱点）。",
      parameters: {
        type: "object",
        properties: { classMemoryId: { type: "string" } },
        required: ["classMemoryId"],
      },
    },
  },
  parse_scores: {
    type: "function",
    function: {
      name: "parse_scores",
      description: "解析成绩 CSV 文本为结构化成绩（题号、正确率），不含学生个人信息。",
      parameters: {
        type: "object",
        properties: { csvText: { type: "string" } },
        required: ["csvText"],
      },
    },
  },
};

/** 各阶段可用工具（write_class_memory 不开放给模型）。 */
export const TOOLS: Record<Stage, ToolDef[]> = {
  diagnose: [TOOL_DEFS.read_class_memory, TOOL_DEFS.search_textbook, TOOL_DEFS.parse_scores],
  design: [TOOL_DEFS.search_curriculum, TOOL_DEFS.search_textbook],
  generate: [TOOL_DEFS.search_curriculum, TOOL_DEFS.search_questions],
  reflect: [TOOL_DEFS.read_class_memory, TOOL_DEFS.parse_scores],
};

export async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const handler = handlers[name];
  if (!handler) throw new Error(`未知工具: ${name}`);
  // 入参类型与长度校验（防提示词注入导致的异常入参）
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === "string" && v.length > 20000) {
      throw new Error(`工具入参 ${k} 超长`);
    }
  }
  return handler(args);
}
