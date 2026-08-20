import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { env } from "./env";

/**
 * 轻量认证：scrypt 密码哈希 + HMAC 签名无状态会话 Cookie。
 * 不引入额外依赖；会话令牌格式 teacherId.expireTs.signature。
 */

const COOKIE_NAME = "qp_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

/** 开发环境兜底密钥的告警只输出一次 */
let devSecretWarned = false;

/**
 * 会话签名密钥：必须配置独立的 SESSION_SECRET（≥16 位）。
 * 不允许从 LLM_API_KEY 派生——密钥用途必须分离，模型密钥轮换不应导致全体会话失效。
 * 生产环境缺失即抛错拒绝降级运行；开发环境回退固定开发密钥并告警，不阻断本地调试。
 */
function secret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured && configured.length >= 16) {
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET 未配置或长度不足 16 位：请生成独立密钥（openssl rand -hex 32）并配置到环境变量"
    );
  }
  if (!devSecretWarned) {
    console.warn(
      "[auth] SESSION_SECRET 未配置，开发环境使用固定开发密钥；生产环境必须配置（openssl rand -hex 32）"
    );
    devSecretWarned = true;
  }
  return "qp-dev-only-session-secret";
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const check = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return check.length === expected.length && timingSafeEqual(check, expected);
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(teacherId: string): string {
  const expire = Date.now() + SESSION_TTL_MS;
  const payload = `${teacherId}.${expire}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [teacherId, expire, sig] = parts;
  if (sign(`${teacherId}.${expire}`) !== sig) return null;
  if (Number(expire) < Date.now()) return null;
  return teacherId;
}

export const sessionCookieOptions = {
  name: COOKIE_NAME,
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_MS / 1000,
};

/** 服务端读取当前登录教师 id（不解析数据库）。 */
export async function sessionTeacherId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * 解析当前请求应使用的教师 id：
 * 1. 已登录教师；2. DEMO_MODE 下回退到种子教师"王老师"；3. 否则 null。
 */
export async function resolveTeacherId(): Promise<string | null> {
  const sid = await sessionTeacherId();
  if (sid) return sid;
  if (env.DEMO_MODE) {
    const demo = await prisma.teacher.findFirst({ where: { name: "王老师" } });
    return demo?.id ?? null;
  }
  return null;
}

/** 校验当前会话是否为管理员，返回管理员记录或 null。 */
export async function resolveAdmin() {
  const sid = await sessionTeacherId();
  if (!sid) return null;
  const admin = await prisma.teacher.findUnique({ where: { id: sid } });
  if (!admin || admin.role !== "admin") return null;
  return admin;
}
