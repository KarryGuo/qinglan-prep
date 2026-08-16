import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { runStage } from "@/agent/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  results: z.string().min(1), // 各题正确率文本，如"第1题 68%；第2题 85%"
});

/** 执行 reflect 阶段并写回记忆，SSE 流式返回。 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "请填写作业结果" }, { status: 400 });
  }

  const lesson = await prisma.lesson.findUnique({ where: { id } });
  if (!lesson) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (lesson.status !== "delivered" && lesson.status !== "reflected") {
    return NextResponse.json(
      { error: "备课包尚未交付，不能进行课后反思" },
      { status: 409 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };
      let succeeded = false;
      try {
        await runStage(id, "reflect", (e) => {
          if (e.kind === "stage_done") succeeded = true;
          send(e.kind, e.payload);
        }, {
          results: parsed.data.results,
        });
        if (succeeded) {
          await prisma.lesson.update({
            where: { id },
            data: { status: "reflected" },
          });
        }
      } catch (err) {
        send("error", {
          reason: err instanceof Error ? err.message : "unknown",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
