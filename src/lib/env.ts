import path from "node:path";

/**
 * 数据库地址解析：
 * - Turso：libsql://xxx.turso.io（运行时配 TURSO_AUTH_TOKEN）
 * - 本地：file:./dev.db，统一解析到 <项目根>/prisma/dev.db，
 *   与 Prisma CLI（相对 schema 目录解析）保持一致。
 */
function resolveDbUrl(url: string): string {
  if (url.startsWith("file:")) {
    const p = url.slice(5);
    if (!path.isAbsolute(p)) {
      const abs = path.join(process.cwd(), "prisma", p.replace(/^\.\//, ""));
      return "file:" + abs.split(path.sep).join("/");
    }
    return "file:" + p.split(path.sep).join("/");
  }
  return url;
}

const rawDbUrl = process.env.TURSO_DATABASE_URL || "file:./dev.db";

export const env = {
  TURSO_DATABASE_URL: resolveDbUrl(rawDbUrl),
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN ?? "",
  LLM_BASE_URL: process.env.LLM_BASE_URL ?? "https://api.deepseek.com",
  LLM_API_KEY: process.env.LLM_API_KEY ?? "",
  LLM_MODEL: process.env.LLM_MODEL ?? "deepseek-chat",
  // 视觉模型（作业照片识别），需与 LLM_API_KEY 同服务且支持 image_url 输入
  VLM_MODEL: process.env.VLM_MODEL ?? "qwen-vl-plus",
  DEMO_MODE: process.env.DEMO_MODE !== "false",
};
