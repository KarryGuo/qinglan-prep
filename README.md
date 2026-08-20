# 青蓝备课 Qinglan

**让每一节课，都有备而来** —— 从学情诊断开始的备课 Agent。

教师输入课题与班级学情，Agent 完成"诊—设—生—思"四阶段闭环：学情诊断 → 依标设计 → 备课包生成 → 课后反思与记忆写回。每一步思考与工具调用都留痕、可追溯，每个设计点都能点开看依据。

<!-- 产品截图占位 -->

## 在线体验

推送到 main 后 GitHub Actions 自动构建 Docker 镜像，在 Sealos（或任意容器平台）拉起即可，见下方「部署」章节。

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env   # 填入 LLM_API_KEY 等

# 3. 初始化数据库、种子数据并启动
npx prisma db push && npm run seed && npm run dev

# 4.（可选）运行 Agent 评测：3 用例 × 4 阶段 + 多模态照片识别，生成量化评测报告
npm run eval
```

环境变量（见 `.env.example`）：

| 变量 | 说明 |
|---|---|
| `TURSO_DATABASE_URL` | Turso libSQL 地址；本地开发可用 `file:./dev.db` |
| `TURSO_AUTH_TOKEN` | Turso 访问令牌（本地文件库可留空） |
| `LLM_BASE_URL` | OpenAI 兼容接口地址（默认通义千问 DashScope） |
| `LLM_API_KEY` | 大模型 API 密钥 |
| `LLM_MODEL` | 文本模型名（默认 `qwen-plus`） |
| `VLM_MODEL` | 视觉模型名，用于课后反思成绩单照片识别（默认 `qwen-vl-plus`，需与 `LLM_API_KEY` 同服务） |
| `DEMO_MODE` | 演示模式开关，默认 `true` |
| `SESSION_SECRET` | 会话签名密钥，生产环境必须配置（≥16 位，`openssl rand -hex 32` 生成） |

## 部署

推送 main 分支后，GitHub Actions 自动构建 Docker 镜像并发布到 GHCR（`ghcr.io/<owner>/qinglan-prep:latest`）。容器无状态，数据在外部 Turso，重启/迁移不丢数据。

### Sealos（推荐）

1. 打开 [cloud.sealos.io](https://cloud.sealos.io) 注册登录（支持 GitHub 账号）；
2. 首次构建完成后，到 GitHub 个人页 → Packages → `qinglan-prep` → Package settings，将镜像可见性改为 **Public**（Sealos 免密拉取）；
3. 进入「应用管理（App Launchpad）」→ 创建应用：
   - 镜像：`ghcr.io/<owner>/qinglan-prep:latest`
   - 容器端口：`3000`（HTTP）
   - CPU / 内存：`0.5 核 / 512 MB` 起，实例数 1
   - 环境变量：按上表逐条添加（`TURSO_*`、`LLM_*`、`VLM_MODEL`、`SESSION_SECRET`、`DEMO_MODE`）
   - 高级设置（可选）：健康检查路径 `/api/health`
4. 开启「外网访问」获得 HTTPS 域名；访问 `<域名>/api/health` 返回 `{"ok":true,"dbOk":true}` 即部署成功。

### 任意 Docker 主机

```bash
docker build -t qinglan-prep .
docker run -d -p 3000:3000 --env-file .env --name qinglan-prep qinglan-prep
```

### 数据库初始化（首次部署前，一次性，幂等）

外部 Turso 库需建表并灌入种子：

```bash
npx tsx --env-file=.env scripts/turso-init.ts   # 建表 / 补列
npx tsx --env-file=.env prisma/seed.ts          # 管理员 / 教师 / 课标 / 教材 / 题库
```

## 架构概览

- Next.js 15 App Router（SSR + React 19）
- Agent 编排层：Plan-Execute-Reflect 循环，zod 运行时 Schema 校验，工具调用留痕（RunEvent）
- 数据层：Turso（libSQL）+ Prisma + driver adapter
- 接口层：REST + SSE 流式事件推送，IP 限流 10 次/分钟
- 评测体系：`npm run eval` 一键复现，断言全部可机检，报告见 [docs/评测报告.md](docs/评测报告.md)

详见 [docs/技术架构方案.md](docs/技术架构方案.md) 与 [docs/项目说明书.md](docs/项目说明书.md)。

## 种子数据与合规声明

种子数据（课标条目、教材节点、题库、班级记忆）为**演示用模拟数据，节选整理自公开课标文本**，不代表真实学生或学校。系统输出页脚固定声明："本内容供备课参考，教学决策由教师作出"。

## 开源与复用计划

- MIT 协议开源，欢迎复用 Agent 编排模板与种子数据结构
- 四阶段提示词模板位于 `src/agent/prompts.ts`，可替换为其他学科/学段

## 参赛信息

本项目为参赛作品，围绕"可观察、可追溯、带记忆的 Agent 任务闭环"构建。
