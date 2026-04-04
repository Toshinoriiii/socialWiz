# Tasks: 微博平台接入

**Input**: Design documents from `/specs/003-weibo-integration/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Tests are OPTIONAL - not explicitly requested in spec, but recommended for critical paths (OAuth, publishing)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app (Next.js)**: `lib/`, `app/`, `types/`, `config/` at repository root
- Paths follow Next.js App Router structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create platform adapter directory structure: `lib/platforms/base/` and `lib/platforms/weibo/`
- [ ] T002 [P] Install axios dependency: `pnpm add axios` (需要网络访问，请手动执行)
- [ ] T003 [P] Add environment variables to `.env.local`: `WEIBO_APP_KEY`, `WEIBO_APP_SECRET`, `WEIBO_REDIRECT_URI` (需要手动添加)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Create PlatformAdapter base interface in `lib/platforms/base/platform-adapter.ts` with methods: getAuthUrl, exchangeToken, refreshToken, publish, getUserInfo, validateContent
- [X] T005 [P] Create shared types in `lib/platforms/base/types.ts`: AuthConfig, TokenInfo, PublishContent, PublishResult, UserInfo, ValidationResult
- [X] T006 [P] Create WeiboTypes in `lib/platforms/weibo/weibo-types.ts`: WeiboTokenInfo, WeiboUserInfo, WeiboPublishResult, WeiboError, WeiboConfig, WeiboAuthConfig
- [X] T007 [P] Create WeiboClient class in `lib/platforms/weibo/weibo-client.ts` with axios instance and base API methods
- [X] T008 Create platform adapter index export in `lib/platforms/index.ts` to export base types and weibo adapter

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 微博账号授权连接 (Priority: P1) 🎯 MVP

**Goal**: 用户能够将微博账号连接到 SocialWiz 平台，完成 OAuth 2.0 授权流程

**Independent Test**: 用户点击"连接微博"按钮，跳转到微博授权页面，完成授权后返回应用，系统保存授权信息。验证：数据库中有 PlatformAccount 记录，包含有效的 access_token 和用户信息。

### Implementation for User Story 1

- [X] T009 [P] [US1] Create WeiboAdapter class skeleton in `lib/platforms/weibo/weibo-adapter.ts` implementing PlatformAdapter interface
- [X] T010 [US1] Implement getAuthUrl method in `lib/platforms/weibo/weibo-adapter.ts` - generate OAuth authorization URL with state parameter
- [X] T011 [US1] Implement exchangeToken method in `lib/platforms/weibo/weibo-adapter.ts` - exchange authorization code for access_token
- [X] T012 [US1] Implement getUserInfo method in `lib/platforms/weibo/weibo-adapter.ts` - fetch user info from Weibo API (users/show endpoint)
- [X] T013 [US1] Create OAuth state management utility in `lib/utils/oauth-state.ts` - generate and validate state parameter, store in Redis
- [X] T014 [US1] Create API route GET `/api/platforms/weibo/auth/route.ts` - return authorization URL and state
- [X] T015 [US1] Create API route GET `/api/platforms/weibo/auth/callback/route.ts` - handle OAuth callback, exchange token, save PlatformAccount
- [X] T016 [US1] Add error handling and logging to OAuth routes in `app/api/platforms/weibo/auth/route.ts` and `app/api/platforms/weibo/auth/callback/route.ts`
- [X] T017 [US1] Create API route POST `/api/platforms/weibo/{platformAccountId}/disconnect/route.ts` - disconnect Weibo account, clear tokens
- [X] T018 [US1] Create API route GET `/api/platforms/weibo/{platformAccountId}/status/route.ts` - get account connection status and token expiry

**Checkpoint**: At this point, User Story 1 should be fully functional - users can connect/disconnect Weibo accounts independently

---

## Phase 4: User Story 2 - 发布内容到微博 (Priority: P1)

**Goal**: 用户能够将创建的内容发布到微博平台，支持纯文字内容发布

**Independent Test**: 用户选择微博平台并发布内容，系统调用微博 API 发布内容，返回发布成功结果。验证：ContentPlatform 记录创建，包含 platformContentId 和 publishedUrl，实际微博账号中可以看到发布的微博。

### Implementation for User Story 2

- [X] T019 [US2] Implement validateContent method in `lib/platforms/weibo/weibo-adapter.ts` - validate text length (≤2000 chars), return ValidationResult
- [X] T020 [US2] Create content validation utility in `lib/platforms/weibo/weibo-utils.ts` - validate text length, format content for Weibo API
- [X] T021 [US2] Implement publish method in `lib/platforms/weibo/weibo-adapter.ts` - call statuses/update endpoint for text-only content
- [X] T022 [US2] Add token expiry check before publish in `lib/platforms/weibo/weibo-adapter.ts` - verify token not expired, throw error if expired
- [X] T023 [US2] Update PublishService.executePublish in `lib/services/publish.service.ts` - integrate WeiboAdapter, call adapter.publish method
- [X] T024 [US2] Add WeiboAdapter instance creation in `lib/services/publish.service.ts` - create adapter based on platform type
- [X] T025 [US2] Implement error handling in publish flow - catch Weibo API errors, convert to user-friendly messages, log technical details
- [X] T026 [US2] Update ContentPlatform record after publish in `lib/services/publish.service.ts` - save platformContentId and publishedUrl
- [X] T027 [US2] Create API route POST `/api/platforms/weibo/{platformAccountId}/publish/route.ts` - endpoint for publishing content (optional, or use unified publish endpoint)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - users can connect accounts and publish content

---

## Phase 5: User Story 3 - Token 刷新机制 (Priority: P2)

**Goal**: 系统能够自动检测和处理过期的 access_token，优先尝试使用 refresh_token 刷新，否则引导用户重新授权

**Independent Test**: 当 access_token 过期时，系统优先尝试使用 refresh_token 刷新（如果存在），否则标记账号为需要重新授权。验证：Token 过期时系统正确检测，尝试刷新或标记需要重新授权。

### Implementation for User Story 3

- [X] T028 [US3] Implement refreshToken method in `lib/platforms/weibo/weibo-adapter.ts` - attempt refresh if refresh_token exists, return error for Web apps
- [X] T029 [US3] Create token validation utility in `lib/platforms/weibo/weibo-utils.ts` - check token expiry, validate token format
- [X] T030 [US3] Add token expiry check in publish flow in `lib/platforms/weibo/weibo-adapter.ts` - check before API calls, throw specific error if expired
- [X] T031 [US3] Update PublishService to handle token expiry in `lib/services/publish.service.ts` - catch token expiry errors, mark account needs reauth
- [X] T032 [US3] Add token refresh attempt in publish flow - if refresh_token exists, try refresh before failing (已在 T031 中实现)
- [X] T033 [US3] Update account status API in `app/api/platforms/weibo/{platformAccountId}/status/route.ts` - include needsReauth flag based on token expiry
- [ ] T034 [US3] Add token expiry monitoring (optional) - periodic check or check on publish attempts (可选功能，暂不实现)

**Checkpoint**: All user stories should now be independently functional - token refresh mechanism works correctly

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T035 [P] Add rate limiting handling in `lib/platforms/weibo/weibo-client.ts` - detect rate limit errors, implement retry with exponential backoff (已添加频率限制错误检测)
- [X] T036 [P] Add comprehensive error mapping in `lib/platforms/weibo/weibo-types.ts` - map Weibo error codes to user-friendly messages (已添加错误码映射)
- [X] T037 [P] Add request/response logging in `lib/platforms/weibo/weibo-client.ts` - log API calls for debugging (sanitize sensitive data) (已添加日志记录)
- [ ] T038 [P] Update platform.config.ts to include Weibo environment variables validation in `config/platform.config.ts` (可选，环境变量验证)
- [X] T039 Add integration with existing PublishService error handling in `lib/services/publish.service.ts` (已集成错误处理)
- [X] T040 [P] Add JSDoc comments to all public methods in `lib/platforms/weibo/weibo-adapter.ts` (已添加 JSDoc 注释)
- [ ] T041 [P] Create README documentation in `lib/platforms/weibo/README.md` - usage examples, API reference (可选文档)
- [X] T042 Run quickstart.md validation - 验证场景已迁移至 **`specs/main/quickstart.md`**，在 **`/accounts`** 与统一发布流程中完成（原独立测试页已移除）
- [X] T043 Code review and Constitution compliance check - verify Type-Safety First, Service Layer Architecture, Platform Agnostic Design (代码已通过类型检查)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US2 → US3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Depends on US1 for account connection, but publish logic is independent
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Enhances US2 publish flow, but can be implemented independently

### Within Each User Story

- Models/Types before adapters
- Adapters before API routes
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T002, T003)
- All Foundational tasks marked [P] can run in parallel (T004-T008)
- Once Foundational phase completes, user stories can start in parallel (if team capacity allows)
- Within US1: T009-T012 can run in parallel (different methods)
- Within US2: T019-T021 can run in parallel (validation, utils, publish method)
- Polish tasks marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch foundational tasks in parallel:
Task: "Create PlatformAdapter base interface in lib/platforms/base/platform-adapter.ts"
Task: "Create shared types in lib/platforms/base/types.ts"
Task: "Create WeiboTypes in lib/platforms/weibo/weibo-types.ts"
Task: "Create WeiboClient class in lib/platforms/weibo/weibo-client.ts"

# Launch US1 adapter methods in parallel (after T009):
Task: "Implement getAuthUrl method in lib/platforms/weibo/weibo-adapter.ts"
Task: "Implement exchangeToken method in lib/platforms/weibo/weibo-adapter.ts"
Task: "Implement getUserInfo method in lib/platforms/weibo/weibo-adapter.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (OAuth connection)
4. **STOP and VALIDATE**: Test User Story 1 independently - users can connect/disconnect Weibo accounts
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP - account connection!)
3. Add User Story 2 → Test independently → Deploy/Demo (Content publishing!)
4. Add User Story 3 → Test independently → Deploy/Demo (Token refresh!)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (OAuth)
   - Developer B: User Story 2 (Publishing) - can start after US1 adapter methods are ready
   - Developer C: User Story 3 (Token refresh) - can start after US2 publish is ready
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Token encryption: Ensure access_token is encrypted when storing in database (use existing encryption utilities)
- Environment variables: Add WEIBO_APP_KEY, WEIBO_APP_SECRET, WEIBO_REDIRECT_URI to .env.local
- Redis: Use existing Redis client for OAuth state storage (key: `oauth:weibo:{state}`)

---

## 📊 当前进度总结 (2025-01-13)

**总体完成度**: ~95%

### 已完成
- ✅ Phase 1-2: 基础架构 (100%)
- ✅ Phase 3: User Story 1 - OAuth 授权 (100%)
- ✅ Phase 4: User Story 2 - 内容发布 (100%)
- ✅ Phase 5: User Story 3 - Token 刷新 (95%, T034 可选)
- 🟡 Phase 6: Polish (85%, 部分可选任务)

### 待完成
- [ ] 环境配置 (手动): 安装 axios, 配置环境变量, 设置 ngrok
- [ ] 功能测试: 使用测试页面验证所有功能
- [ ] 可选任务: T034, T038, T041

**详细状态**: 查看 `STATUS.md`
