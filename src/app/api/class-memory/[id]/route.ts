import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 班级记忆详情与历史课列表。 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const memory = await prisma.classMemory.findUnique({
    where: { id },
    include: {
      lessons: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          reflectionJson: true,
        },
      },
    },
  });
  if (!memory) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(memory);
}
