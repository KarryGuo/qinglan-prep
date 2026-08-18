"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const STAGES = ["小学", "初中"] as const;
const SUBJECTS = ["语文", "数学", "英语", "道德与法治", "科学", "历史", "地理", "物理", "化学", "生物"];
const GRADES_PRIMARY = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"];
const GRADES_JUNIOR = ["七年级", "八年级", "九年级"];

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 登录
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 注册
  const [name, setName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [schoolStage, setSchoolStage] = useState<(typeof STAGES)[number]>("小学");
  const [subject, setSubject] = useState("语文");
  const [grades, setGrades] = useState<string[]>([]);

  const gradeOptions = schoolStage === "小学" ? GRADES_PRIMARY : GRADES_JUNIOR;

  function toggleGrade(g: string) {
    setGrades((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  }

  async function handleLogin() {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "登录失败");
      router.push(data.role === "admin" ? "/admin" : "/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
      setSubmitting(false);
    }
  }

  async function handleRegister() {
    setError("");
    if (grades.length === 0) {
      setError("请至少选择一个任教年级");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: regEmail,
          password: regPassword,
          schoolStage,
          subject,
          grades: grades.join(","),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "注册失败");
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "注册失败");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <Link href="/" className="chalk-back">
        ← 返回首页
      </Link>
      <h1 className="chalk-text font-chalk mt-5 text-3xl font-bold text-chalk-50">
        {tab === "login" ? "教师登录" : "教师注册"}
      </h1>
      <p className="mt-2 text-sm text-chalk-400">
        {tab === "login"
          ? "登录后备课记录与班级学情记忆将保存在您的账号下。"
          : "注册时选择您的任教身份，后续备课将按您的学段学科推荐内容。"}
      </p>

      {/* Tab 切换 */}
      <div className="chalk-panel mt-6 flex p-1">
        {(["login", "register"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setError("");
            }}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition ${
              tab === t
                ? "bg-chalk-yellow text-board-950"
                : "text-chalk-400 hover:text-chalk-50"
            }`}
          >
            {t === "login" ? "登录" : "注册"}
          </button>
        ))}
      </div>

      <div className="chalk-panel mt-4 space-y-4 p-6">
        {tab === "login" ? (
          <>
            <label className="block text-sm">
              <span className="font-medium text-chalk-200">邮箱</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="chalk-input mt-1"
                placeholder="you@school.edu.cn"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-chalk-200">密码</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="chalk-input mt-1"
              />
            </label>
            <button
              onClick={handleLogin}
              disabled={submitting}
              className="chalk-btn-primary w-full"
            >
              {submitting ? "登录中…" : "登录"}
            </button>
          </>
        ) : (
          <>
            <label className="block text-sm">
              <span className="font-medium text-chalk-200">姓名</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="chalk-input mt-1"
                placeholder="如：李老师"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-chalk-200">邮箱</span>
              <input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="chalk-input mt-1"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-chalk-200">密码（至少 6 位）</span>
              <input
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="chalk-input mt-1"
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm">
                <span className="font-medium text-chalk-200">学段</span>
                <select
                  value={schoolStage}
                  onChange={(e) => {
                    setSchoolStage(e.target.value as (typeof STAGES)[number]);
                    setGrades([]);
                  }}
                  className="chalk-input mt-1"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-chalk-200">任教学科</span>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="chalk-input mt-1"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="text-sm">
              <span className="font-medium text-chalk-200">任教年级（可多选）</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {gradeOptions.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGrade(g)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      grades.includes(g)
                        ? "chalk-yellow border-chalk-yellow/70 bg-chalk-yellow/10 font-semibold"
                        : "border-chalk-50/30 text-chalk-400 hover:border-chalk-50/60"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleRegister}
              disabled={submitting}
              className="chalk-btn-primary w-full"
            >
              {submitting ? "注册中…" : "注册并登录"}
            </button>
          </>
        )}

        {error && (
          <p className="chalk-box-pink rounded-lg bg-board-950/60 px-3 py-2 text-sm text-chalk-pink">
            {error}
          </p>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-chalk-600">
        演示模式下未登录也可体验示范课（使用内置演示账号数据）。
      </p>
      <p className="mt-2 text-center text-xs text-chalk-600">
        管理员演示账号：admin@qinglan.edu.cn / admin123
      </p>
    </main>
  );
}
