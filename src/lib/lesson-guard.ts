import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { resolveTeacherId } from "./auth";
import type { Lesson } from "@prisma/client";

export type LessonGuard =
  | { ok: true; lesson: Lesson }
  | { ok: false; response: NextResponse };

/**
 * 课程资源归属校验（防越权）：
 * 未解析到教师 401 / 课程不存在 404 / 非本人课程 403。
 * DEMO_MODE 下匿名会话解析为种子教师，仅能操作种子教师名下的演示课程。
 */
export async function requireLessonOwner(lessonId: string): Promise<LessonGuard> {
  const teacherId = await resolveTeacherId();
  if (!teacherId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "请先登录" }, { status: 401 }),
    };
  }
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) {
    return {
      ok: false,
      response: NextResponse.json({ error: "not_found" }, { status: 404 }),
    };
  }
  if (lesson.teacherId !== teacherId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "无权访问该课程" }, { status: 403 }),
    };
  }
  return { ok: true, lesson };
}
