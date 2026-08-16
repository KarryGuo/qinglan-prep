/**
 * Turso 远程建表脚本（幂等）。
 *
 * 背景：Prisma CLI 的 sqlite provider 只接受 file: URL，无法对 libsql://
 * 远程库执行 db push。因此这里从 Prisma schema 生成全量建表 SQL，
 * 通过 @libsql/client 直接执行到 Turso。
 *
 * - 本地 file: 数据库直接跳过（本地请用 npx prisma db push）
 * - CREATE TABLE IF NOT EXISTS 保证重复执行安全
 */
import { execSync } from "node:child_process";
import { createClient } from "@libsql/client";

async function main() {
  const url = process.env.TURSO_DATABASE_URL ?? "";
  const authToken = process.env.TURSO_AUTH_TOKEN ?? "";

  if (!url || url.startsWith("file:")) {
    console.log("[db-init] 本地文件数据库，跳过远程建表");
    return;
  }

  const sql = execSync(
    "npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script",
    { encoding: "utf-8" }
  );

  const statements = sql
    .replace(/CREATE TABLE/g, "CREATE TABLE IF NOT EXISTS")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const client = createClient({ url, authToken });
  for (const stmt of statements) {
    await client.execute(stmt);
  }
  console.log(`[db-init] 已确保 ${statements.length} 条建表语句生效`);

  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  console.log("[db-init] 现有表:", tables.rows.map((r) => r.name).join(", "));
}

main().catch((e) => {
  console.error("[db-init] 失败:", e);
  process.exit(1);
});
