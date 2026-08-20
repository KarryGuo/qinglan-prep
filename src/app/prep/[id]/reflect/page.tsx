"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { consumeSse, type SseEvent } from "@/lib/sse";
import type { GenerateOutput, ReflectOutput } from "@/agent/schemas";

type Lesson = {
  id: string;
  title: string;
  status: string;
  packageJson: GenerateOutput | null;
  reflectionJson: ReflectOutput | null;
};

export default function ReflectPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [accuracies, setAccuracies] = useState<Record<number, string>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [events, setEvents] = useState<{ kind: string; text: string }[]>([]);
  const [inputHint, setInputHint] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/lessons/${id}`)
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error ?? "加载失败");
        }
        return r.json() as Promise<Lesson>;
      })
      .then((d) => {
        setLesson(d);
        // 默认用 generate 产出的 quiz 初始化正确率输入
        if (d.packageJson?.quiz) {
          const init: Record<number, string> = {};
          d.packageJson.quiz.forEach((_, i) => (init[i] = ""));
          setAccuracies(init);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, [id]);

  /** 按题号回填正确率（CSV 与照片识别共用），教师核对后提交。 */
  function applyScores(entries: { no: number; pct: number }[], sourceName: string) {
    const next: Record<number, string> = { ...accuracies };
    let filled = 0;
    for (const { no, pct } of entries) {
      if (no >= 1 && no <= (lesson?.packageJson?.quiz?.length ?? 0)) {
        next[no - 1] = String(pct);
        filled++;
      }
    }
    setAccuracies(next);
    setInputHint(
      filled > 0
        ? `已从「${sourceName}」回填 ${filled} 题正确率，请核对后提交`
        : `「${sourceName}」中没有匹配到有效题目，未回填`
    );
  }

  /**
   * 解析成绩 CSV（表头需含"题号"与"正确率"列，与 Agent 的 parse_scores 工具同一规则）。
   * 正确率支持 "55%"、"55"、"0.55" 三种写法。
   */
  function parseCsvAndFill(text: string, fileName: string) {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      setInputHint(`「${fileName}」为空或缺少数据行，未回填`);
      return;
    }
    const split = (l: string) => l.split(/[,，\t]/).map((s) => s.trim());
    const header = split(lines[0]);
    const qIdx = header.findIndex((h) => h.includes("题号"));
    const rIdx = header.findIndex((h) => h.includes("正确率"));
    if (qIdx < 0 || rIdx < 0) {
      setInputHint(`「${fileName}」表头需包含"题号"与"正确率"两列，未回填`);
      return;
    }
    const entries: { no: number; pct: number }[] = [];
    for (const line of lines.slice(1)) {
      const cells = split(line);
      const no = parseInt(cells[qIdx]?.replace(/[^0-9]/g, ""), 10);
      const raw = cells[rIdx]?.replace("%", "").trim();
      const val = parseFloat(raw);
      if (!Number.isFinite(no) || !Number.isFinite(val)) continue;
      // 归一化：0-1 的小数视为比例（0.55 → 55），其余按百分数取值并截到 0-100
      const pct = val <= 1 && raw.includes(".") ? Math.round(val * 100) : Math.min(100, Math.max(0, Math.round(val)));
      entries.push({ no, pct });
    }
    applyScores(entries, fileName);
  }

  async function onCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 允许重复选择同一文件
    if (!file) return;
    const text = await file.text();
    parseCsvAndFill(text, file.name);
  }

  /** 读取图片并压缩为最长边 1600px 的 JPEG，控制上传体积（手机原图常见 3-8MB）。 */
  function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("读取图片失败"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("图片解析失败"));
        img.onload = () => {
          const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(reader.result as string); // 极端环境退回原图
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  /** 拍照/上传成绩单照片 → 视觉模型识别题号与正确率 → 自动回填。 */
  async function onImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setOcrBusy(true);
    setInputHint(`正在识别「${file.name}」…`);
    try {
      const image = await compressImage(file);
      const res = await fetch(`/api/lessons/${id}/reflect/ocr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "识别失败，请手工填写");
      applyScores(
        (d.items ?? []).map((it: { no: number; accuracy: number }) => ({ no: it.no, pct: it.accuracy })),
        `照片「${file.name}」`
      );
    } catch (err) {
      setInputHint(err instanceof Error ? err.message : "识别失败，请手工填写");
    } finally {
      setOcrBusy(false);
    }
  }

  async function submit() {
    if (!lesson?.packageJson?.quiz) return;
    const lines = lesson.packageJson.quiz.map((q, i) => {
      const v = accuracies[i]?.trim();
      return `第${i + 1}题（${q.knowledgePoint}）：${v ? `${v}%` : "未填写"}`;
    });
    const results = lines.join("；");
    setRunning(true);
    setError("");
    setEvents([]);
    try {
      await consumeSse(`/api/lessons/${id}/reflect`, { results }, (e: SseEvent) => {
        const p = e.payload as Record<string, unknown>;
        if (e.kind === "thought") setEvents((ev) => [...ev, { kind: "思考", text: String(p.text) }]);
        if (e.kind === "tool_call") setEvents((ev) => [...ev, { kind: "工具调用", text: String(p.name) }]);
        if (e.kind === "stage_done") setEvents((ev) => [...ev, { kind: "定稿", text: "反思报告已生成" }]);
        if (e.kind === "error") setEvents((ev) => [...ev, { kind: "失败", text: String(p.reason) }]);
      });
      const res = await fetch(`/api/lessons/${id}`);
      setLesson(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "执行失败");
    } finally {
      setRunning(false);
    }
  }

  if (!lesson) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-chalk-400">
        {error || "加载中…"}
      </main>
    );
  }

  const reflection = lesson.reflectionJson;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href={`/prep/${id}`} className="chalk-back">
        ← 返回流程
      </Link>
      <h1 className="chalk-text font-chalk mt-3 text-3xl font-bold text-chalk-50">
        课后反思 ·《{lesson.title}》
      </h1>
      <p className="mt-2 text-sm text-chalk-400">
        填写随堂测各题正确率，Agent 将复盘"预测 vs 实际"并更新班级学情记忆。
      </p>

      {lesson.status !== "delivered" && lesson.status !== "reflected" && (
        <p className="chalk-box-yellow mt-4 bg-chalk-yellow/5 px-3 py-2 text-sm text-chalk-200">
          请先完成备课流程（当前状态：{lesson.status}）。
        </p>
      )}

      {lesson.packageJson?.quiz && (lesson.status === "delivered" || lesson.status === "reflected") && (
        <div className="chalk-panel mt-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="chalk-yellow font-chalk text-sm font-bold">随堂测正确率（%）</h2>
            <div className="flex items-center gap-2">
              <label className={`chalk-btn-ghost cursor-pointer text-xs ${ocrBusy ? "pointer-events-none opacity-50" : ""}`}>
                {ocrBusy ? "识别中…" : "拍照识别成绩"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={onImageUpload}
                  disabled={ocrBusy}
                />
              </label>
              <label className="chalk-btn-ghost cursor-pointer text-xs">
                上传成绩 CSV
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={onCsvUpload}
                />
              </label>
            </div>
          </div>
          {inputHint && <p className="mt-2 text-xs text-chalk-400">{inputHint}</p>}
          <p className="mt-1 text-xs text-chalk-500">
            支持三种录入方式：拍照/上传成绩单图片（自动识别）、上传 CSV（"题号"与"正确率"两列，如 1,55%）、手工填写。识别结果自动回填，请核对后提交。
          </p>
          <div className="mt-3 space-y-3">
            {lesson.packageJson.quiz.map((q, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="w-16 shrink-0 text-chalk-400">第 {i + 1} 题</span>
                <span className="min-w-0 flex-1 truncate text-chalk-200" title={q.text}>
                  {q.text}
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={accuracies[i] ?? ""}
                  onChange={(e) => setAccuracies((a) => ({ ...a, [i]: e.target.value }))}
                  className="chalk-input w-24 text-right"
                  placeholder="0-100"
                />
              </div>
            ))}
          </div>
          <button onClick={submit} disabled={running} className="chalk-btn-primary mt-4 disabled:opacity-50">
            {running ? "Agent 复盘中…" : "提交并生成反思"}
          </button>
          {error && <p className="mt-2 text-sm text-chalk-pink">{error}</p>}
          {events.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-chalk-400">
              {events.map((e, i) => (
                <li key={i}>
                  [{e.kind}] {e.text.slice(0, 120)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {reflection && (
        <div className="mt-6 space-y-4">
          <div className="chalk-panel p-6">
            <h2 className="chalk-yellow font-chalk text-sm font-bold">总体判断</h2>
            <p className="mt-2 text-sm leading-6 text-chalk-200">{reflection.overall}</p>
          </div>
          <div className="chalk-panel p-6">
            <h2 className="chalk-yellow font-chalk text-sm font-bold">逐知识点：预测 vs 实际</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dashed border-chalk-50/30 text-left text-xs text-chalk-400">
                    <th className="py-2 pr-2">知识点</th>
                    <th className="py-2 pr-2">预测</th>
                    <th className="py-2 pr-2">实际</th>
                    <th className="py-2">变化</th>
                  </tr>
                </thead>
                <tbody>
                  {reflection.perKnowledgePoint.map((k, i) => (
                    <tr key={i} className="border-b border-dashed border-chalk-50/15">
                      <td className="py-2 pr-2 font-medium text-chalk-50">{k.name}</td>
                      <td className="py-2 pr-2 text-chalk-300">{k.predicted}</td>
                      <td className="py-2 pr-2 text-chalk-300">{k.actual}</td>
                      <td className="chalk-blue py-2">{k.delta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="chalk-panel p-6">
            <h2 className="chalk-yellow font-chalk text-sm font-bold">下一课建议</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-chalk-200">
              {reflection.nextLessonSuggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
          <div className="chalk-box-green bg-chalk-green/5 p-6">
            <h2 className="chalk-green font-chalk text-sm font-bold">记忆更新摘要</h2>
            {reflection.memoryPatch.resolved.length > 0 && (
              <p className="mt-2 text-sm text-chalk-200">
                已解决弱点：{reflection.memoryPatch.resolved.join("、")}
              </p>
            )}
            {reflection.memoryPatch.newWeakPoints.length > 0 && (
              <p className="mt-1 text-sm text-chalk-200">
                新增弱点：
                {reflection.memoryPatch.newWeakPoints
                  .map((w) => `${w.name}（severity ${w.severity}）`)
                  .join("、")}
              </p>
            )}
            <Link href="/class" className="chalk-green mt-3 inline-block text-sm font-medium underline">
              查看学情记忆页 →
            </Link>
          </div>
          <p className="text-center text-xs text-chalk-500">
            本内容供备课参考，教学决策由教师作出。
          </p>
        </div>
      )}
    </main>
  );
}
