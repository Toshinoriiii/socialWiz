# Data Model: 平台接入（specs/main）

**Date**: 2026-04-03  
**Spec**: [spec.md](./spec.md) / [003 spec](../003-weibo-integration/spec.md)

## Overview

持久化概念包括：**平台账号**（`PlatformAccount`）、**发布记录**（`ContentPlatform`）、可选 **`WeiboAppConfig`**（仅 **OAuth/官方 API 兼容轨道**）、**异步发布任务**（推荐新增 `PublishJob` 等，见下文）、以及 **会话制品**（文件系统，非 Prisma）。

**主产品路径（见 `spec.md`）**：用户通过 **会话采集** 建立 **`PlatformAccount`（会话型）**；**发布** 写入任务表并由 **非官方发布引擎** 消费，**不依赖** `WeiboAppConfig`。开放平台 OAuth 账号仍可落库为 **token 型** `PlatformAccount`，服务层按类型路由。

**与 003 的关系**：`003` 仍以 OAuth + `WeiboAppConfig` 为完整描述；实现可双轨并存，数据模型同时支撑两轨。

## 实体

### WeiboAppConfig（OAuth 兼容轨道；主路径下可选）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| userId | string | 所属用户 |
| appId | string | 微博 App Key（可展示脱敏） |
| appSecret | string | 加密后的 App Secret |
| appName | string? | 用户备注名 |
| callbackUrl | string | OAuth 回调基址（可与全局 `NEXT_PUBLIC_BASE_URL` 拼接规范路径） |
| isActive | boolean | 默认 true |
| createdAt / updatedAt | DateTime | 审计 |

**关系**: `User` 1 — N `WeiboAppConfig`；`WeiboAppConfig` 1 — N `PlatformAccount`（微博类型）。

**校验**:

- `[userId, appId]` 唯一（同一用户不重复添加同一应用）。
- `callbackUrl` 合法 URL。
- `appSecret` 读写经服务层加解密，Prisma 仅存密文。

### PlatformAccount（现有 → 拟扩展）

**当前字段**（节选）：`userId`, `platform`, `platformUserId`, `platformUsername`, `accessToken`, `refreshToken?`, `tokenExpiry?`, `isConnected`, …

**拟新增**:

- `weiboAppConfigId`（可选但微博账号应必填该外键，当 `platform === WEIBO` 时由服务层校验）

**约束变更**:

- 删除或替换 `@@unique([userId, platform])`，改为例如 `@@unique([userId, platform, platformUserId])`，以允许同一用户多个 WEIBO 账号。

**状态**（逻辑）:

- 已连接 / 需重新授权（token 过期或微博返回 213xx 等）— 可与 `isConnected`、`tokenExpiry` 组合表达。

### ContentPlatform（现有）

继续关联 `platformAccountId` 指向微博 `PlatformAccount`；发布失败时写 `errorMessage`、`publishStatus`。

### User

新增反向关系：`weiboAppConfigs WeiboAppConfig[]`（命名与 Prisma 风格一致即可）。

## 验证规则（业务层）

- 发布前：`validateContent` 对齐 `config/platform.config.ts` 中 WEIBO limits（2000 字、9 图等）。
- OAuth：`state` 与用户、意图 redirect 绑定并可过期失效。

## 与代码库差异（规划基线）

| 项 | 当前仓库 | 目标 |
|----|----------|------|
| WeiboAppConfig | 无 | 新增 model + 迁移 |
| 微博凭证 | `process.env.WEIBO_*` | 用户表 + 加密 |
| 每用户微博账号数 | `@@unique([userId, platform])` 限制为 1 | 多账号 |

---

## 浏览器会话 Uploader（跨平台扩展）

### 连接模式（逻辑，非必须单独表）

在 **`PlatformAccount`** 上通过现有约定表达「浏览器会话」连接（示例：微博 Playwright 使用 `platformUserId` 前缀与 `accessToken` sentinel），或在未来迁移为显式字段 `connectionMode: OAUTH | BROWSER_SESSION`（实现任务）。同一 `userId` 下可同时存在 OAuth 微博账号与 Playwright 微博账号（不同 `platformUserId`）。

### 会话制品（Session artifact）

| 概念 | 说明 |
|------|------|
| 存储位置 | 默认本机目录，如 `scripts/<platform>-playwright/sessions/{userId}.json`（与代码一致） |
| 内容 | Playwright `storageState`（cookies、origins 等） |
| 锁 | 绑定过程中 `*.binding.lock` 防止并发写 |

**关系**: 逻辑上 **1 User : N 会话文件**（按平台分目录）；与 `PlatformAccount` 的同步由服务层在「检测到会话存在」时 upsert 列表项。

### UploaderManifest（代码层配置实体）

| 字段 | 说明 |
|------|------|
| platform | 与 `Platform` 枚举对应 |
| saveSessionScript / composeScript | 相对仓库根的入口（如 `.mjs`） |
| contentKinds | 如 `['text']`，扩展后 `image` / `video` |
| supportsHeadless | 是否允许无 UI（平台依赖；微博可能阶段性 false） |

### PublishJob（推荐；统一「站内点击发布」）

支撑主路径 **异步发布** 与状态查询：

- `id`, `userId`, `platformAccountId`, `contentId?`, `payload`（正文快照等 JSON）, `status`（queued \| running \| success \| failed）, `errorMessage?`, `platformPostId?`, `createdAt`, `updatedAt`

引擎消费任务并更新状态；绑定流程可仍用短生命周期任务或沿用 `BrowserUploadJob`。

### BrowserUploadJob（可选；偏 bind/compose 调试）

若需审计 bind/compose 子进程，可增加：

- `id`, `userId`, `platform`, `kind`（bind \| compose）, `payload`（JSON）, `status`, `errorMessage`, `createdAt`, `updatedAt`

**MVP**：可仅用内存 + 文件锁 + HTTP 轮询，不强制落库；与 **PublishJob** 合并设计亦可。
