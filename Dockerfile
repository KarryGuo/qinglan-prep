# syntax=docker/dockerfile:1

# ---------- 依赖安装 ----------
# 用 Debian slim 而非 alpine：@libsql/client 的原生预编译绑定按 glibc 发布（与 Render 运行时一致）
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- 构建 ----------
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ---------- 运行 ----------
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd -r app && useradd -r -g app app

# Next.js standalone 产物（含 server.js 与文件追踪出的精简 node_modules）
COPY --from=builder --chown=app:app /app/.next/standalone ./
# 静态资源（CDN/浏览器侧 JS/CSS）
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
# Prisma 生成客户端（显式拷贝，防止文件追踪遗漏；driver adapter 模式运行时不加载引擎）
COPY --from=builder --chown=app:app /app/node_modules/.prisma ./node_modules/.prisma

USER app
EXPOSE 3000
CMD ["node", "server.js"]
