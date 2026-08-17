import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { DesignOutput, GenerateOutput, DiagnoseOutput } from "@/agent/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 备课包导出：?format=md（默认 Markdown）| doc（Word 兼容 HTML）。 */
export async function GET(
  req: NextRequest,
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

  const format = req.nextUrl.searchParams.get("format") ?? "md";
  if (format === "doc") {
    const html = buildDocHtml(lesson, design, pkg);
    const filename = encodeURIComponent(`lesson-${lesson.title}.doc`);
    return new Response("\uFEFF" + html, {
      headers: {
        "Content-Type": "application/msword; charset=utf-8",
        "Content-Disposition": `attachment; filename="lesson.doc"; filename*=UTF-8''${filename}`,
      },
    });
  }

  const md = buildMarkdown(lesson, design, pkg);
  const filename = encodeURIComponent(`lesson-${lesson.title}.md`);
  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="lesson.md"; filename*=UTF-8''${filename}`,
    },
  });
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Word 兼容的 HTML 文档（.doc 打开即用，无需额外依赖）。 */
function buildDocHtml(
  lesson: { title: string; subject: string; grade: string; textbook: string },
  design: DesignOutput | null,
  pkg: GenerateOutput
): string {
  const tierName: Record<string, string> = { basic: "基础", advanced: "提高", extension: "拓展" };
  const parts: string[] = [];
  parts.push(`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(lesson.title)} 备课包</title></head><body style="font-family:'Microsoft YaHei',SimSun;font-size:12pt;line-height:1.6">`);
  parts.push(`<h1 style="text-align:center">《${esc(lesson.title)}》备课包</h1>`);
  parts.push(`<p style="text-align:center;color:#666">学科：${esc(lesson.subject)} ｜ 年级：${esc(lesson.grade)} ｜ 教材：${esc(lesson.textbook)}</p>`);
  if (design) {
    parts.push(`<h2>教学设计</h2>`);
    parts.push(`<p><b>重点</b>：${esc(design.keyPoints)}<br><b>难点</b>：${esc(design.difficultPoints)}</p>`);
    parts.push(`<h3>教学目标</h3><ol>${design.objectives.map((o) => `<li>${esc(o.text)}（依据：${esc(o.curriculumRef)}）</li>`).join("")}</ol>`);
    parts.push(`<h3>教学环节</h3><table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse"><tr><th>环节</th><th>时长</th><th>教师活动</th><th>学生活动</th><th>设计意图</th></tr>${design.stages.map((s) => `<tr><td>${esc(s.name)}</td><td>${s.minutes}分钟</td><td>${esc(s.teacherActivity)}</td><td>${esc(s.studentActivity)}</td><td>${esc(s.intent)}</td></tr>`).join("")}</table>`);
  }
  parts.push(`<h2>教案</h2>${pkg.planMarkdown.split("\n").map((l) => `<p>${esc(l) || "&nbsp;"}</p>`).join("")}`);
  parts.push(`<h2>课件大纲</h2>`);
  pkg.slides.forEach((s, i) => {
    parts.push(`<h3>第 ${i + 1} 页 ${esc(s.pageTitle)}</h3><ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`);
  });
  parts.push(`<h2>板书设计</h2>${pkg.board.split("\n").map((l) => `<p>${esc(l) || "&nbsp;"}</p>`).join("")}`);
  parts.push(`<h2>分层作业</h2>`);
  for (const h of pkg.homework) {
    parts.push(`<h3>${tierName[h.tier] ?? h.tier}</h3><ol>${h.items.map((it) => `<li>${esc(it.text)}<br>参考答案：${esc(it.answer)}（知识点：${esc(it.knowledgePoint)}）</li>`).join("")}</ol>`);
  }
  parts.push(`<h2>随堂测</h2><ol>${pkg.quiz.map((q) => `<li>${esc(q.text)}<br>参考答案：${esc(q.answer)}（知识点：${esc(q.knowledgePoint)}）</li>`).join("")}</ol>`);
  parts.push(`<hr><p style="color:#999;font-size:10pt">本内容供备课参考，教学决策由教师作出。</p></body></html>`);
  return parts.join("\n");
}

function buildMarkdown(
  lesson: { title: string; subject: string; grade: string; textbook: string; citations: { citeType: string; ref: string; snippet: string }[] },
  design: DesignOutput | null,
  pkg: GenerateOutput
): string {
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
  return lines.join("\n");
}
