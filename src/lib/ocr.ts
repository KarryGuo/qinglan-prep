/**
 * 成绩单照片识别（多模态）：共享提示词与解析逻辑。
 * 生产入口 src/app/api/lessons/[id]/reflect/ocr/route.ts，
 * 评测入口 eval/run.ts 复用同一份代码，保证测的就是产品链路。
 */

/** 成绩识别提示词：输出严格 JSON 数组，小数比例自动归一化为百分比。 */
export const OCR_PROMPT = `你是小学语文课堂的成绩记录识别助手。图中是一份随堂测/作业的成绩记录（可能是表格截图、纸质成绩单照片或教务系统页面）。
请识别每一道题的题号与该题的正确率（百分比）。
要求：
1. 只输出一个 JSON 数组，格式示例：[{"no":1,"accuracy":55},{"no":2,"accuracy":80}]，不要输出任何其他文字或解释。
2. accuracy 为 0-100 的整数；若图中写的是 0-1 的小数（如 0.55），请乘以 100（即 55）。
3. 某题无法辨认正确率时跳过该题，不要猜测。
4. 图中没有可识别的题号与正确率时输出 []。`;

export type OcrItem = { no: number; accuracy: number };

/** 从模型回复中提取 JSON 数组（容忍 markdown 代码块包裹），并截取 0-100。 */
export function extractItems(text: string): OcrItem[] | null {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return null;
  try {
    const arr = JSON.parse(m[0]) as unknown;
    if (!Array.isArray(arr)) return null;
    const items: OcrItem[] = [];
    for (const el of arr) {
      if (typeof el !== "object" || el === null) continue;
      const no = Number((el as Record<string, unknown>).no);
      const accuracy = Number((el as Record<string, unknown>).accuracy);
      if (!Number.isInteger(no) || !Number.isFinite(accuracy)) continue;
      items.push({
        no,
        accuracy: Math.min(100, Math.max(0, Math.round(accuracy))),
      });
    }
    return items;
  } catch {
    return null;
  }
}
