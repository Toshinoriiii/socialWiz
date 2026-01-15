# Tasks: 微信公众号平台接入

**Input**: Design documents from `/specs/005-wechat-integration/`
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

- [X] T001 Create platform adapter directory structure: `lib/platforms/wechat/`
- [ ] T002 [P] Install axios dependency if not already installed: `pnpm add axios` (需要网络访问，请手动执行)
- [ ] T003 [P] Add environment variables to `.env.local`: `WECHAT_APP_ID`, `WECHAT_APP_SECRET`, `WECHAT_REDIRECT_URI` (需要手动添加)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Create WechatTypes in `lib/platforms/wechat/wechat-types.ts`: WechatTokenInfo, WechatUserInfo, WechatPublishResult, WechatError, WechatConfig, WechatAuthConfig
- [X] T005 [P] Create WechatClient class in `lib/platforms/wechat/wechat-client.ts` with axios instance and base API methods (getAccessToken, getUserInfo, publish)
- [X] T006 [P] Create WechatAdapter class skeleton in `lib/platforms/wechat/wechat-adapter.ts` implementing PlatformAdapter interface
- [X] T007 Create platform adapter index export update in `lib/platforms/index.ts` - add WechatAdapter export

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 微信公众号账号授权连接 (Priority: P1) 🎯 MVP

**Goal**: 用户能够将微信公众号账号连接到 SocialWiz 平台，完成 OAuth 2.0 授权流程

**Independent Test**: 用户点击"连接微信公众号"按钮，跳转到微信授权页面，完成授权后返回应用，系统保存授权信息。验证：数据库中有 PlatformAccount 记录，包含有效的 access_token 和用户信息。

### Implementation for User Story 1

- [X] T008 [US1] Implement getAuthUrl method in `lib/platforms/wechat/wechat-adapter.ts` - generate OAuth authorization URL with state parameter using WeChat OAuth 2.0 format
- [X] T009 [US1] Implement exchangeToken method in `lib/platforms/wechat/wechat-adapter.ts` - exchange authorization code for access_token using WeChat API
- [X] T010 [US1] Implement getUserInfo method in `lib/platforms/wechat/wechat-adapter.ts` - fetch user info from WeChat API (sns/userinfo endpoint)
- [X] T011 [US1] Create OAuth state management utility in `lib/utils/oauth-state.ts` (if not exists) or reuse existing - generate and validate state parameter, store in Redis
- [X] T012 [US1] Create API route GET `/app/api/platforms/wechat/auth/route.ts` - return authorization URL and state
- [X] T013 [US1] Create API route GET `/app/api/platforms/wechat/auth/callback/route.ts` - handle OAuth callback, exchange token, save PlatformAccount
- [X] T014 [US1] Add error handling and logging to OAuth routes in `app/api/platforms/wechat/auth/route.ts` and `app/api/platforms/wechat/auth/callback/route.ts`
- [X] T015 [US1] Create API route POST `/app/api/platforms/wechat/{platformAccountId}/disconnect/route.ts` - disconnect WeChat account, clear tokens
- [X] T016 [US1] Create API route GET `/app/api/platforms/wechat/{platformAccountId}/status/route.ts` - get account connection status and token expiry

**Checkpoint**: At this point, User Story 1 should be fully functional - users can connect/disconnect WeChat accounts independently

---

## Phase 4: User Story 2 - 发布内容到微信公众号 (Priority: P1)

**Goal**: 用户能够将创建的内容发布到微信公众号平台，支持纯文字内容发布

**Independent Test**: 用户选择微信公众号平台并发布内容，系统调用微信 API 发布内容，返回发布成功结果。验证：ContentPlatform 记录创建，包含 platformContentId 和 publishedUrl，实际微信公众号中可以看到发布的内容。

### Implementation for User Story 2

- [X] T017 [US2] Implement validateContent method in `lib/platforms/wechat/wechat-adapter.ts` - validate text length (need to research WeChat limits), return ValidationResult
- [X] T018 [US2] Create content validation utility in `lib/platforms/wechat/wechat-utils.ts` - validate text length, format content for WeChat API
- [ ] T019 [US2] Research WeChat content publish API endpoint in `lib/platforms/wechat/wechat-client.ts` - identify correct API endpoint for publishing content (may be mass message API or material API)
- [X] T020 [US2] Implement publish method in `lib/platforms/wechat/wechat-adapter.ts` - call WeChat API endpoint for text-only content publishing
- [X] T021 [US2] Add token expiry check before publish in `lib/platforms/wechat/wechat-adapter.ts` - verify token not expired, throw error if expired
- [X] T022 [US2] Update PublishService.executePublish in `lib/services/publish.service.ts` - integrate WechatAdapter, call adapter.publish method
- [X] T023 [US2] Add WechatAdapter instance creation in `lib/services/publish.service.ts` - create adapter based on platform type (Platform.WECHAT)
- [X] T024 [US2] Implement error handling in publish flow - catch WeChat API errors, convert to user-friendly messages, log technical details
- [X] T025 [US2] Update ContentPlatform record after publish in `lib/services/publish.service.ts` - save platformContentId and publishedUrl
- [X] T026 [US2] Create API route POST `/app/api/platforms/wechat/{platformAccountId}/publish/route.ts` - endpoint for publishing content

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - users can connect accounts and publish content

---

## Phase 5: User Story 3 - 测试页面验证功能 (Priority: P1)

**Goal**: 开发团队能够在测试页面验证微信公众号接入功能是否正常工作

**Independent Test**: 在测试页面完成授权连接、内容发布等功能的端到端测试，验证所有功能正常工作。验证：测试页面能够显示连接状态、发布内容、查看日志和错误信息。

### Implementation for User Story 3

- [X] T027 [US3] Create test page directory structure: `app/test/wechat/`
- [X] T028 [US3] Create test page component in `app/test/wechat/page.tsx` - basic page structure with sections for auth, publish, status, logs
- [X] T029 [US3] Implement authorization connection section in `app/test/wechat/page.tsx` - connect/disconnect buttons, connection status display
- [X] T030 [US3] Implement content publish section in `app/test/wechat/page.tsx` - content input form, publish button, result display
- [X] T031 [US3] Implement status viewing section in `app/test/wechat/page.tsx` - display account info, token expiry, connection status
- [X] T032 [US3] Implement error testing section in `app/test/wechat/page.tsx` - test error scenarios, display error messages
- [X] T033 [US3] Implement API call log viewer in `app/test/wechat/page.tsx` - display API call history and responses
- [X] T034 [US3] Add styling and UI polish to test page in `app/test/wechat/page.tsx` - use existing UI components, ensure responsive design

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work - test page provides complete verification capability

---

## Phase 6: User Story 4 - Token 刷新机制 (Priority: P2)

**Goal**: 系统能够自动检测和处理过期的 access_token，优先尝试使用 refresh_token 刷新，否则引导用户重新授权

**Independent Test**: 当 access_token 过期时，系统优先尝试使用 refresh_token 刷新（如果存在），否则标记账号为需要重新授权。验证：Token 过期时系统正确检测，尝试刷新或标记需要重新授权。

### Implementation for User Story 4

- [ ] T035 [US4] Research WeChat refresh_token support in `lib/platforms/wechat/wechat-types.ts` - verify if WeChat supports refresh_token, update types accordingly (需要调研微信 API 文档)
- [X] T036 [US4] Implement refreshToken method in `lib/platforms/wechat/wechat-adapter.ts` - attempt refresh if refresh_token exists, return error if not supported
- [X] T037 [US4] Create token validation utility in `lib/platforms/wechat/wechat-utils.ts` - check token expiry, validate token format
- [X] T038 [US4] Add token expiry check in publish flow in `lib/platforms/wechat/wechat-adapter.ts` - check before API calls, throw specific error if expired
- [X] T039 [US4] Update PublishService to handle token expiry in `lib/services/publish.service.ts` - catch token expiry errors, attempt refresh if possible, mark account needs reauth
- [X] T040 [US4] Add token refresh attempt in publish flow - if refresh_token exists, try refresh before failing
- [X] T041 [US4] Update account status API in `app/api/platforms/wechat/{platformAccountId}/status/route.ts` - include needsReauth flag based on token expiry

**Checkpoint**: All user stories should now be independently functional - token refresh mechanism works correctly

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T042 [P] Add rate limiting handling in `lib/platforms/wechat/wechat-client.ts` - detect rate limit errors, implement retry with exponential backoff
- [X] T043 [P] Add comprehensive error mapping in `lib/platforms/wechat/wechat-types.ts` - map WeChat error codes to user-friendly messages
- [X] T044 [P] Add request/response logging in `lib/platforms/wechat/wechat-client.ts` - log API calls for debugging (sanitize sensitive data)
- [X] T045 [P] Update platform.config.ts to include WeChat environment variables validation in `config/platform.config.ts`
- [X] T046 Add integration with existing PublishService error handling in `lib/services/publish.service.ts`
- [X] T047 [P] Add JSDoc comments to all public methods in `lib/platforms/wechat/wechat-adapter.ts`
- [ ] T048 [P] Create README documentation in `lib/platforms/wechat/README.md` - usage examples, API reference (optional)
- [ ] T049 Run quickstart.md validation - test all scenarios from quickstart.md (需要实际测试环境)
- [ ] T050 Code review and Constitution compliance check - verify Type-Safety First, Service Layer Architecture, Platform Agnostic Design

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US2 → US3 → US4)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Depends on US1 for account connection, but publish logic is independent
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) - Depends on US1 and US2 for testing, but UI can be built independently
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Enhances US2 publish flow, but can be implemented independently

### Within Each User Story

- Types before adapters
- Adapters before API routes
- API routes before test page (for US3)
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, user stories can start in parallel (if team capacity allows)
- Models/Types within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch foundational types and client together:
Task: "Create WechatTypes in lib/platforms/wechat/wechat-types.ts"
Task: "Create WechatClient class in lib/platforms/wechat/wechat-client.ts"
Task: "Create WechatAdapter class skeleton in lib/platforms/wechat/wechat-adapter.ts"

# Launch API routes together (after adapter methods):
Task: "Create API route GET /app/api/platforms/wechat/auth/route.ts"
Task: "Create API route GET /app/api/platforms/wechat/auth/callback/route.ts"
Task: "Create API route POST /app/api/platforms/wechat/{platformAccountId}/disconnect/route.ts"
Task: "Create API route GET /app/api/platforms/wechat/{platformAccountId}/status/route.ts"
```

---

## Parallel Example: User Story 2

```bash
# Launch validation and publish implementation together:
Task: "Implement validateContent method in lib/platforms/wechat/wechat-adapter.ts"
Task: "Create content validation utility in lib/platforms/wechat/wechat-utils.ts"
Task: "Research WeChat content publish API endpoint in lib/platforms/wechat/wechat-client.ts"
```

---

## Parallel Example: User Story 3

```bash
# Launch test page sections together:
Task: "Implement authorization connection section in app/test/wechat/page.tsx"
Task: "Implement content publish section in app/test/wechat/page.tsx"
Task: "Implement status viewing section in app/test/wechat/page.tsx"
Task: "Implement error testing section in app/test/wechat/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (OAuth)
   - Developer B: User Story 2 (Publish) - can start after US1 adapter methods
   - Developer C: User Story 3 (Test Page) - can start after US1 and US2 APIs
3. Developer A: User Story 4 (Token Refresh) - after US2 complete
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (if tests are added)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- **Important**: Several tasks require researching WeChat API documentation (T019, T035) - these should be completed early to inform implementation decisions
