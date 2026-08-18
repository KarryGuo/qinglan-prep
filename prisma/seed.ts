/**
 * 幂等种子脚本：教师、班级记忆、课标、教材、题库。
 * 演示用模拟数据，节选整理自公开课标文本。
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { scryptSync, randomBytes } from "node:crypto";
import path from "node:path";
import curriculum from "../src/data/curriculum.json";
import textbook from "../src/data/textbook.json";
import questions from "../src/data/questions.json";

// 与运行时保持一致：file: 相对路径解析到 prisma/ 目录下，并统一为正斜杠（libsql URL 要求）
const rawUrl = process.env.TURSO_DATABASE_URL || "file:./dev.db";
const url = rawUrl.startsWith("file:") && !path.isAbsolute(rawUrl.slice(5))
  ? "file:" + path.join(__dirname, rawUrl.slice(5).replace(/^\.\//, "")).split(path.sep).join("/")
  : rawUrl;
// adapter-libsql 6.19 的 PrismaLibSQL 是工厂类，直接接收 libsql config
const adapter = new PrismaLibSQL(
  url.startsWith("file:")
    ? { url }
    : { url, authToken: process.env.TURSO_AUTH_TOKEN ?? "" }
);
const prisma = new PrismaClient({ adapter });

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  // 管理员：存在即跳过（密码可用环境变量 ADMIN_PASSWORD 覆盖，默认 admin123）
  const adminEmail = "admin@qinglan.edu.cn";
  const admin = await prisma.teacher.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    await prisma.teacher.create({
      data: {
        name: "管理员",
        email: adminEmail,
        passwordHash: hashPassword(process.env.ADMIN_PASSWORD || "admin123"),
        role: "admin",
        verifyStatus: "verified",
      },
    });
    console.log("[seed] 创建管理员账号：", adminEmail);
  } else {
    await prisma.teacher.update({
      where: { id: admin.id },
      data: { role: "admin", verifyStatus: "verified" },
    });
    console.log("[seed] 管理员已存在，确保角色正确");
  }

  // 教师：存在即跳过（幂等入口）
  let teacher = await prisma.teacher.findFirst({ where: { name: "王老师" } });
  if (!teacher) {
    teacher = await prisma.teacher.create({
      data: {
        name: "王老师",
        prefs: { subject: "语文", defaultGrade: "三年级" },
        verifyStatus: "verified",
      },
    });
    console.log("[seed] 创建教师：王老师");
  } else {
    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { verifyStatus: "verified" },
    });
    console.log("[seed] 教师已存在，跳过");
  }

  // 班级记忆：三年级 2 班
  const existingMemory = await prisma.classMemory.findFirst({
    where: { teacherId: teacher.id, className: "三年级 2 班" },
  });
  if (!existingMemory) {
    await prisma.classMemory.create({
      data: {
        teacherId: teacher.id,
        className: "三年级 2 班",
        profile: {
          weakPoints: [
            {
              name: "段落大意概括",
              severity: 3,
              evidence: "上学期期末阅读题中，概括段意类题目班级正确率仅 41%，多数学生以偏概全、只抓细节。",
              updatedAt: new Date().toISOString(),
            },
            {
              name: "注意力持续时间短",
              severity: 2,
              evidence: "教师反馈：连续讲授超过 12 分钟后约半数学生走神，需要穿插互动与切换活动形式。",
              updatedAt: new Date().toISOString(),
            },
          ],
          resolved: [],
        },
      },
    });
    console.log("[seed] 创建班级记忆：三年级 2 班");
  } else {
    console.log("[seed] 班级记忆已存在，跳过");
  }

  // 课标条目
  for (const c of curriculum) {
    await prisma.curriculumClause.upsert({
      where: { id: c.id },
      update: { subject: c.subject, stage: c.stage, code: c.code, text: c.text },
      create: c,
    });
  }
  console.log(`[seed] 课标条目 ${curriculum.length} 条`);

  // 教材节点
  for (const t of textbook) {
    await prisma.textbookNode.upsert({
      where: { id: t.id },
      update: {
        subject: t.subject,
        grade: t.grade,
        volume: t.volume,
        lessonTitle: t.lessonTitle,
        keyPoints: t.keyPoints,
        prerequisites: t.prerequisites,
        commonErrors: t.commonErrors,
      },
      create: t,
    });
  }
  console.log(`[seed] 教材节点 ${textbook.length} 个`);

  // 题库
  for (const q of questions) {
    await prisma.question.upsert({
      where: { id: q.id },
      update: {
        subject: q.subject,
        grade: q.grade,
        knowledgePoint: q.knowledgePoint,
        tier: q.tier,
        text: q.text,
        answer: q.answer,
      },
      create: q,
    });
  }
  console.log(`[seed] 题目 ${questions.length} 道`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
