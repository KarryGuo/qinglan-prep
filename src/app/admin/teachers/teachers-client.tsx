"use client";

import { useCallback, useEffect, useState } from "react";

type Teacher = {
  id: string;
  name: string;
  email: string | null;
  schoolStage: string | null;
  subject: string | null;
  grades: string | null;
  verifyStatus: string;
  verifyNote: string | null;
  _count: { lessons: number; memories: number };
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "待审核", cls: "chalk-orange border-chalk-orange/60 bg-chalk-orange/10" },
  verified: { label: "已认证", cls: "chalk-green border-chalk-green/60 bg-chalk-green/10" },
  rejected: { label: "已驳回", cls: "chalk-pink border-chalk-pink/60 bg-chalk-pink/10" },
};

const FILTERS = [
  { value: "", label: "全部" },
  { value: "pending", label: "待审核" },
  { value: "verified", label: "已认证" },
  { value: "rejected", label: "已驳回" },
];

export function AdminTeachersClient() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (status: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/teachers${status ? `?status=${status}` : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "加载失败");
      setTeachers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  async function review(id: string, action: "verify" | "reject") {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch("/api/admin/teachers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "操作失败");
      await load(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              filter === f.value
                ? "chalk-yellow border-chalk-yellow/70 bg-chalk-yellow/10"
                : "border-chalk-50/25 text-chalk-400 hover:border-chalk-50/50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="chalk-box-pink mt-4 rounded-lg bg-board-950/60 px-3 py-2 text-sm text-chalk-pink">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-chalk-400">加载中…</p>
      ) : teachers.length === 0 ? (
        <p className="chalk-box mt-6 bg-board-950/40 p-6 text-sm text-chalk-400">
          暂无{FILTERS.find((f) => f.value === filter)?.label ?? ""}教师。
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {teachers.map((t) => {
            const meta = STATUS_META[t.verifyStatus] ?? STATUS_META.pending;
            return (
              <li key={t.id} className="chalk-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-chalk font-semibold text-chalk-50">{t.name}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-chalk-400">
                      {t.email ?? "无邮箱"} ｜ {t.schoolStage ?? "—"} · {t.subject ?? "—"} ·{" "}
                      {t.grades ?? "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-chalk-500">
                      备课 {t._count.lessons} 节 · 班级 {t._count.memories} 个
                    </p>
                    {t.verifyNote && (
                      <p className="mt-1 text-xs text-chalk-orange">备注：{t.verifyNote}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {t.verifyStatus !== "verified" && (
                      <button
                        onClick={() => review(t.id, "verify")}
                        disabled={busyId === t.id}
                        className="rounded-lg border border-chalk-green/60 bg-chalk-green/10 px-3 py-1.5 text-xs font-semibold text-chalk-green transition hover:bg-chalk-green/20 disabled:opacity-50"
                      >
                        通过认证
                      </button>
                    )}
                    {t.verifyStatus !== "rejected" && (
                      <button
                        onClick={() => review(t.id, "reject")}
                        disabled={busyId === t.id}
                        className="rounded-lg border border-chalk-pink/60 bg-chalk-pink/10 px-3 py-1.5 text-xs font-semibold text-chalk-pink transition hover:bg-chalk-pink/20 disabled:opacity-50"
                      >
                        驳回
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
