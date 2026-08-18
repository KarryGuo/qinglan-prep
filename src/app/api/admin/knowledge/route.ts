import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveAdmin } from "@/lib/auth";
import curriculum from "@/data/curriculum.json";
import textbook from "@/data/textbook.json";
import questions from "@/data/questions.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 知识库概况：各来源条目数与覆盖学科。 */
export async function GET() {
  const admin = await resolveAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  const [curriculums, textbooks, qs] = await Promise.all([
    prisma.curriculumClause.findMany({ select: { subject: true } }),
    prisma.textbookNode.findMany({ select: { subject: true, grade: true } }),
    prisma.question.findMany({ select: { subject: true } }),
  ]);

  const uniq = (arr: string[]) => [...new Set(arr)].sort();
  return NextResponse.json({
    curriculum: {
      total: curriculums.length,
      sourceTotal: curriculum.length,
      subjects: uniq(curriculums.map((c) => c.subject)),
    },
    textbook: {
      total: textbooks.length,
      sourceTotal: textbook.length,
      subjects: uniq(textbooks.map((t) => t.subject)),
      grades: uniq(textbooks.map((t) => t.grade)),
    },
    question: {
      total: qs.length,
      sourceTotal: questions.length,
      subjects: uniq(qs.map((q) => q.subject)),
    },
  });
}

const SyncSchema = z.object({
  source: z.enum(["curriculum", "textbook", "question"]),
});

/** 从内置数据源同步（模拟教育部义务教育数据下发），幂等 upsert。 */
export async function POST(req: NextRequest) {
  const admin = await resolveAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = SyncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }

  const { source } = parsed.data;
  let count = 0;

  if (source === "curriculum") {
    for (const c of curriculum) {
      await prisma.curriculumClause.upsert({
        where: { id: c.id },
        update: { subject: c.subject, stage: c.stage, code: c.code, text: c.text },
        create: c,
      });
      count++;
    }
  } else if (source === "textbook") {
    for (const t of textbook) {
      await prisma.textbookNode.upsert({
        where: { id: t.id },
        update: {
          subject: t.subject,
          grade: t.grade,
          volume: t.volume,
          lessonTitle: t.lessonTitle,
          keyPoints: t.keyPoints,
          prerequisites: t.prerequisites,
          commonErrors: t.commonErrors,
        },
        create: t,
      });
      count++;
    }
  } else {
    for (const q of questions) {
      await prisma.question.upsert({
        where: { id: q.id },
        update: {
          subject: q.subject,
          grade: q.grade,
          knowledgePoint: q.knowledgePoint,
          tier: q.tier,
          text: q.text,
          answer: q.answer,
        },
        create: q,
      });
      count++;
    }
  }

  return NextResponse.json({ source, synced: count });
}
