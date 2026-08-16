import { prisma } from "@/lib/prisma";
import type { Stage } from "./schemas";

export type AgentEvent =
  | { kind: "stage_start"; payload: { stage: Stage } }
  | { kind: "thought"; payload: { text: string } }
  | { kind: "tool_call"; payload: { id: string; name: string; args: unknown } }
  | { kind: "tool_result"; payload: { name: string; out: unknown } }
  | { kind: "delta"; payload: { text: string } }
  | { kind: "confirm_required"; payload: { questions: string[] } }
  | { kind: "stage_done"; payload: { output: unknown } }
  | { kind: "error"; payload: { reason: string } };

export type Emitter = (event: AgentEvent) => void;

/** 事件同时写 RunEvent 表留痕，并转发给 SSE 订阅者。 */
export function makeEmitter(
  lessonId: string,
  stage: Stage,
  forward: (e: AgentEvent) => void
): Emitter {
  return (event) => {
    prisma.runEvent
      .create({
        data: {
          lessonId,
          stage,
          kind: event.kind,
          payload: event.payload as object,
        },
      })
      .catch(() => {
        /* 留痕失败不阻断主流程 */
      });
    forward(event);
  };
}
