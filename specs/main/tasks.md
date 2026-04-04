---
description: "Task list — 非官方发布引擎优先（specs/main）"
---

# Tasks: 非官方发布引擎优先（主路径）

**Input**: `C:\CodeField\socialwiz\specs\main\`（plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md）  
**Prerequisites**: 仓库已为 Next.js + Prisma；已有 `app\api\platforms\weibo\playwright-bind\route.ts` 与 `lib\weibo-playwright\compose-runner.ts`（统一发布内调用）。

**Tests**: 规范未强制 TDD；Polish 阶段含 **可选** 单测脚手架任务。关键逻辑建议按 `plan.md` Constitution 自检。

**User stories（由 spec.md 推导）**

| ID | 优先级 | 标题 |
|----|--------|------|
| US1 | P1 | 会话型账号经统一发布链路入队并由引擎（微博 Playwright）执行 🎯 MVP |
| US2 | P2 | 发布任务状态查询 API 与 OpenAPI 契约 |
| US3 | P3 | 发布页/账号页主路径 UX + OAuth 入口降级（feature flag） |
| US4 | P4 | 跨故事收尾：契约同步、Constitution 追认、quickstart |

## Format

`- [ ] Txxx [P] [USn] Description with c:\CodeField\socialwiz\... path`

---

## Phase 1: Setup（共享准备）

**Purpose**: 脚手架、契约草稿、环境说明；不阻塞写代码但降低歧义。

- [x] T001 Create or extend `c:\CodeField\socialwiz\.env.example` with documented vars (`NEXT_PUBLIC_ENABLE_WEIBO_OAUTH_UI`, session/uploader-related placeholders per `plan.md`)
- [x] T002 [P] Add `c:\CodeField\socialwiz\lib\platforms\publish-plugins\types.ts` defining `PlatformPublishPlugin` (publish input/output, platform key, optional transport)
- [x] T003 [P] Add `c:\CodeField\socialwiz\lib\platforms\publish-plugins\manifest.ts` exporting per-platform `UploaderManifest` registry (weibo entry pointing at existing `scripts\weibo-playwright\` entries)

---

## Phase 2: Foundational（阻塞所有用户故事）

**Purpose**: 连接类型判定、`PublishJob` 持久化、非官方发布服务骨架。⚠️ 完成前不开 US1+ 实现。

- [x] T004 Add `c:\CodeField\socialwiz\lib\platforms\connection-kind.ts` with typed helpers to detect session-backed vs OAuth-backed `PlatformAccount` (reuse existing Weibo Playwright sentinel / `platformUserId` prefix conventions from `c:\CodeField\socialwiz\lib\services\publish.service.ts`)
- [x] T005 Add `PublishJob` model and relations in `c:\CodeField\socialwiz\prisma\schema.prisma` and create migration under `c:\CodeField\socialwiz\prisma\migrations\` (fields per `data-model.md`: userId, platformAccountId, contentId optional, payload JSON, status enum, errorMessage, platformPostId, timestamps)
- [x] T006 Add `c:\CodeField\socialwiz\types\publish-job.ts` (Zod schemas + exported TS types for API and service layer)
- [x] T007 Implement `c:\CodeField\socialwiz\lib\services\non-official-publish.service.ts`: create job, transition status, select plugin from manifest, **MVP runner** that processes job inline in same Node process after enqueue (or `setImmediate`) to avoid separate worker deploy initially
- [x] T008 Add barrel `c:\CodeField\socialwiz\lib\platforms\publish-plugins\index.ts` registering Weibo plugin placeholder that throws until T010 completes

**Checkpoint**: Prisma migrate 可应用；服务层可创建 `PublishJob` 记录。

---

## Phase 3: User Story 1 — 会话型统一发布闭环（Priority: P1）🎯 MVP

**Goal**: 用户在站内对 **微博会话型** `PlatformAccount` 触发与现有一致的发布入口时，**不再**被 `c:\CodeField\socialwiz\app\api\platforms\weibo\[platformAccountId]\publish\route.ts` 的 Playwright 拒绝逻辑挡回；请求进入 `NonOfficialPublishService`，执行微博 Playwright compose，并回写 `PublishJob` / `ContentPlatform`（若适用）。

**Independent Test**: 按 `c:\CodeField\socialwiz\specs\main\quickstart.md` §0 主路径：绑定会话后，从 **统一发布 API**（`c:\CodeField\socialwiz\app\api\platforms\publish\route.ts` 或单账号 publish 路由，以实现选型为准）提交正文，得到 `jobId` 或同步 `success`+微博侧可见帖文；数据库存在终态 `PublishJob`。

### Implementation for User Story 1

- [x] T009 [US1] Update `c:\CodeField\socialwiz\lib\services\publish.service.ts` so Weibo branch routes **session-backed** accounts to `NonOfficialPublishService` instead of returning the Playwright-not-supported error
- [x] T010 [US1] Implement `lib/platforms/publish-plugins/weibo-playwright.plugin.ts`：调用 **`compose-runner`** 内 `tryPublishWeiboTextViaWebAjax`（HTTP 复现发博；**非**子进程 `try-compose.mjs`，该脚本未作为产品路径保留）
- [x] T011 [US1] 微博会话发博收拢至 `lib/weibo-playwright/compose-runner.ts`（HTTP 复现）；历史上独立的 `playwright-compose` API 路由已删除，避免与统一发布重复。
- [x] T012 [US1] Align `c:\CodeField\socialwiz\app\api\platforms\publish\route.ts` and/or `c:\CodeField\socialwiz\app\api\platforms\weibo\[platformAccountId]\publish\route.ts` response shape: for session-backed publishes return `{ jobId, status }` (or documented synchronous fallback) consistent with `types\publish-job.ts`

**Checkpoint**: MVP 可演示「站内一点 → 引擎发帖」；OAuth 账号行为保持旧路径不变。

---

## Phase 4: User Story 2 — 任务查询 API（Priority: P2）

**Goal**: 前端与其他客户端可轮询发布任务状态，支撑异步 UX。

**Independent Test**: `GET` 带 Bearer 返回自有任务的 `status`/`errorMessage`；越权返回 403/404。

### Implementation for User Story 2

- [x] T013 [US2] Implement `c:\CodeField\socialwiz\app\api\platforms\publish\jobs\[jobId]\route.ts` (`GET`, ownership check via Prisma + session user)
- [x] T014 [P] [US2] Add `c:\CodeField\socialwiz\specs\main\contracts\publish-job-api.yaml` OpenAPI 3.0 describing `GET /api/platforms/publish/jobs/{jobId}` and job schema (align with `types\publish-job.ts`)

**Checkpoint**: 契约与实现可对照；可与 US3 并行开发（不同文件）。

---

## Phase 5: User Story 3 — UX 与 OAuth 降级（Priority: P3）

**Goal**: 账户页 **主文案** 引导浏览器会话连接；OAuth 绑定入口默认隐藏或可配置打开。

**Independent Test**: `NEXT_PUBLIC_ENABLE_WEIBO_OAUTH_UI=false`（或未设）时主按钮不展示 OAuth 主路径；发布页在异步路径下展示轮询或完成态。

### Implementation for User Story 3

- [x] T015 [US3] Update `c:\CodeField\socialwiz\app\(dashboard)\publish\page.tsx` (and/or `c:\CodeField\socialwiz\app\(dashboard)\publish\works\[draftId]\publish\page.tsx` if that is the real publish CTA) to call publish API and **poll** `c:\CodeField\socialwiz\app\api\platforms\publish\jobs\[jobId]\route.ts` until terminal state, with user-visible error text
- [x] T016 [P] [US3] Update `c:\CodeField\socialwiz\app\(dashboard)\accounts\page.tsx` copy and layout so **连接微博（浏览器）** 为主 CTA；OAuth 相关区块受环境变量控制
- [x] T017 [US3] Add `c:\CodeField\socialwiz\config\feature-flags.ts` (or extend existing config) reading `NEXT_PUBLIC_ENABLE_WEIBO_OAUTH_UI` and use it from accounts UI components

**Checkpoint**: 与 `spec.md`「默认不引导开放平台」一致。

---

## Phase 6: User Story 4 — 收尾与文档（Priority: P4）

**Goal**: 契约交叉引用、宪章追认、联调文档与可选测试脚手架。

**Independent Test**: 新同事仅读 `quickstart.md` 可跑通主路径；`pnpm lint` / `pnpm build` 无新增错误。

### Implementation for User Story 4

- [x] T018 [US4] Update `c:\CodeField\socialwiz\specs\main\contracts\browser-uploader-api.yaml` description to reference `publish-job-api.yaml` and unified publish flow
- [x] T019 [P] [US4] Amend `c:\CodeField\socialwiz\.specify\memory\constitution.md` (PATCH version bump + short note) stating **OAuth 为可选平台适配器，非唯一集成方式**，与 `plan.md` Complexity Tracking 一致
- [x] T020 [P] [US4] Update `c:\CodeField\socialwiz\specs\main\quickstart.md` with **jobId 轮询**步骤与 feature flag 说明
- [ ] T021 [P] [US4] (Optional) Add Vitest devDependency, `npm script test`, and `c:\CodeField\socialwiz\lib\services\non-official-publish.service.test.ts` for job status transitions — **deferred**（仓库尚无 test 脚本）

**Checkpoint**: 文档与规划一致；准备合并或开 `speckit.implement` 下一阶段。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** → 可与 Phase 2 部分重叠（T002–T003 与 T004 并行）。
- **Phase 2** → **阻塞** US1–US4 实现。
- **Phase 3 (US1)** → 阻塞「真实发帖」验收；建议先于 US2 完成或紧耦合同一 PR。
- **Phase 4 (US2)** → 依赖 T007/T012 产出 `jobId`；可与 US1 尾部并行。
- **Phase 5 (US3)** → 依赖 US2 的 GET API（若要做轮询）；文案可与 US2 并行。
- **Phase 6 (US4)** → 依赖功能基本齐全后做。

### User Story Dependencies

- **US1**: 仅依赖 Foundational（Phase 2）。
- **US2**: 依赖 US1 中 `jobId` 与任务持久化（至少 T007、T012）。
- **US3**: 依赖 US2 若需要轮询；否则仅需 US1 同步成功路径时可部分延后。
- **US4**: 依赖主要功能合并前完成文档。

### Parallel Opportunities

- T002、T003、T006（在 T005 schema 稳定后）可并行。
- T014 与 T013 可并行（先草拟 YAML 再对齐实现）。
- T016 与 T015 可并行（不同页面文件）。
- T019、T020、T021 可并行。

### Parallel Example: User Story 2

```text
Developer A: T013 app\api\platforms\publish\jobs\[jobId]\route.ts
Developer B: T014 specs\main\contracts\publish-job-api.yaml
```

---

## Implementation Strategy

### MVP First（仅 US1 + Foundational）

1. Phase 2 全部完成。  
2. Phase 3（T009–T012）完成。  
3. **停止**：用手动或 `quickstart` 验证微博会话发帖。  

### Incremental Delivery

1. Foundational → US1（发帖闭环）→ 演示。  
2. US2（查询）→ US3（轮询 UX）→ US4（文档/宪章）。  

---

## Summary（本文件生成统计）

| 项 | 值 |
|----|-----|
| **tasks.md 路径** | `C:\CodeField\socialwiz\specs\main\tasks.md` |
| **任务总数** | 21（T001–T021） |
| **US1** | 4（T009–T012） |
| **US2** | 2（T013–T014） |
| **US3** | 3（T015–T017） |
| **US4** | 4（T018–T021，T021 可选） |
| **Setup + Foundational** | 8（T001–T008） |
| **建议 MVP 范围** | Phase 2 + Phase 3（T004–T012） |
| **格式** | 全部任务均为 `- [ ] Tnnn ... c:\CodeField\socialwiz\...` |
