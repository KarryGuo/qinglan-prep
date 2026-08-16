import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 演示模式默认班级记忆（种子教师的首个班级）。 */
export async function GET() {
  const memory = await prisma.classMemory.findFirst({
    orderBy: { updatedAt: "asc" },
    select: { id: true, className: true },
  });
  if (!memory) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(memory);
}
