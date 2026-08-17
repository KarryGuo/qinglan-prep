import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "请输入邮箱和密码" }, { status: 400 });
  }

  const teacher = await prisma.teacher.findUnique({
    where: { email: parsed.data.email },
  });
  if (!teacher || !teacher.passwordHash || !verifyPassword(parsed.data.password, teacher.passwordHash)) {
    return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
  }

  const token = createSessionToken(teacher.id);
  const res = NextResponse.json({ id: teacher.id, name: teacher.name });
  res.cookies.set({ ...sessionCookieOptions, value: token });
  return res;
}
