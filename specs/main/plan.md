# Implementation Plan: 非官方发布引擎优先（主路径）

**Branch**: `main` | **Date**: 2026-04-03 | **Spec**: [spec.md](./spec.md)  
**Input**: 用户目标 — **完全避开各平台开放平台接入类认证**（OAuth/App 凭证不作为主路径），采用 **后台非官方发布**（自动化 + 可选逆向复现），**用户体验**为仅在 SocialWiz 内 **点击发布** 即可触达对应平台。

**Note**: 由 `/speckit.plan` 迭代；执行流程见 `.specify/templates/commands/plan.md`。

## Summary

将产品主路径从「OAuth + 官方 API 发布」调整为 **「网页会话 + 非官方发布引擎」**：统一 **Publish** 入口由服务层根据账号类型路由至 **`NonOfficialPublishEngine`（命名随实现）** 与各平台 **插件**；插件默认以 **Playwright** 实现，**允许**单平台以 **HTTP 复现（逆向）** 作为内部 transport。开放平台相关能力（`WeiboAppConfig`、`WeiboAdapter` 等）降级为 **兼容/可选**，不在默认 UX 中要求用户完成开发者侧认证。详见 [research.md](./research.md) §16 及对 §8–§11 的修订说明。

## Technical Context

**Language/Version**: TypeScript 5.9+、Node.js（与 Next.js 一致）  
**Primary Dependencies**: Next.js 14+ App Router、Prisma、Playwright（Chromium）、Zod  
**Storage**: PostgreSQL（`PlatformAccount`、推荐 **`PublishJob` / `BrowserUploadJob`** 持久化异步任务）、会话制品（按 `userId` 隔离的文件或加密 BLOB）  
**Testing**: 服务层路由与任务状态机单测；插件以 mock transport；全链路 smoke 见 quickstart  
**Target Platform**: Web + **后台执行体**（首期可同机子进程；生产为 worker + 队列 + 共享会话存储）  
**Project Type**: 单体 Web（`app/` + `lib/` + `scripts/`）  
**Performance Goals**: 发布为异步任务；API 快速入队；可轮询/查询任务状态；日志脱敏  
**Constraints**: Constitution；**统一站内发布 UX**；开放平台代码路径可保留但不得阻塞主路径；逆向实现封装在平台插件内，便于单测与替换  
**Scale/Scope**: 微博首发闭环 → 抽象引擎接口 + manifest → 第二平台复制  

## Constitution Check

| 原则 | 结论 |
|------|------|
| Type-Safety First | `ConnectionKind`、`PublishTransport`、`PublishJobStatus` 等枚举与 Zod 校验；插件接口强类型。 |
| Service Layer Architecture | 队列入队、引擎调度、会话校验均在 `lib/services/`；路由仅 HTTP 适配。 |
| Platform Agnostic Design | **`PlatformPublishPlugin` 接口** 统一 bind/publish/health；OAuth 适配器与引擎并列而非唯一真理源。 |
| API-First Development | 统一 `POST .../publish` 或现有统一发布 API 先扩展契约，再改 UI。 |
| Testing Discipline | 引擎路由、任务状态迁移需测试；插件可对 Playwright 层做集成标记为 optional。 |

**Violations**: 无。若 Constitution 原文「标准化 OAuth」被严格解读为必选，则以本规划 **修订理解为：官方 OAuth 为可选适配器，非唯一集成方式** —— 需在 Constitution 小版本修订中追认（独立 PR）。

## Project Structure

### Documentation (this feature)

```text
specs/main/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── weibo-api.yaml          # 兼容/可选路径
│   └── browser-uploader-api.yaml
└── tasks.md
```

### Source Code（目标形态）

```text
lib/services/
  non-official-publish.service.ts   # 入队、选插件、更新任务
  publish.service.ts                # 统一入口：会话账号 → 引擎；OAuth 账号 → 旧路径（若保留）
lib/platforms/
  publish-plugins/                  # 每平台一目录：weibo/session-publish.ts 等
scripts/<platform>-playwright/      # bind / compose 脚本，由插件调用
app/api/...                         # 统一发布与任务查询；playwright-* 可收敛为内部调用
```

**Structure Decision**: 单仓 Node；不引入 Python sau；**逆向 HTTP** 仅出现在平台插件内部模块，不暴露为默认用户配置项。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Constitution「标准化 OAuth」字面冲突 | 产品明确要求不走开放平台主路径 | 仅 OAuth 无法满足「无官方 API 平台」与当前 UX 目标 |

## Phase 0–1 交付物

| Phase | 产出 |
|-------|------|
| 0 | [research.md](./research.md) §16 及 §8–§11 修订 |
| 1 | [data-model.md](./data-model.md) 任务实体；[contracts](./contracts/) 统一发布/任务查询（迭代）；[quickstart.md](./quickstart.md) |

## 下一步

**`/speckit.tasks`**：拆解为「统一 Publish 路由至引擎」「微博插件收口」「任务表与轮询 API」「账户页 copy 去 OAuth 化」「OAuth 代码路径 feature flag」等。
