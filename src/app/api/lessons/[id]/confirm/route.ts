import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  stage: z.enum(["diagnose", "design", "generate"]),
  edits: z.string().optional(),
});

/** 状态推进：diagnose→design→generate→delivered。edits 存入学情描述附加字段，注入下一阶段。 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }

  const lesson = await prisma.lesson.findUnique({ where: { id } });
  if (!lesson) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const next: Record<string, string> = {
    diagnose: "design",
    design: "generate",
    generate: "delivered",
  };
  const expected = parsed.data.stage;
  if (lesson.status !== expected) {
    return NextResponse.json(
      { error: `当前状态为 ${lesson.status}，不能确认 ${expected}` },
      { status: 409 }
    );
  }

  const updated = await prisma.lesson.update({
    where: { id },
    data: {
      status: next[expected],
      // 教师修改意见追加到学情描述，供下一阶段上下文读取
      ...(parsed.data.edits
        ? { classDesc: `${lesson.classDesc}\n【教师修改意见】${parsed.data.edits}` }
        : {}),
    },
  });
  return NextResponse.json({ status: updated.status });
}
