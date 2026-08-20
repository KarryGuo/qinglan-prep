import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLessonOwner } from "@/lib/lesson-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // 资源归属校验：课程详情（含各阶段产物、执行事件、班级记忆）仅属主可读
  const guard = await requireLessonOwner(id);
  if (!guard.ok) return guard.response;

  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      citations: true,
      events: { orderBy: { createdAt: "asc" } },
      classMemory: true,
    },
  });
  if (!lesson) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(lesson);
}
