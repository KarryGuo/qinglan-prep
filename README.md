# 青蓝备课 Qinglan

**让每一节课，都有备而来** —— 从学情诊断开始的备课 Agent。

教师输入课题与班级学情，Agent 完成"诊—设—生—思"四阶段闭环：学情诊断 → 依标设计 → 备课包生成 → 课后反思与记忆写回。每一步思考与工具调用都留痕、可追溯，每个设计点都能点开看依据。

<!-- 产品截图占位 -->

## 在线体验

https://qinglan-prep.onrender.com

> Render 免费档实例空闲约 15 分钟后会休眠，首次访问需等待约 1 分钟冷启动。

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
