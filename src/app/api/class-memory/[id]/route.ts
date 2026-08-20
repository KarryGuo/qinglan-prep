import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTeacherId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 班级记忆详情与历史课列表。 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // 资源归属校验：班级学情记忆属教师私有数据，仅属主可读
  const teacherId = await resolveTeacherId();
  if (!teacherId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const memory = await prisma.classMemory.findUnique({
    where: { id },
    include: {
      lessons: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          reflectionJson: true,
        },
      },
    },
  });
  if (!memory) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (memory.teacherId !== teacherId) {
    return NextResponse.json({ error: "无权访问该班级" }, { status: 403 });
  }
  return NextResponse.json(memory);
}
