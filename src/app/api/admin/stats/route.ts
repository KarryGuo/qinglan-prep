import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 管理后台仪表盘统计。 */
export async function GET() {
  const admin = await resolveAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  const [
    teacherTotal,
    teacherPending,
    teacherVerified,
    lessonTotal,
    classTotal,
    curriculumTotal,
    textbookTotal,
    questionTotal,
  ] = await Promise.all([
    prisma.teacher.count({ where: { role: "teacher" } }),
    prisma.teacher.count({ where: { role: "teacher", verifyStatus: "pending" } }),
    prisma.teacher.count({ where: { role: "teacher", verifyStatus: "verified" } }),
    prisma.lesson.count(),
    prisma.classMemory.count(),
    prisma.curriculumClause.count(),
    prisma.textbookNode.count(),
    prisma.question.count(),
  ]);

  return NextResponse.json({
    teacherTotal,
    teacherPending,
    teacherVerified,
    lessonTotal,
    classTotal,
    knowledge: {
      curriculum: curriculumTotal,
      textbook: textbookTotal,
      question: questionTotal,
    },
  });
}
