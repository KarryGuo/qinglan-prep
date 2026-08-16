import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { env } from "./env";

// 本地开发允许使用 file: 协议的 SQLite，便于无 Turso 账号时调试
function buildConfig() {
  if (env.TURSO_DATABASE_URL.startsWith("file:")) {
    return { url: env.TURSO_DATABASE_URL };
  }
  return {
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  };
}

// adapter-libsql 6.19 的 PrismaLibSQL 是工厂类，接收 libsql config
const adapter = new PrismaLibSQL(buildConfig());

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
