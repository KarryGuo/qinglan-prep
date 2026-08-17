import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTeacherId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 当前教师的班级列表。 */
export async function GET() {
  const teacherId = await resolveTeacherId();
  if (!teacherId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const items = await prisma.classMemory.findMany({
    where: { teacherId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      className: true,
      updatedAt: true,
      _count: { select: { lessons: true } },
    },
  });
  return NextResponse.json({ items });
}

const CreateSchema = z.object({
  className: z.string().min(1).max(30),
});

/** 新建班级（初始记忆为空画像）。 */
export async function POST(req: NextRequest) {
  const teacherId = await resolveTeacherId();
  if (!teacherId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "请输入班级名称" }, { status: 400 });
  }
  const exists = await prisma.classMemory.findFirst({
    where: { teacherId, className: parsed.data.className },
  });
  if (exists) {
    return NextResponse.json({ error: "该班级已存在" }, { status: 409 });
  }
  const memory = await prisma.classMemory.create({
    data: {
      teacherId,
      className: parsed.data.className,
      profile: { weakPoints: [], resolved: [] },
    },
  });
  return NextResponse.json({ id: memory.id, className: memory.className });
}
