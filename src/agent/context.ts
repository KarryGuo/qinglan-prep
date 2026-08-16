import { prisma } from "@/lib/prisma";
import type { Stage } from "./schemas";

/** 组装单次阶段调用的上下文：课题四要素、学情描述、上阶段产物、班级记忆。 */
export async function buildContext(
  lessonId: string,
  stage: Stage
): Promise<Record<string, string>> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { classMemory: true },
  });
  if (!lesson) throw new Error("lesson_not_found");

  const ctx: Record<string, string> = {
    subject: lesson.subject,
    grade: lesson.grade,
    textbook: lesson.textbook,
    title: lesson.title,
    classDesc: lesson.classDesc,
    memory_block: "",
    prev_output: "",
    diagnose_output: "",
    results: "",
  };

  // 班级记忆仅 diagnose 与 reflect 注入摘要（含 id，供工具调用）
  if ((stage === "diagnose" || stage === "reflect") && lesson.classMemory) {
    ctx.memory_block = `班级记忆（classMemoryId=${lesson.classMemory.id}，${lesson.classMemory.className}）：${JSON.stringify(
      lesson.classMemory.profile
    )}`;
    ctx.classMemoryId = lesson.classMemory.id;
  }

  if (stage === "design" && lesson.profileJson) {
    ctx.prev_output = JSON.stringify(lesson.profileJson);
  }
  if (stage === "generate") {
    ctx.prev_output = JSON.stringify(lesson.designJson ?? {});
    ctx.diagnose_output = JSON.stringify(lesson.profileJson ?? {});
  }
  return ctx;
}
