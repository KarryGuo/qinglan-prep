import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  subject: z.string().min(1),
  grade: z.string().min(1),
  textbook: z.string().min(1),
  title: z.string().min(1),
  classDesc: z.string().min(1),
  classMemoryId: z.string().optional(),
});

async function demoTeacherId(): Promise<string> {
  const teacher = await prisma.teacher.findFirst({ where: { name: "王老师" } });
  if (!teacher) throw new Error("种子教师不存在，请先运行 seed");
  return teacher.id;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "表单不完整", detail: parsed.error.issues },
      { status: 400 }
    );
  }
  const teacherId = await demoTeacherId();
  const lesson = await prisma.lesson.create({
    data: {
      teacherId,
      subject: parsed.data.subject,
      grade: parsed.data.grade,
      textbook: parsed.data.textbook,
      title: parsed.data.title,
      classDesc: parsed.data.classDesc,
      classMemoryId: parsed.data.classMemoryId || null,
      status: "diagnose",
    },
  });
  return NextResponse.json({ id: lesson.id });
}

export async function GET() {
  // 列表：返回当前教师的备课（演示模式）
  const teacher = await prisma.teacher.findFirst({ where: { name: "王老师" } });
  if (!teacher) return NextResponse.json({ items: [] });
  const items = await prisma.lesson.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      grade: true,
      status: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ items });
}
