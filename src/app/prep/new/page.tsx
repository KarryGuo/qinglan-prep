"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

type TextbookNode = {
  id: string;
  subject: string;
  grade: string;
  volume: string;
  lessonTitle: string;
};

const DEMO_CLASS_DESC =
  "本班 42 人，整体学习氛围较好，但上学期期末阅读题中概括段落大意的题目正确率只有 41%，多数学生概括时以偏概全、只抓细节。另外学生注意力持续时间偏短，连续讲授超过 12 分钟约半数学生走神，需要穿插互动。";

function NewLessonForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "hehua";

  const [nodes, setNodes] = useState<TextbookNode[]>([]);
  const [subject] = useState("语文");
  const [grade, setGrade] = useState("三年级");
  const [textbook] = useState("统编版");
  const [title, setTitle] = useState("");
  const [classDesc, setClassDesc] = useState("");
  const [className, setClassName] = useState("三年级 2 班");
  const [memoryId, setMemoryId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/textbook-nodes")
      .then((r) => r.json())
      .then((d) => setNodes(d.items ?? []))
      .catch(() => setError("教材节点加载失败，请刷新重试"));
    // 默认班级记忆（演示模式取种子班级）
    fetch("/api/class-memory/default")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.id && setMemoryId(d.id))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isDemo) {
      setTitle("荷花");
      setClassDesc(DEMO_CLASS_DESC);
      setGrade("三年级");
    }
  }, [isDemo]);

  const gradeOptions = useMemo(() => {
    const set = new Set(nodes.map((n) => n.grade));
    return set.size ? [...set] : ["三年级", "四年级"];
  }, [nodes]);

  const titleOptions = nodes.filter((n) => n.grade === grade);

  async function handleSubmit() {
    setError("");
    if (!title.trim()) {
      setError("请选择课题");
      return;
    }
    if (!classDesc.trim()) {
      setError("请填写班级学情描述");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          grade,
          textbook,
          title,
          classDesc,
          classMemoryId: memoryId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "创建失败");
      router.push(`/prep/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
        ← 返回首页
      </Link>
      <h1 className="mt-4 text-2xl font-bold">新建备课</h1>
      <p className="mt-1 text-sm text-slate-500">
        填写课题四要素与学情描述，Agent 将从学情诊断开始。
      </p>

      <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">学科</span>
            <input
              value={subject}
              disabled
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">教材版本</span>
            <input
              value={textbook}
              disabled
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-medium text-slate-700">年级</span>
          <select
            value={grade}
            onChange={(e) => {
              setGrade(e.target.value);
              setTitle("");
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            {gradeOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="font-medium text-slate-700">课题</span>
          <select
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="">请选择课题</option>
            {titleOptions.map((n) => (
              <option key={n.id} value={n.lessonTitle}>
                《{n.lessonTitle}》（{n.volume}）
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="font-medium text-slate-700">班级</span>
          <input
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium text-slate-700">班级学情描述</span>
          <textarea
            value={classDesc}
            onChange={(e) => setClassDesc(e.target.value)}
            rows={5}
            placeholder="描述班级整体情况、已知薄弱点、课堂习惯等"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? "创建中…" : "创建并开始备课"}
        </button>
      </div>
    </main>
  );
}

export default function NewLessonPage() {
  return (
    <Suspense>
      <NewLessonForm />
    </Suspense>
  );
}
