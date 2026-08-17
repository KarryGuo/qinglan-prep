import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionTeacherId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const teacherId = await sessionTeacherId();
  if (!teacherId) {
    return NextResponse.json({ loggedIn: false });
  }
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: {
      id: true,
      name: true,
      email: true,
      schoolStage: true,
      subject: true,
      grades: true,
    },
  });
  if (!teacher) {
    return NextResponse.json({ loggedIn: false });
  }
  return NextResponse.json({ loggedIn: true, teacher });
}
