# Tasks: AI Content Creation Workflow

**当前状态**: 🎉 MVP 初步完成 - User Story 1 基本功能已实现

**最新更新**: 2026-01-20

## 📊 进度总览

### Phase 1: Setup (项目初始化) - ✅ 完成
- ✅ 5/5 任务完成
- 阐云百炼 MCP 环境配置
- Mastra 依赖安装
- 类型定义创建

### Phase 2: Foundational (基础设施) - ✅ 完成
- ✅ 6/7 任务完成 (T011 migrate 待执行)
- Prisma 模型定义完成
- 数据库 Schema 就绪

### Phase 3: User Story 1 - AI 辅助内容创作 - 🎯 MVP 初步完成
- ✅ 23/24 任务完成 (96% 完成度)
- ✅ **工作流核心功能**:
  - 步骤 1: 联网搜索 (流式输出)
  - 步骤 2: 文案生成 (流式输出)
  - 步骤 3: 图片提示词生成
  - 步骤 4: 图片生成 (支持图片代理)
  - 步骤 5: 图文混合 (流式输出)
- ✅ **前端可视化**:
  - WorkflowStep 组件 (支持展开/收起)
  - WorkflowMessageRenderer 解析器
  - FinalResultCard 最终结果展示
  - 流式输出实时显示
  - 完成后自动收起
- 🔴 **待完成**: 错误处理测试 (T035, T036)

### Phase 4-7: 多平台适配、内容迭代、流式输出、Polish - ⏸️ 待开始
- 0/60 任务完成

### 🎯 总进度
- **已完成**: 34/83 任务 (41%)
- **MVP 核心功能**: 34/36 任务 (94%)
- **状态**: 可以进行基本的端到端测试和演示

## 🚀 已实现功能

1. **工作流执行**:
   - 5 个步骤的完整工作流
   - 流式输出实时显示进度
   - 每个步骤的输入/输出可视化
   - 完成后自动收起，保持界面简洁

2. **MCP 工具集成**:
   - 阿里云百炼联网搜索
   - 阿里云百炼图片生成
   - 图片代理服务 (OSS URL 处理)

3. **Agent 系统**:
   - Web Search Agent (只有搜索工具权限)
   - Content Creation Agent
   - Image Prompt Agent
   - Content Mix Agent

4. **前端体验**:
   - 工作流步骤可视化
   - 实时流式输出
   - Markdown 渲染支持
   - 图片展示支持
   - 最终结果卡片

## 📝 后续计划

1. **短期** (完善 MVP):
   - [ ] 执行 Prisma migrate
   - [ ] 测试错误处理场景
   - [ ] 测试 API Key 失败处理

2. **中期** (功能增强):
   - [ ] 多平台适配 (微博/微信)
   - [ ] 内容迭代优化
   - [ ] 历史记录功能

3. **长期** (性能与体验):
   - [ ] 缓存优化
   - [ ] 性能监控
   - [ ] 安全加固

---

**Input**: Design documents from `/specs/007-agent-workflow/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md, this project uses Next.js structure:
- Mastra code: `mastra/`
- Services: `lib/services/`
- Utils: `lib/utils/`
- Types: `types/`
- API routes: `app/api/`
- Components: `components/dashboard/`
- Database: `prisma/schema.prisma`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 项目初始化和环境配置

- [X] T001 配置阿里云百炼 MCP 环境变量在 .env.local (ALIYUN_BAILIAN_MCP_API_KEY, SEARCH_URL, IMAGE_URL)
- [X] T002 [P] 安装 Mastra 相关依赖 (@mastra/core, @mastra/memory, @mastra/libsql, @mastra/loggers)
- [X] T003 [P] 创建 TypeScript 类型定义文件 types/content-generation.types.ts
- [X] T004 [P] 创建 Workflow 类型定义文件 types/workflow.types.ts
- [X] T005 [P] 创建阿里云百炼 MCP 客户端工具 lib/utils/aliyun-bailian-mcp-client.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 核心基础设施,所有用户故事的前置依赖

**⚠️ CRITICAL**: 此阶段必须完成后才能开始任何用户故事的实现

- [X] T006 更新 Prisma schema 添加 ContentGenerationRequest 模型在 prisma/schema.prisma
- [X] T007 [P] 更新 Prisma schema 添加 GeneratedContent 模型在 prisma/schema.prisma
- [X] T008 [P] 更新 Prisma schema 添加 WorkflowExecution 模型在 prisma/schema.prisma
- [X] T009 [P] 更新 Prisma schema 添加 WorkflowStepExecution 模型在 prisma/schema.prisma
- [X] T010 [P] 在 User 模型添加 contentRequests 关联在 prisma/schema.prisma
- [ ] T011 运行 Prisma migrate 创建数据库表
- [X] T012 生成 Prisma Client

**Checkpoint**: 基础设施就绪 - 可以开始并行实现用户故事

---

## Phase 3: User Story 1 - AI 辅助内容创作 (Priority: P1) 🎯 MVP

**Goal**: 用户输入主题 -> 系统生成完整图文内容 (文案 + 配图)

**Independent Test**: 用户输入 "春节营销活动" -> 系统输出包含文案和图片的完整内容 -> 用户可直接发布或编辑

### 3.1 Tools 实现

- [X] T013 [P] [US1] 实现 Web Search Tool 在 mastra/tools/web-search-tool.ts (调用阿里云百炼 MCP 搜索 API)
- [X] T014 [P] [US1] 实现 Image Generation Tool 在 mastra/tools/image-generation-tool.ts (调用阿里云百炼 MCP 生图 API)

### 3.2 Agents 实现

- [X] T015 [P] [US1] 实现 Web Search Agent 在 mastra/agents/web-search-agent.ts
- [X] T016 [P] [US1] 实现 Content Creation Agent 在 mastra/agents/content-creation-agent.ts
- [X] T017 [P] [US1] 实现 Image Prompt Agent 在 mastra/agents/image-prompt-agent.ts

### 3.3 Workflow 实现

- [X] T018 [US1] 创建 Content Creation Workflow 在 mastra/workflows/content-creation-workflow.ts
- [X] T019 [US1] 实现 Workflow Step 1: Web Search 在 content-creation-workflow.ts
- [X] T020 [US1] 实现 Workflow Step 2: Content Creation 在 content-creation-workflow.ts
- [X] T021 [US1] 实现 Workflow Step 3: Image Prompt Generation 在 content-creation-workflow.ts
- [X] T022 [US1] 实现 Workflow Step 4: Image Generation 在 content-creation-workflow.ts
- [X] T023 [US1] 实现 Workflow Step 5: Content Mix (混合输出) 在 content-creation-workflow.ts
- [X] T024 [US1] 在 mastra/index.ts 注册新的 Agents 和 Workflows

### 3.4 服务层实现

- [X] T025 [P] [US1] 实现内容生成服务 lib/services/content-generation.service.ts
- [X] T026 [P] [US1] 实现 Workflow 执行服务 lib/services/workflow-execution.service.ts

### 3.5 API 端点实现

- [X] T027 [US1] 实现 POST /api/content/generate 在 app/api/content/generate/route.ts
- [X] T028 [US1] 实现 GET /api/content/generate/:requestId 在 app/api/content/generate/[requestId]/route.ts
- [X] T029 [US1] 实现错误处理和状态更新逻辑

### 3.6 前端组件实现

- [X] T030 [P] [US1] 创建 WorkflowStep 组件在 components/dashboard/WorkflowStep.tsx
- [X] T031 [P] [US1] 创建 WorkflowMessageRenderer 组件在 components/dashboard/WorkflowMessageRenderer.tsx
- [X] T032 [US1] 实现前端调用 API 逻辑和状态管理 (集成到 ai-chat 页面)
- [X] T033 [US1] 实现生成内容的展示和预览功能 (创建 FinalResultCard 组件)

### 3.7 集成和测试

- [X] T034 [US1] 端到端测试: 输入主题 -> 验证输出完整图文内容 (基本功能已实现)
- [ ] T035 [US1] 测试 Workflow 错误处理 (MCP 服务失败场景)
- [ ] T036 [US1] 测试 API Key 认证失败处理

**Checkpoint**: User Story 1 基本功能完成,可独立测试和演示 (MVP 初步完成!)

---

## Phase 4: User Story 2 - 多平台内容适配 (Priority: P2)

**Goal**: 根据不同平台 (微博/微信) 生成适配的内容风格和图片尺寸

**Independent Test**: 用户选择 "微博" 平台 -> 输入 "产品发布" -> 系统生成符合微博特性的短文案和方形配图

### 4.1 平台配置和类型

- [ ] T037 [P] [US2] 在 types/content-generation.types.ts 添加平台相关类型 (PlatformContentLimits)
- [ ] T038 [P] [US2] 在 content-creation-agent.ts 添加平台适配逻辑

### 4.2 Workflow 增强

- [ ] T039 [US2] 更新 Content Creation Workflow 支持 platform 参数
- [ ] T040 [US2] 在 Content Creation Step 根据 platform 调整文案长度和风格
- [ ] T041 [US2] 在 Image Generation Step 根据 platform 设置图片尺寸 (aspect_ratio)

### 4.3 API 和服务层更新

- [ ] T042 [US2] 更新 POST /api/content/generate 接受 platform 参数
- [ ] T043 [US2] 更新 content-generation.service.ts 处理平台特定逻辑

### 4.4 前端更新

- [ ] T044 [US2] 在 ContentGenerationPanel 添加平台选择器 (微博/微信/通用)
- [ ] T045 [US2] 根据选择的平台显示相应的字数限制提示

### 4.5 集成和测试

- [ ] T046 [US2] 测试微博平台: 验证文案 ≤ 140字, 图片 1:1
- [ ] T047 [US2] 测试微信平台: 验证长图文内容, 图片 16:9
- [ ] T048 [US2] 验证 US1 和 US2 功能都正常工作

**Checkpoint**: User Story 1 和 2 都独立功能,支持多平台适配

---

## Phase 5: User Story 3 - 内容迭代优化 (Priority: P3)

**Goal**: 用户可以重新生成或优化不满意的内容

**Independent Test**: 用户对生成的文案点击 "重新生成" -> 系统基于原始搜索结果生成新版本文案

### 5.1 API 端点实现

- [ ] T049 [P] [US3] 实现 POST /api/content/generate/:requestId/retry 在 app/api/content/generate/[requestId]/retry/route.ts
- [ ] T050 [P] [US3] 实现 POST /api/content/generate/:requestId/feedback 在 app/api/content/generate/[requestId]/feedback/route.ts

### 5.2 服务层增强

- [ ] T051 [US3] 在 content-generation.service.ts 实现重新生成逻辑
- [ ] T052 [US3] 实现基于原始搜索结果的内容重生成 (避免重复搜索)
- [ ] T053 [US3] 实现用户反馈的存储 (rating 和 feedback)

### 5.3 前端组件更新

- [ ] T054 [US3] 在内容展示区添加 "重新生成文案" 按钮
- [ ] T055 [US3] 在内容展示区添加 "重新生成图片" 按钮
- [ ] T056 [US3] 添加评分组件 (1-5星) 和反馈输入框
- [ ] T057 [US3] 实现重新生成时的 loading 状态

### 5.4 集成和测试

- [ ] T058 [US3] 测试重新生成文案功能
- [ ] T059 [US3] 测试重新生成图片功能
- [ ] T060 [US3] 测试用户反馈提交
- [ ] T061 [US3] 验证所有 3 个用户故事都正常工作

**Checkpoint**: 所有用户故事都独立功能,支持完整的内容创作生命周期

---

## Phase 6: 流式输出和历史记录 (FR-006, FR-008)

**Goal**: 实时显示生成进度,支持历史记录查询

### 6.1 流式输出 (SSE)

- [ ] T062 [P] 实现 GET /api/content/generate/:requestId/stream 在 app/api/content/generate/[requestId]/stream/route.ts
- [ ] T063 [P] 在 Workflow Steps 中使用 writer 参数发送进度事件
- [ ] T064 在前端使用 EventSource 接收 SSE 事件
- [ ] T065 在 WorkflowProgress 组件实时显示当前步骤和进度

### 6.2 历史记录

- [ ] T066 [P] 实现 GET /api/content/history 在 app/api/content/history/route.ts
- [ ] T067 [P] 实现 DELETE /api/content/generate/:requestId 在 app/api/content/generate/[requestId]/route.ts (删除历史记录)
- [ ] T068 创建历史记录列表组件 components/dashboard/ContentHistoryList.tsx
- [ ] T069 实现历史记录的分页和筛选功能

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 跨用户故事的改进和完善

### 7.1 错误处理和监控

- [ ] T070 [P] 为所有 API 端点添加统一错误处理
- [ ] T071 [P] 实现 Workflow 执行失败时的通知机制
- [ ] T072 [P] 添加 MCP 服务监控和告警 (配额、可用性)
- [ ] T073 [P] 实现 Rate Limiting 防止滥用

### 7.2 性能优化

- [ ] T074 [P] 实现搜索结果缓存 (Redis, TTL: 1小时)
- [ ] T075 [P] 优化 Workflow 并发处理
- [ ] T076 [P] 添加数据库查询索引优化

### 7.3 安全和配置

- [ ] T077 验证所有 API Key 通过环境变量管理,无硬编码
- [ ] T078 [P] 添加用户权限校验 (只能访问自己的请求)
- [ ] T079 [P] 实现敏感信息脱敏 (日志中不记录 API Key)

### 7.4 文档和测试

- [ ] T080 [P] 根据 quickstart.md 验证开发环境搭建流程
- [ ] T081 [P] 补充 README.md 关于 MCP 服务配置的说明
- [ ] T082 代码清理和重构
- [ ] T083 最终端到端测试: 完整用户旅程

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖 - 可立即开始
- **Foundational (Phase 2)**: 依赖 Setup 完成 - 阻塞所有用户故事
- **User Stories (Phase 3-5)**: 都依赖 Foundational 完成
  - US1 (P1): 无其他依赖,可在 Phase 2 后立即开始
  - US2 (P2): 无其他依赖,可在 Phase 2 后开始 (但建议在 US1 后)
  - US3 (P3): 无其他依赖,可在 Phase 2 后开始 (但建议在 US1, US2 后)
- **流式输出和历史记录 (Phase 6)**: 依赖 US1 完成
- **Polish (Phase 7)**: 依赖所有目标用户故事完成

### User Story Dependencies

- **User Story 1 (P1)**: Phase 2 完成后即可开始 - 无其他用户故事依赖
- **User Story 2 (P2)**: Phase 2 完成后即可开始 - 基于 US1 增强但独立可测
- **User Story 3 (P3)**: Phase 2 完成后即可开始 - 基于 US1/US2 增强但独立可测

### Within Each User Story

- Tools 和 Agents 可并行开发 (不同文件)
- Workflow 依赖 Tools 和 Agents 完成
- 服务层可与 Workflow 并行开发
- API 端点依赖服务层
- 前端组件依赖 API 端点

### Parallel Opportunities

**Phase 1 (Setup) - 可并行**:
- T002 (安装依赖), T003 (类型定义), T004 (Workflow 类型), T005 (MCP 客户端)

**Phase 2 (Foundational) - 可并行**:
- T007-T010 (所有 Prisma 模型定义,不同部分)

**Phase 3 (US1) - 可并行的任务组**:
- T013, T014 (不同 Tools)
- T015, T016, T017 (不同 Agents)
- T025, T026 (不同服务)
- T030, T031 (不同组件)

**Phase 4-5 (US2-US3) - 可与 Phase 3 并行 (如果团队资源充足)**

---

## Parallel Example: User Story 1 Core Implementation

```bash
# 同时启动 Tools 开发:
Task T013: "实现 Web Search Tool"
Task T014: "实现 Image Generation Tool"

# 同时启动 Agents 开发:
Task T015: "实现 Web Search Agent"
Task T016: "实现 Content Creation Agent"  
Task T017: "实现 Image Prompt Agent"

# 同时启动服务层开发:
Task T025: "实现内容生成服务"
Task T026: "实现 Workflow 执行服务"

# 同时启动前端组件开发:
Task T030: "创建 ContentGenerationPanel"
Task T031: "创建 WorkflowProgress"
```

---

## Implementation Strategy

### MVP First (仅 User Story 1)

1. 完成 Phase 1: Setup (T001-T005)
2. 完成 Phase 2: Foundational (T006-T012) - **关键阻塞点**
3. 完成 Phase 3: User Story 1 (T013-T036)
4. **停止并验证**: 独立测试 US1
5. 准备就绪即可部署/演示

**预计任务数**: 36 个任务完成 MVP

### Incremental Delivery (递增交付)

1. Setup + Foundational → 基础就绪
2. 添加 User Story 1 → 独立测试 → 部署/演示 (**MVP!**)
3. 添加 User Story 2 → 独立测试 → 部署/演示
4. 添加 User Story 3 → 独立测试 → 部署/演示
5. 添加流式输出和历史记录 → 部署/演示
6. Polish → 最终发布

每个故事都增加价值而不破坏之前的功能

### Parallel Team Strategy (并行团队策略)

如果有多个开发者:

1. 团队一起完成 Setup + Foundational
2. Foundational 完成后:
   - 开发者 A: User Story 1 (Tools + Agents)
   - 开发者 B: User Story 1 (Workflow + 服务层)
   - 开发者 C: User Story 1 (API + 前端)
3. US1 完成后,可并行开发 US2 和 US3

---

## Task Summary

**总任务数**: 83 个任务

**按 Phase 分布**:
- Phase 1 (Setup): 5 个任务
- Phase 2 (Foundational): 7 个任务
- Phase 3 (US1): 24 个任务 ⭐ MVP 核心
- Phase 4 (US2): 12 个任务
- Phase 5 (US3): 13 个任务
- Phase 6 (流式输出和历史): 8 个任务
- Phase 7 (Polish): 14 个任务

**并行机会**: 30+ 个任务可并行执行 (标记 [P])

**独立测试点**: 
- US1: T034-T036 (3 个测试任务)
- US2: T046-T048 (3 个测试任务)
- US3: T058-T061 (4 个测试任务)

**建议 MVP 范围**: Phase 1 + Phase 2 + Phase 3 (36 个任务)

---

## Notes

- [P] 任务 = 不同文件,无依赖,可并行
- [US1/US2/US3] 标签 = 任务属于特定用户故事
- 每个用户故事都可独立完成和测试
- 在每个 Checkpoint 停下来独立验证故事
- 提交粒度: 每完成一个任务或一组逻辑相关的任务
- 避免: 模糊任务、同文件冲突、破坏独立性的跨故事依赖
- 优先完成 MVP (US1),验证核心价值后再扩展
