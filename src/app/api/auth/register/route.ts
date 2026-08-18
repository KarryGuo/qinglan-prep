import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RegisterSchema = z.object({
  name: z.string().min(1).max(20),
  email: z.string().email(),
  password: z.string().min(6).max(64),
  schoolStage: z.enum(["小学", "初中"]),
  subject: z.string().min(1),
  grades: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "注册信息不完整", detail: parsed.error.issues },
      { status: 400 }
    );
  }
  const { name, email, password, schoolStage, subject, grades } = parsed.data;

  const exists = await prisma.teacher.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
  }

  const teacher = await prisma.teacher.create({
    data: {
      name,
      email,
      passwordHash: hashPassword(password),
      schoolStage,
      subject,
      grades,
      role: "teacher",
      verifyStatus: "pending",
    },
  });

  const token = createSessionToken(teacher.id);
  const res = NextResponse.json({ id: teacher.id, name: teacher.name });
  res.cookies.set({ ...sessionCookieOptions, value: token });
  return res;
}
