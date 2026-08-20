import { env } from "./env";

/** 多模态内容分片：文本或图片（dataURL / 公网 URL）。 */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ContentPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ChatResponse = {
  content: string | null;
  tool_calls?: ToolCall[];
};

/** OpenAI 兼容客户端，带指数退避重试（最多 2 次重试）。 */
export async function chat(opts: {
  messages: ChatMessage[];
  tools?: ToolDef[];
  tool_choice?: "auto" | "none";
  temperature?: number;
  /** 覆盖默认文本模型（如视觉模型 VLM_MODEL） */
  model?: string;
}): Promise<ChatResponse> {
  const body: Record<string, unknown> = {
    model: opts.model ?? env.LLM_MODEL,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.4,
  };
  if (opts.tools?.length) {
    body.tools = opts.tools;
    body.tool_choice = opts.tool_choice ?? "auto";
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 120_000);
      const res = await fetch(`${env.LLM_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.LLM_API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const err = new Error(`llm_http_${res.status}: ${text.slice(0, 200)}`);
        // 仅 5xx / 429 可重试；4xx（如 401 鉴权失败）直接抛出
        if (res.status < 500 && res.status !== 429) throw err;
        throw new RetryableError(err.message);
      }
      const data = await res.json();
      const choice = data.choices?.[0]?.message;
      return {
        content: choice?.content ?? null,
        tool_calls: choice?.tool_calls,
      };
    } catch (err) {
      lastErr = err;
      if (!(err instanceof RetryableError)) throw err;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("llm_timeout");
}

class RetryableError extends Error {}
