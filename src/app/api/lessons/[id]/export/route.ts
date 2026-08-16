import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { DesignOutput, GenerateOutput, DiagnoseOutput } from "@/agent/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 备课包 Markdown 导出。 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: { citations: true },
  });
  if (!lesson) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const pkg = lesson.packageJson as GenerateOutput | null;
  const design = lesson.designJson as DesignOutput | null;
  if (!pkg) {
    return NextResponse.json({ error: "备课包尚未生成" }, { status: 409 });
  }

  const lines: string[] = [];
  lines.push(`# 《${lesson.title}》备课包`);
  lines.push("");
  lines.push(`学科：${lesson.subject} ｜ 年级：${lesson.grade} ｜ 教材：${lesson.textbook}`);
  lines.push("");
  if (design) {
    lines.push("## 教学设计");
    lines.push(`**重点**：${design.keyPoints}`);
    lines.push(`**难点**：${design.difficultPoints}`);
    lines.push("");
    lines.push("### 教学目标");
    design.objectives.forEach((o, i) => {
      lines.push(`${i + 1}. ${o.text}（依据：${o.curriculumRef}）`);
    });
    lines.push("");
    lines.push("### 教学环节");
    lines.push("| 环节 | 时长 | 教师活动 | 学生活动 | 设计意图 |");
    lines.push("|---|---|---|---|---|");
    for (const s of design.stages) {
      lines.push(
        `| ${s.name} | ${s.minutes}分钟 | ${s.teacherActivity} | ${s.studentActivity} | ${s.intent} |`
      );
    }
    lines.push("");
  }
  lines.push("## 教案");
  lines.push(pkg.planMarkdown);
  lines.push("");
  lines.push("## 课件大纲");
  pkg.slides.forEach((s, i) => {
    lines.push(`### 第 ${i + 1} 页 ${s.pageTitle}`);
    s.bullets.forEach((b) => lines.push(`- ${b}`));
    lines.push("");
  });
  lines.push("## 板书设计");
  lines.push(pkg.board);
  lines.push("");
  lines.push("## 分层作业");
  const tierName = { basic: "基础", advanced: "提高", extension: "拓展" } as const;
  for (const h of pkg.homework) {
    lines.push(`### ${tierName[h.tier] ?? h.tier}`);
    h.items.forEach((item, i) => {
      lines.push(`${i + 1}. ${item.text}`);
      lines.push(`   参考答案：${item.answer}（知识点：${item.knowledgePoint}）`);
    });
    lines.push("");
  }
  lines.push("## 随堂测");
  pkg.quiz.forEach((q, i) => {
    lines.push(`${i + 1}. ${q.text}`);
    lines.push(`   参考答案：${q.answer}（知识点：${q.knowledgePoint}）`);
  });
  lines.push("");
  lines.push("## 引用依据");
  for (const c of lesson.citations) {
    lines.push(`- [${c.citeType}] ${c.ref}：${c.snippet.slice(0, 80)}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("本内容供备课参考，教学决策由教师作出。");

  const md = lines.join("\n");
  const filename = encodeURIComponent(`lesson-${lesson.title}.md`);
  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="lesson.md"; filename*=UTF-8''${filename}`,
    },
  });
}
