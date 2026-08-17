import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTeacherId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 当前教师的默认班级记忆（最早创建的班级）。 */
export async function GET() {
  const teacherId = await resolveTeacherId();
  if (!teacherId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const memory = await prisma.classMemory.findFirst({
    where: { teacherId },
    orderBy: { updatedAt: "asc" },
    select: { id: true, className: true },
  });
  if (!memory) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(memory);
}
