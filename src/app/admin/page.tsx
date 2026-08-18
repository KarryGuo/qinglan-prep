import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [
    teacherTotal,
    teacherPending,
    teacherVerified,
    lessonTotal,
    classTotal,
    curriculumTotal,
    textbookTotal,
    questionTotal,
  ] = await Promise.all([
    prisma.teacher.count({ where: { role: "teacher" } }),
    prisma.teacher.count({ where: { role: "teacher", verifyStatus: "pending" } }),
    prisma.teacher.count({ where: { role: "teacher", verifyStatus: "verified" } }),
    prisma.lesson.count(),
    prisma.classMemory.count(),
    prisma.curriculumClause.count(),
    prisma.textbookNode.count(),
    prisma.question.count(),
  ]);

  const stats = [
    { label: "注册教师", value: teacherTotal, cls: "chalk-blue", href: "/admin/teachers" },
    { label: "待认证教师", value: teacherPending, cls: "chalk-orange", href: "/admin/teachers" },
    { label: "已认证教师", value: teacherVerified, cls: "chalk-green", href: "/admin/teachers" },
    { label: "备课总数", value: lessonTotal, cls: "chalk-yellow", href: null },
    { label: "班级学情", value: classTotal, cls: "chalk-pink", href: null },
  ];

  return (
    <div className="space-y-6">
      <section>
        <h2 className="chalk-yellow font-chalk text-lg font-bold">运营概况</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => {
            const card = (
              <div className="chalk-panel p-4 text-center transition hover:border-chalk-yellow/50">
                <p className={`font-chalk text-3xl font-bold ${s.cls}`}>{s.value}</p>
                <p className="mt-1 text-xs text-chalk-400">{s.label}</p>
              </div>
            );
            return s.href ? (
              <Link key={s.label} href={s.href}>
                {card}
              </Link>
            ) : (
              <div key={s.label}>{card}</div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="chalk-yellow font-chalk text-lg font-bold">知识库（教育部同步数据）</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div className="chalk-panel p-4">
            <p className="chalk-blue font-chalk text-2xl font-bold">{curriculumTotal}</p>
            <p className="mt-1 text-xs text-chalk-400">课程标准条目</p>
          </div>
          <div className="chalk-panel p-4">
            <p className="chalk-green font-chalk text-2xl font-bold">{textbookTotal}</p>
            <p className="mt-1 text-xs text-chalk-400">教材知识点节点</p>
          </div>
          <div className="chalk-panel p-4">
            <p className="chalk-pink font-chalk text-2xl font-bold">{questionTotal}</p>
            <p className="mt-1 text-xs text-chalk-400">题库题目</p>
          </div>
        </div>
        <Link
          href="/admin/knowledge"
          className="chalk-btn-ghost mt-4 inline-block"
        >
          管理知识库同步 →
        </Link>
      </section>

      {teacherPending > 0 && (
        <p className="chalk-box-yellow bg-chalk-yellow/5 px-4 py-3 text-sm text-chalk-200">
          有 <span className="chalk-yellow font-bold">{teacherPending}</span> 位教师提交了身份认证申请，等待审核。
          <Link href="/admin/teachers" className="chalk-yellow ml-2 underline">
            前往审核 →
          </Link>
        </p>
      )}
    </div>
  );
}
