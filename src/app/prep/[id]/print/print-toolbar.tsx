"use client";

import Link from "next/link";

export function PrintToolbar({ lessonId }: { lessonId: string }) {
  return (
    <div className="mb-4 flex justify-end gap-2 print:hidden">
      <Link
        href={`/prep/${lessonId}/package`}
        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100"
      >
        返回备课包
      </Link>
      <button
        onClick={() => window.print()}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        打印 / 另存为 PDF
      </button>
    </div>
  );
}
