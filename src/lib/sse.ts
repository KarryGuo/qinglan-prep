"use client";

export type SseEvent = { kind: string; payload: unknown };

/** POST 方式的 SSE 消费（EventSource 只支持 GET）。 */
export async function consumeSse(
  url: string,
  body: unknown,
  onEvent: (e: SseEvent) => void
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `请求失败（${res.status}）`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      let kind = "message";
      let data = "";
      for (const line of part.split("\n")) {
        if (line.startsWith("event:")) kind = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        onEvent({ kind, payload: JSON.parse(data) });
      } catch {
        /* 忽略无法解析的行 */
      }
    }
  }
}
