import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { chat } from "@/lib/llm";
import { OCR_PROMPT, extractItems } from "@/lib/ocr";
import { requireLessonOwner } from "@/lib/lesson-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** dataURL 图片（png/jpeg/webp），base64 部分约 ≤5MB（压缩后通常 <1MB） */
const BodySchema = z.object({
  image: z
    .string()
    .regex(/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/)
    .max(7_000_000),
});

/** 识别成绩单照片，返回 [{no, accuracy}] 供前端回填随堂测正确率。 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 资源归属校验：仅课程属主可使用识别
  const guard = await requireLessonOwner(id);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "仅支持 png/jpg/webp 图片，且不超过 5MB" },
      { status: 400 }
    );
  }

  try {
    const res = await chat({
      model: env.VLM_MODEL,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: parsed.data.image } },
            { type: "text", text: OCR_PROMPT },
          ],
        },
      ],
    });
    const items = extractItems(res.content ?? "");
    if (!items) {
      return NextResponse.json(
        { error: "未能从图片中识别出成绩，请手工填写" },
        { status: 422 }
      );
    }
    return NextResponse.json({ items, model: env.VLM_MODEL });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `识别失败：${err.message.slice(0, 120)}`
            : "识别失败，请稍后重试",
      },
      { status: 502 }
    );
  }
}
