"use client";

import { useCallback, useEffect, useState } from "react";

type KnowledgeInfo = {
  curriculum: { total: number; sourceTotal: number; subjects: string[] };
  textbook: { total: number; sourceTotal: number; subjects: string[]; grades: string[] };
  question: { total: number; sourceTotal: number; subjects: string[] };
};

const SOURCES = [
  {
    key: "curriculum" as const,
    title: "课程标准",
    desc: "教育部义务教育各学科课程标准条目，Agent 依标设计的依据。",
    cls: "chalk-yellow",
  },
  {
    key: "textbook" as const,
    title: "教材知识点",
    desc: "统编教材单元节点：知识点、前置知识、常见错误，供诊断与备课检索。",
    cls: "chalk-blue",
  },
  {
    key: "question" as const,
    title: "题库",
    desc: "按学科年级分层的基础/提高/拓展题目，用于生成分层作业与随堂测。",
    cls: "chalk-pink",
  },
];

export function AdminKnowledgeClient() {
  const [info, setInfo] = useState<KnowledgeInfo | null>(null);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/knowledge");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "加载失败");
      setInfo(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function sync(source: string) {
    setSyncing(source);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "同步失败");
      setMessage(`同步完成：${data.synced} 条数据已写入`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "同步失败");
    } finally {
      setSyncing("");
    }
  }

  return (
    <div>
      {error && (
        <p className="chalk-box-pink rounded-lg bg-board-950/60 px-3 py-2 text-sm text-chalk-pink">
          {error}
        </p>
      )}
      {message && (
        <p className="chalk-box-green mb-4 rounded-lg bg-chalk-green/5 px-3 py-2 text-sm text-chalk-green">
          {message}
        </p>
      )}

      {!info ? (
        <p className="mt-2 text-sm text-chalk-400">加载中…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {SOURCES.map((s) => {
            const d = info[s.key];
            const outdated = d.total < d.sourceTotal;
            return (
              <div key={s.key} className="chalk-panel flex flex-col p-5">
                <h3 className={`font-chalk text-base font-bold ${s.cls}`}>{s.title}</h3>
                <p className="mt-2 flex-1 text-xs leading-5 text-chalk-400">{s.desc}</p>

                <div className="mt-4 rounded-lg bg-board-950/50 p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-chalk-400">已入库</span>
                    <span className={`font-chalk text-xl font-bold ${s.cls}`}>
                      {d.total}
                      <span className="ml-1 text-xs font-normal text-chalk-500">
                        / 源 {d.sourceTotal}
                      </span>
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-chalk-500">
                    覆盖学科：{d.subjects.length > 0 ? d.subjects.join("、") : "暂无"}
                  </p>
                  {s.key === "textbook" && (
                    <p className="mt-1 text-xs text-chalk-500">
                      覆盖年级：{info.textbook.grades.length > 0 ? info.textbook.grades.join("、") : "暂无"}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => sync(s.key)}
                  disabled={syncing !== ""}
                  className={`mt-4 w-full rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                    outdated
                      ? "border-chalk-yellow/60 bg-chalk-yellow/10 text-chalk-yellow hover:bg-chalk-yellow/20"
                      : "border-chalk-50/25 text-chalk-300 hover:border-chalk-50/50"
                  }`}
                >
                  {syncing === s.key ? "同步中…" : outdated ? "同步更新数据" : "重新同步（幂等）"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-chalk-500">
        演示环境使用内置数据源模拟教育部义务教育阶段数据下发；同步为幂等操作，可重复执行。
      </p>
    </div>
  );
}
