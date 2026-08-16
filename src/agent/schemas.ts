import { z } from "zod";

export const StageEnum = z.enum(["diagnose", "design", "generate", "reflect"]);
export type Stage = z.infer<typeof StageEnum>;

export const DiagnoseOutputSchema = z.object({
  summary: z.string(),
  prerequisites: z
    .array(
      z.object({
        name: z.string(),
        mastery: z.enum(["solid", "average", "weak"]),
        basis: z.string(),
      })
    )
    .min(1),
  weakPoints: z
    .array(
      z.object({
        name: z.string(),
        severity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        evidence: z.string(),
        suggestion: z.string(),
      })
    )
    .min(2)
    .max(4),
  attentionNote: z.string().optional(),
  questionsForTeacher: z.array(z.string()).optional(),
});

export const DesignOutputSchema = z.object({
  keyPoints: z.string(),
  difficultPoints: z.string(),
  objectives: z
    .array(
      z.object({
        text: z.string(),
        curriculumRef: z.string(),
      })
    )
    .min(1),
  stages: z
    .array(
      z.object({
        name: z.string(),
        minutes: z.number(),
        teacherActivity: z.string(),
        studentActivity: z.string(),
        intent: z.string(),
        citations: z.array(
          z.object({
            type: z.enum(["curriculum", "textbook", "classdata"]),
            ref: z.string(),
          })
        ),
      })
    )
    .min(3),
  boardDesign: z.string(),
});

export const GenerateOutputSchema = z.object({
  planMarkdown: z.string(),
  slides: z
    .array(
      z.object({
        pageTitle: z.string(),
        bullets: z.array(z.string()),
      })
    )
    .min(10)
    .max(14),
  board: z.string(),
  homework: z
    .array(
      z.object({
        tier: z.enum(["basic", "advanced", "extension"]),
        items: z
          .array(
            z.object({
              text: z.string(),
              answer: z.string(),
              knowledgePoint: z.string(),
            })
          )
          .min(2),
      })
    )
    .min(3),
  quiz: z
    .array(
      z.object({
        text: z.string(),
        answer: z.string(),
        knowledgePoint: z.string(),
      })
    )
    .length(5),
});

export const ReflectOutputSchema = z.object({
  overall: z.string(),
  perKnowledgePoint: z
    .array(
      z.object({
        name: z.string(),
        predicted: z.string(),
        actual: z.string(),
        delta: z.string(),
      })
    )
    .min(1),
  nextLessonSuggestions: z.array(z.string()).min(1),
  memoryPatch: z.object({
    resolved: z.array(z.string()),
    newWeakPoints: z.array(
      z.object({
        name: z.string(),
        severity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        evidence: z.string(),
      })
    ),
  }),
});

export type DiagnoseOutput = z.infer<typeof DiagnoseOutputSchema>;
export type DesignOutput = z.infer<typeof DesignOutputSchema>;
export type GenerateOutput = z.infer<typeof GenerateOutputSchema>;
export type ReflectOutput = z.infer<typeof ReflectOutputSchema>;

export const STAGE_OUTPUT_SCHEMA: Record<Stage, z.ZodTypeAny> = {
  diagnose: DiagnoseOutputSchema,
  design: DesignOutputSchema,
  generate: GenerateOutputSchema,
  reflect: ReflectOutputSchema,
};

export const STAGE_NAME: Record<Stage, string> = {
  diagnose: "学情诊断",
  design: "依标设计",
  generate: "备课包生成",
  reflect: "课后反思",
};
