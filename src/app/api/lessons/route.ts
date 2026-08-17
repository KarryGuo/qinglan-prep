import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTeacherId } from "@/lib/auth";

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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "表单不完整", detail: parsed.error.issues },
      { status: 400 }
    );
  }
  const teacherId = await resolveTeacherId();
  if (!teacherId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
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
  // 列表：返回当前教师的备课（登录教师优先，演示模式回退种子教师）
  const teacherId = await resolveTeacherId();
  if (!teacherId) return NextResponse.json({ items: [] });
  const items = await prisma.lesson.findMany({
    where: { teacherId },
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
