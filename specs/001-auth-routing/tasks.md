# Tasks: 认证路由保护

**Input**: Design documents from `/specs/001-auth-routing/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL - not included as not explicitly requested in specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `app/`, `lib/`, `components/`, `store/`, `types/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 [P] Create API route directory structure for auth verify endpoint in app/api/auth/verify/
- [x] T002 [P] Create utility directory structure for auth helpers in lib/utils/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create API endpoint /api/auth/verify/route.ts that calls AuthService.verifyToken()
- [x] T004 [P] Create TypeScript types for verify API request/response in types/auth.types.ts
- [x] T005 [P] Create auth utility function for token verification API call in lib/utils/auth.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 未登录用户访问应用根路径 (Priority: P1) 🎯 MVP

**Goal**: 未登录用户访问应用根路径时，系统自动重定向到登录页面

**Independent Test**: 清除所有认证信息（localStorage token），访问应用根路径，验证是否被重定向到 `/login` 页面

### Implementation for User Story 1

- [x] T006 [US1] Implement authentication check logic in app/page.tsx using useEffect hook
- [x] T007 [US1] Add token verification API call in app/page.tsx using lib/utils/auth.ts
- [x] T008 [US1] Add redirect logic to /login when user is not authenticated in app/page.tsx
- [x] T009 [US1] Add loading state display during authentication check in app/page.tsx
- [x] T010 [US1] Add error handling for network errors in authentication check in app/page.tsx (default to redirect to login)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - 已登录用户访问应用根路径 (Priority: P1) 🎯 MVP

**Goal**: 已登录用户访问应用根路径时，系统自动重定向到管理页面

**Independent Test**: 使用有效认证信息登录后，访问应用根路径，验证是否被重定向到 `/dashboard` 或管理页面

### Implementation for User Story 2

- [x] T011 [US2] Add redirect logic to /dashboard when user is authenticated in app/page.tsx
- [x] T012 [US2] Update Zustand store state after successful token verification in app/page.tsx
- [x] T013 [US2] Handle token expiration scenario in app/page.tsx (treat as unauthenticated)
- [x] T014 [US2] Add multi-tab synchronization using storage event listener in app/page.tsx

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - 已登录用户访问登录页 (Priority: P2)

**Goal**: 已登录用户访问登录页面时，系统自动重定向到管理页面，避免重复登录

**Independent Test**: 使用有效认证信息登录后，直接访问登录页面 URL，验证是否被重定向到管理页面

### Implementation for User Story 3

- [x] T015 [US3] Implement authentication check logic in app/(auth)/login/page.tsx using useEffect hook
- [x] T016 [US3] Add token verification API call in app/(auth)/login/page.tsx using lib/utils/auth.ts
- [x] T017 [US3] Add redirect logic to /dashboard when user is already authenticated in app/(auth)/login/page.tsx
- [x] T018 [US3] Add loading state display during authentication check in app/(auth)/login/page.tsx

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T019 [P] Add TypeScript type definitions for all new components and functions
- [ ] T020 [P] Add error boundary handling for authentication errors
- [x] T021 [P] Optimize authentication check to avoid unnecessary API calls (cache recent results)
- [x] T022 [P] Add logging for authentication routing decisions in development mode
- [ ] T023 [P] Update documentation in README.md or docs/ about authentication routing behavior
- [ ] T024 Run quickstart.md validation to ensure all test scenarios pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Shares implementation with US1 in app/page.tsx, but independently testable
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Independent implementation in login page, independently testable

### Within Each User Story

- API endpoint before client-side calls
- Core implementation before integration
- Error handling after core logic
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T001, T002)
- All Foundational tasks marked [P] can run in parallel (T004, T005)
- Once Foundational phase completes, User Stories 1 and 2 can start in parallel (they share app/page.tsx but can be implemented together)
- User Story 3 can be implemented independently in parallel with US1/US2
- Polish phase tasks marked [P] can run in parallel

---

## Parallel Example: User Story 1 & 2

```bash
# User Stories 1 and 2 share app/page.tsx, so they should be implemented together:
# T006-T010 (US1) and T011-T014 (US2) work on the same file sequentially

# But User Story 3 can run in parallel:
Task: "Implement authentication check in app/(auth)/login/page.tsx" (T015-T018)
```

---

## Parallel Example: Foundational Phase

```bash
# These can run in parallel:
Task: "Create TypeScript types in types/auth.types.ts" (T004)
Task: "Create auth utility function in lib/utils/auth.ts" (T005)
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (未登录用户重定向)
4. Complete Phase 4: User Story 2 (已登录用户重定向)
5. **STOP and VALIDATE**: Test both user stories independently
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (Basic routing protection)
3. Add User Story 2 → Test independently → Deploy/Demo (Complete root path routing)
4. Add User Story 3 → Test independently → Deploy/Demo (Login page protection)
5. Add Polish phase → Final optimizations

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Stories 1 & 2 (app/page.tsx) - sequential within file
   - Developer B: User Story 3 (app/(auth)/login/page.tsx) - independent
3. Stories complete and integrate independently
4. Team works on Polish phase together

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- User Stories 1 and 2 share app/page.tsx, so they should be implemented together but are independently testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
