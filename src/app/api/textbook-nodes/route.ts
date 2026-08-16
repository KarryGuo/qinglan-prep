import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 教材节点列表，供新建备课表单的课题下拉。 */
export async function GET() {
  const nodes = await prisma.textbookNode.findMany({
    orderBy: [{ grade: "asc" }, { lessonTitle: "asc" }],
    select: {
      id: true,
      subject: true,
      grade: true,
      volume: true,
      lessonTitle: true,
    },
  });
  return NextResponse.json({ items: nodes });
}
