"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClassListClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function createClass() {
    setError("");
    if (!name.trim()) {
      setError("请输入班级名称");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/class-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ className: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "创建失败");
      router.refresh();
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="班级名称，如：三年级 1 班"
        className="chalk-input flex-1"
      />
      <button
        onClick={createClass}
        disabled={submitting}
        className="chalk-btn-primary disabled:opacity-50"
      >
        {submitting ? "创建中…" : "新建班级"}
      </button>
      {error && <p className="text-xs text-chalk-pink">{error}</p>}
    </div>
  );
}
