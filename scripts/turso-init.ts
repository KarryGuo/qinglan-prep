/**
 * Turso 远程建表/迁移脚本（幂等）。
 *
 * 背景：Prisma CLI 的 sqlite provider 只接受 file: URL，无法对 libsql://
 * 远程库执行 db push。因此这里从 Prisma schema 生成全量建表 SQL，
 * 通过 @libsql/client 直接执行到 Turso。
 *
 * - 本地 file: 数据库直接跳过（本地请用 npx prisma db push）
 * - CREATE TABLE IF NOT EXISTS 保证重复执行安全
 * - 对已存在的旧表按列清单自动补列（schema 演进迁移）
 * - 索引在建表/补列完成后以 IF NOT EXISTS 方式创建
 */
import { execSync } from "node:child_process";
import { createClient } from "@libsql/client";

/** schema 演进中为旧表补充的列：[表名, 列名, 列定义] */
const ADD_COLUMNS: [string, string, string][] = [
  ["Teacher", "email", "TEXT"],
  ["Teacher", "passwordHash", "TEXT"],
  ["Teacher", "schoolStage", "TEXT"],
  ["Teacher", "subject", "TEXT"],
  ["Teacher", "grades", "TEXT"],
  ["Teacher", "role", "TEXT NOT NULL DEFAULT 'teacher'"],
  ["Teacher", "verifyStatus", "TEXT NOT NULL DEFAULT 'pending'"],
  ["Teacher", "verifyNote", "TEXT"],
];

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
    .replace(/CREATE UNIQUE INDEX/g, "CREATE UNIQUE INDEX IF NOT EXISTS")
    .replace(/CREATE INDEX/g, "CREATE INDEX IF NOT EXISTS")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  const tableStmts = statements.filter((s) => s.toUpperCase().startsWith("CREATE TABLE"));
  const indexStmts = statements.filter((s) => /CREATE (UNIQUE )?INDEX/i.test(s));

  const client = createClient({ url, authToken });

  // 1. 建表（不存在才建）
  for (const stmt of tableStmts) {
    await client.execute(stmt);
  }
  console.log(`[db-init] 已确保 ${tableStmts.length} 张建表语句生效`);

  // 2. 旧表补列（schema 演进迁移，幂等）
  for (const [table, column, def] of ADD_COLUMNS) {
    const info = await client.execute(`PRAGMA table_info(${table})`);
    const exists = info.rows.some((r) => r.name === column);
    if (!exists) {
      await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
      console.log(`[db-init] ${table} 新增列 ${column}`);
    }
  }

  // 3. 建索引（补列完成后，避免旧表缺列导致索引创建失败）
  for (const stmt of indexStmts) {
    await client.execute(stmt);
  }
  console.log(`[db-init] 已确保 ${indexStmts.length} 条索引语句生效`);

  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  console.log("[db-init] 现有表:", tables.rows.map((r) => r.name).join(", "));
}

main().catch((e) => {
  console.error("[db-init] 失败:", e);
  process.exit(1);
});
