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
  const [classes, setClasses] = useState<{ id: string; className: string }[]>([]);
  const [memoryId, setMemoryId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/textbook-nodes")
      .then((r) => r.json())
      .then((d) => setNodes(d.items ?? []))
      .catch(() => setError("教材节点加载失败，请刷新重试"));
    // 当前教师的班级列表，默认选中第一个
    fetch("/api/class-memory")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => {
        const items = d.items ?? [];
        setClasses(items);
        if (items.length > 0) setMemoryId(items[0].id);
      })
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
      <Link href="/" className="chalk-back">
        ← 返回首页
      </Link>
      <h1 className="chalk-text font-chalk mt-5 text-3xl font-bold text-chalk-50">
        新建备课
      </h1>
      <p className="mt-2 text-sm text-chalk-400">
        填写课题四要素与学情描述，Agent 将从学情诊断开始。
      </p>

      <div className="chalk-panel mt-6 space-y-4 p-6">
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="font-medium text-chalk-200">学科</span>
            <input value={subject} disabled className="chalk-input mt-1" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-chalk-200">教材版本</span>
            <input value={textbook} disabled className="chalk-input mt-1" />
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-medium text-chalk-200">年级</span>
          <select
            value={grade}
            onChange={(e) => {
              setGrade(e.target.value);
              setTitle("");
            }}
            className="chalk-input mt-1"
          >
            {gradeOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="font-medium text-chalk-200">课题</span>
          <select
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="chalk-input mt-1"
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
          <span className="font-medium text-chalk-200">班级（关联学情记忆）</span>
          <select
            value={memoryId}
            onChange={(e) => setMemoryId(e.target.value)}
            className="chalk-input mt-1"
          >
            <option value="">不关联班级记忆</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.className}
              </option>
            ))}
          </select>
          {classes.length === 0 && (
            <span className="mt-1 block text-xs text-chalk-600">
              暂无班级，可前往{" "}
              <Link href="/class" className="chalk-yellow underline">
                我的班级
              </Link>{" "}
              新建；演示模式下可不关联直接体验。
            </span>
          )}
        </label>

        <label className="block text-sm">
          <span className="font-medium text-chalk-200">班级学情描述</span>
          <textarea
            value={classDesc}
            onChange={(e) => setClassDesc(e.target.value)}
            rows={5}
            placeholder="描述班级整体情况、已知薄弱点、课堂习惯等"
            className="chalk-input mt-1"
          />
        </label>

        {error && (
          <p className="chalk-box-pink rounded-lg bg-board-950/60 px-3 py-2 text-sm text-chalk-pink">
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="chalk-btn-primary w-full"
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
