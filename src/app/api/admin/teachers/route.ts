import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 教师列表（可按认证状态过滤）。 */
export async function GET(req: NextRequest) {
  const admin = await resolveAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }
  const status = req.nextUrl.searchParams.get("status");
  const teachers = await prisma.teacher.findMany({
    where: {
      role: "teacher",
      ...(status ? { verifyStatus: status } : {}),
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      schoolStage: true,
      subject: true,
      grades: true,
      verifyStatus: true,
      verifyNote: true,
      _count: { select: { lessons: true, memories: true } },
    },
  });
  return NextResponse.json(teachers);
}

const ReviewSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["verify", "reject"]),
  note: z.string().max(200).optional(),
});

/** 审核教师身份：通过或驳回。 */
export async function PATCH(req: NextRequest) {
  const admin = await resolveAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }
  const { id, action, note } = parsed.data;

  const teacher = await prisma.teacher.findUnique({ where: { id } });
  if (!teacher || teacher.role !== "teacher") {
    return NextResponse.json({ error: "教师不存在" }, { status: 404 });
  }

  const updated = await prisma.teacher.update({
    where: { id },
    data: {
      verifyStatus: action === "verify" ? "verified" : "rejected",
      verifyNote: note ?? null,
    },
    select: { id: true, name: true, verifyStatus: true },
  });
  return NextResponse.json(updated);
}
