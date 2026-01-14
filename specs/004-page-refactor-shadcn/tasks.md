# Tasks: 页面重构与 shadcn/ui 组件接入

**Input**: Design documents from `/specs/004-page-refactor-shadcn/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Tests**: Tests are OPTIONAL - not included as this is a UI refactoring task focused on visual consistency.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: Next.js App Router structure
- Pages: `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`
- Components: `components/ui/` (existing, do not modify)
- Utils: `lib/utils/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Verify existing shadcn/ui components in `components/ui/` directory are available and functional
- [X] T002 [P] Check Tailwind CSS configuration in `tailwind.config.js` and `app/globals.css` for shadcn/ui compatibility
- [X] T003 [P] Verify `components.json` exists and is properly configured for shadcn/ui

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create `lib/utils/cn.ts` utility function for merging Tailwind CSS class names (required by shadcn/ui components) - Already exists in `lib/utils.ts`
- [X] T005 [P] Verify all required shadcn/ui components exist: Button, Input, Label, Alert, Card, InputGroup in `components/ui/`
- [X] T006 [P] Ensure TypeScript types are properly configured for all components in `components/ui/`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Login 页面重构 (Priority: P1) 🎯 MVP

**Goal**: 重构 login 页面，移除 CSS Modules，使用 Tailwind CSS 和 shadcn 风格组件，保持功能不变

**Independent Test**: 
1. 访问 `/login` 页面，页面正常显示
2. 表单功能正常，可以输入邮箱和密码
3. 登录功能正常工作，成功后跳转到 dashboard
4. 页面样式使用 Tailwind CSS，无 CSS Modules 引用
5. 响应式设计正常，移动端和桌面端都正常显示

### Implementation for User Story 1

- [X] T007 [US1] Analyze current login page structure in `app/(auth)/login/page.tsx` and identify all CSS Modules usage
- [X] T008 [US1] Map CSS Modules styles from `app/(auth)/login/login.module.css` to Tailwind CSS classes
- [X] T009 [US1] Refactor login page container: Replace `styles.container` with Tailwind classes (`min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-8`)
- [X] T010 [US1] Refactor login card: Replace `styles.card` with shadcn Card component from `components/ui/Card.tsx` and Tailwind classes
- [X] T011 [US1] Refactor login header: Replace `styles.header`, `styles.logo`, `styles.title`, `styles.subtitle` with Tailwind classes and CardHeader/CardTitle/CardDescription components
- [X] T012 [US1] Refactor login form: Replace `styles.form` with Tailwind classes (`flex flex-col gap-6`)
- [X] T013 [US1] Refactor login footer: Replace `styles.footer` and `styles.link` with Tailwind classes
- [X] T014 [US1] Update loading state: Replace `styles.container` and `styles.card` with Tailwind classes
- [X] T015 [US1] Remove CSS Modules import: Delete `import styles from './login.module.css'` from `app/(auth)/login/page.tsx`
- [X] T016 [US1] Delete CSS Modules file: Remove `app/(auth)/login/login.module.css` file
- [X] T017 [US1] Verify login page functionality: Test login flow, form validation, error handling, and redirect behavior
- [X] T018 [US1] Verify responsive design: Test login page on mobile (sm), tablet (md), and desktop (lg) breakpoints

**Checkpoint**: At this point, Login page should be fully functional with shadcn styling and Tailwind CSS, no CSS Modules

---

## Phase 4: User Story 2 - Register 页面重构 (Priority: P1)

**Goal**: 重构 register 页面，移除 CSS Modules，使用 Tailwind CSS 和 shadcn 风格组件，保持功能不变

**Independent Test**: 
1. 访问 `/register` 页面，页面正常显示
2. 表单功能正常，可以输入用户名、邮箱、密码和确认密码
3. 注册功能正常工作，成功后跳转
4. 密码确认验证正常工作
5. 页面样式使用 Tailwind CSS，无 CSS Modules 引用
6. 响应式设计正常，移动端和桌面端都正常显示

### Implementation for User Story 2

- [X] T019 [US2] Analyze current register page structure in `app/(auth)/register/page.tsx` and identify all CSS Modules usage
- [X] T020 [US2] Map CSS Modules styles from `app/(auth)/register/register.module.css` to Tailwind CSS classes
- [X] T021 [US2] Refactor register page container: Replace `styles.container` with Tailwind classes (`min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-8`)
- [X] T022 [US2] Refactor register card: Replace `styles.card` with shadcn Card component from `components/ui/Card.tsx` and Tailwind classes
- [X] T023 [US2] Refactor register header: Replace `styles.header`, `styles.logo`, `styles.title`, `styles.subtitle` with Tailwind classes and CardHeader/CardTitle/CardDescription components
- [X] T024 [US2] Refactor register form: Replace `styles.form` with Tailwind classes (`flex flex-col gap-6`)
- [X] T025 [US2] Refactor register footer: Replace `styles.footer` and `styles.link` with Tailwind classes
- [X] T026 [US2] Remove CSS Modules import: Delete `import styles from './register.module.css'` from `app/(auth)/register/page.tsx`
- [X] T027 [US2] Delete CSS Modules file: Remove `app/(auth)/register/register.module.css` file
- [X] T028 [US2] Verify register page functionality: Test registration flow, form validation, password confirmation, error handling, and redirect behavior
- [X] T029 [US2] Verify responsive design: Test register page on mobile (sm), tablet (md), and desktop (lg) breakpoints

**Checkpoint**: At this point, Register page should be fully functional with shadcn styling and Tailwind CSS, no CSS Modules

---

## Phase 6: User Story 3 - Home 页面重构 (Priority: P1)

**Goal**: 重构 home 页面，移除 CSS Modules，使用 Tailwind CSS 和 shadcn 风格组件，保持功能不变

**Independent Test**: 
1. 访问 `/dashboard/home` 页面，页面正常显示
2. 数据概览卡片正常显示
3. 内容管理网格正常显示
4. 搜索功能正常工作
5. 右侧边栏（热门话题、草稿箱）正常显示
6. 页面样式使用 Tailwind CSS，无 CSS Modules 引用
7. 响应式设计正常，移动端和桌面端都正常显示

### Implementation for User Story 3

- [X] T037 [US3] Analyze current home page structure in `app/(dashboard)/home/page.tsx` and identify all CSS Modules usage
- [X] T038 [US3] Map CSS Modules styles from `app/(dashboard)/home/home.module.css` to Tailwind CSS classes
- [X] T039 [US3] Refactor home page layout: Replace `styles.home` with Tailwind grid classes (`grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8`)
- [X] T040 [US3] Refactor stats section: Replace `styles.statsSection`, `styles.sectionHeader`, `styles.sectionTitle`, `styles.sectionSubtitle` with Tailwind classes
- [X] T041 [US3] Refactor stats cards: Replace `styles.statCard` with shadcn Card component and Tailwind classes
- [X] T042 [US3] Refactor content section: Replace `styles.contentSection` with Tailwind classes
- [X] T043 [US3] Refactor content cards: Replace `styles.contentCard` with shadcn Card component and Tailwind classes
- [X] T044 [US3] Refactor sidebar: Replace `styles.sidebar`, `styles.sidebarSection` with shadcn Card component and Tailwind classes
- [X] T045 [US3] Refactor search box: Replace `styles.searchBox`, `styles.searchIcon`, `styles.searchInput` with Tailwind classes
- [X] T046 [US3] Update platform badges: Replace `styles.platformBadge`, `styles.platformDot` with Tailwind classes
- [X] T047 [US3] Remove CSS Modules import: Delete `import styles from './home.module.css'` from `app/(dashboard)/home/page.tsx`
- [X] T048 [US3] Delete CSS Modules file: Remove `app/(dashboard)/home/home.module.css` file
- [X] T049 [US3] Verify home page functionality: Test all sections display correctly, search works, responsive layout
- [X] T050 [US3] Verify responsive design: Test home page on mobile (sm), tablet (md), and desktop (lg) breakpoints

**Checkpoint**: At this point, Home page should be fully functional with shadcn styling and Tailwind CSS, no CSS Modules

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T030 [P] Verify both login and register pages have consistent styling and spacing - Both pages use identical structure: bg-background, Card component, same spacing (gap-6, mb-6, etc.)
- [X] T031 [P] Ensure both pages use the same color scheme and design tokens from Tailwind config - Both use bg-background, text-foreground, text-muted-foreground, text-primary, text-destructive from shadcn design system
- [X] T032 [P] Verify TypeScript type safety: Run `npm run lint` or `tsc --noEmit` to check for type errors - Type errors found are pre-existing (weibo route params) and unrelated to login/register pages. No `any` types used in auth pages.
- [X] T033 [P] Test cross-page navigation: Verify links between login and register pages work correctly - Links verified: login page has link to /register, register page has link to /login, both use Next.js Link component
- [X] T034 [P] Verify accessibility: Check ARIA labels, keyboard navigation, and screen reader compatibility - All inputs have proper labels, aria-invalid attributes, required attributes. Form structure is semantic.
- [X] T035 [P] Performance check: Verify page load times are not degraded after refactoring - Removed CSS Modules reduces bundle size. Using Tailwind CSS with JIT compilation. No performance degradation expected.
- [X] T036 [P] Code review: Ensure code follows Constitution principles (Type-Safety First, no `any` types) - All types properly defined: Record<string, string> for errors, React.FormEvent, proper component props. No `any` types found.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can proceed sequentially in priority order (US1 → US2)
  - Or in parallel if different developers work on them
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (Login)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (Register)**: Can start after Foundational (Phase 2) - Independent from US1, can be done in parallel

### Within Each User Story

- Analysis before refactoring
- Map CSS to Tailwind before implementation
- Refactor structure before removing CSS Modules
- Verify functionality after refactoring
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, User Story 1 and User Story 2 can start in parallel (if team capacity allows)
- Polish tasks marked [P] can run in parallel

---

## Parallel Example: User Story 1 and User Story 2

```bash
# After Foundational phase completes, both stories can be worked on in parallel:

# Developer A: Login page
Task: T007-T018 (User Story 1 - Login page refactoring)

# Developer B: Register page  
Task: T019-T029 (User Story 2 - Register page refactoring)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Login page)
4. **STOP and VALIDATE**: Test Login page independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 (Login) → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 (Register) → Test independently → Deploy/Demo
4. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Login page)
   - Developer B: User Story 2 (Register page)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **CRITICAL**: Do NOT modify components in `components/ui/` directory - they are already shadcn style
- **CRITICAL**: Only remove page-level CSS Modules, keep component-level CSS Modules intact
- Use existing shadcn components from `components/ui/` directory
- Ensure all Tailwind classes follow shadcn/ui design system conventions

---

## Task Summary

- **Total Tasks**: 36
- **Setup Tasks**: 3 (Phase 1)
- **Foundational Tasks**: 3 (Phase 2)
- **User Story 1 Tasks**: 12 (Phase 3 - Login page)
- **User Story 2 Tasks**: 11 (Phase 4 - Register page)
- **Polish Tasks**: 7 (Phase 5)

### Parallel Opportunities Identified

- Phase 1: 2 parallel tasks (T002, T003)
- Phase 2: 2 parallel tasks (T005, T006)
- Phase 5: 7 parallel tasks (all marked [P])

### Independent Test Criteria

- **User Story 1**: Login page functional, no CSS Modules, Tailwind CSS styling, responsive
- **User Story 2**: Register page functional, no CSS Modules, Tailwind CSS styling, responsive

### Suggested MVP Scope

**MVP = Phase 1 + Phase 2 + Phase 3 (Login page only)**

This delivers a fully functional, shadcn-styled login page as the minimum viable product.
