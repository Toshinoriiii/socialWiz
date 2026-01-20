# Implementation Plan: AI Content Creation Workflow

**Branch**: `007-agent-workflow` | **Date**: 2026-01-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-agent-workflow/spec.md`

## Summary

实现基于 Mastra 框架的 AI 内容创作工作流,通过串联多个 AI Agents 和 Tools,实现从用户输入到完整图文内容输出的自动化流程:用户输入提示词 -> 调用阿里云百炼 MCP 搜索服务 -> Content Creation Agent 生成文案 -> Image Prompt Agent 生成图片描述 -> 调用阿里云百炼 MCP 生图服务 -> 混合输出完整内容。

## Technical Context

**Language/Version**: TypeScript 5.9+  
**Primary Dependencies**: 
- Mastra Core (@mastra/core) - Agent/Workflow 框架
- 阿里云百炼 MCP - 搜索和生图服务 (远程 HTTP API)
- Next.js 14+ - Web 应用框架
- Zod - Schema 验证
- Prisma - 数据库 ORM
- Redis - 缓存和会话管理

**Storage**: PostgreSQL 14+ (via Prisma) + LibSQLStore (for Mastra memory)  
**Testing**: Jest + React Testing Library  
**Target Platform**: Web (Next.js App Router)  
**Project Type**: Web application  
**Performance Goals**: 
- 整个 Workflow 执行时间 < 60s
- 支持 10+ 并发请求
- Workflow 成功率 > 95%

**Constraints**: 
- 依赖阿里云百炼 MCP 远程服务 (搜索、生图)
- 需要考虑 MCP API 限流、认证和错误处理
- 流式输出需要前后端协同
- MCP 客户端已在远程部署,需通过 HTTP API 调用

**Scale/Scope**: 
- 3 个新 Agents (Web Search, Content Creation, Image Prompt)
- 2+ 个新 Tools (Search Tool, Image Generation Tool)
- 1 个新 Workflow (Content Creation Workflow)
- API 路由和前端集成

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

验证以下 Constitution 原则的合规性:

- ✅ **Type-Safety First**: 所有 Agents、Tools、Workflows 使用完整的 TypeScript 类型定义,输入输出通过 Zod Schema 验证
- ✅ **Service Layer Architecture**: Agent 调用通过服务层封装,API 路由仅处理请求/响应
- ✅ **AI Model Abstraction**: 通过 Mastra 的 Agent 系统统一管理,支持模型切换 (deepseek/deepseek-chat)
- ✅ **Platform Agnostic Design**: Content Creation Agent 支持多平台适配参数
- ✅ **API-First Development**: 先实现 API 端点 (`/api/content/generate`),再构建前端组件
- ✅ **Testing Discipline**: 关键业务逻辑 (Workflow 执行、错误处理) 需要单元测试覆盖

**Violations**: 无违反原则

## Project Structure

### Documentation (this feature)

```text
specs/007-agent-workflow/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output - 研究搜索 API、生图 MCP、Workflow 最佳实践
├── data-model.md        # Phase 1 output - 数据模型定义
├── quickstart.md        # Phase 1 output - 快速开始指南
├── contracts/           # Phase 1 output - API 契约定义
│   ├── content-generation-api.yaml  # 内容生成 API 规范
│   └── workflow-types.ts            # Workflow 类型定义
└── spec.md              # Feature specification (already created)
```

### Source Code (repository root)

```text
mastra/
├── agents/
│   ├── weather-agent.ts              # 现有示例 Agent
│   ├── web-search-agent.ts           # NEW: Web 搜索 Agent
│   ├── content-creation-agent.ts     # NEW: 内容创作 Agent
│   └── image-prompt-agent.ts         # NEW: 图片提示词 Agent
├── tools/
│   ├── weather-tool.ts               # 现有示例 Tool
│   ├── web-search-tool.ts            # NEW: Web 搜索 Tool
│   └── image-generation-tool.ts      # NEW: 生图 Tool (集成 MCP)
├── workflows/
│   ├── weather-workflow.ts           # 现有示例 Workflow
│   └── content-creation-workflow.ts  # NEW: 内容创作 Workflow
└── index.ts                          # 更新: 注册新 Agents/Workflows

lib/
├── services/
│   ├── content-generation.service.ts # NEW: 内容生成服务层
│   └── workflow-execution.service.ts # NEW: Workflow 执行服务层
└── utils/
    └── aliyun-bailian-mcp-client.ts  # NEW: 阿里云百炼 MCP 客户端工具

app/api/
├── content/
│   └── generate/
│       └── route.ts                  # NEW: 内容生成 API 端点
└── workflow/
    └── status/
        └── route.ts                  # NEW: Workflow 状态查询 API

types/
├── content-generation.types.ts       # NEW: 内容生成相关类型
└── workflow.types.ts                 # NEW: Workflow 相关类型

prisma/schema.prisma                  # 更新: 添加内容生成历史表

components/dashboard/
├── ContentGenerationPanel.tsx        # NEW: 内容生成面板组件
└── WorkflowProgress.tsx              # NEW: Workflow 进度显示组件
```

**Structure Decision**: 
采用 Next.js Web 应用结构,所有 Mastra 相关代码放在 `mastra/` 目录,服务层在 `lib/services/`,API 路由在 `app/api/`,前端组件在 `components/dashboard/`。这符合现有项目结构,便于维护和扩展。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

## Phase 0: Research (✅ 已完成)

研究的关键技术点和决策:

1. **Web 搜索 API 选择** ✅
   - **决策**: 使用阿里云百炼 MCP 搜索服务
   - **理由**: 已有服务资源,MCP 协议标准,远程部署通过 HTTP API 调用
   - 详见 `research.md` Section 1

2. **生图服务选择** ✅
   - **决策**: 使用阿里云百炼 MCP 生图服务
   - **理由**: 与搜索服务统一平台,简化集成和认证,远程 HTTP API 调用
   - 详见 `research.md` Section 2

3. **Mastra Workflow 最佳实践** ✅
   - 错误处理: Step-level 和 Workflow-level retry
   - 流式输出: 使用 Agent.stream() 和 writer 参数
   - 状态持久化: LibSQLStore + Prisma
   - 详见 `research.md` Section 3

4. **并发和性能优化** ✅
   - Phase 1 不需要队列,直接执行 Workflow
   - 使用 Redis 缓存搜索结果
   - 详见 `research.md` Section 3.5

**输出**: ✅ `research.md` - 包含所有技术决策和实现建议

## Phase 1: Design & Contracts (✅ 已完成)

基于 Phase 0 的研究结果:

1. **数据模型设计** ✅ `data-model.md`
   - ContentGenerationRequest 表结构
   - GeneratedContent 表结构
   - WorkflowExecution 表结构
   - WorkflowStepExecution 表结构
   - 完整的 TypeScript 类型定义

2. **API 契约** ✅ `contracts/`
   - `api-endpoints.md`: 7 个 API 端点规范
     - POST /api/content/generate
     - GET /api/content/generate/:requestId
     - GET /api/content/generate/:requestId/stream (SSE)
     - GET /api/content/history
     - POST /api/content/generate/:requestId/retry
     - DELETE /api/content/generate/:requestId
     - POST /api/content/generate/:requestId/feedback
   - `workflow-types.ts`: Workflow 类型定义
     - 5 个 Step 的 Input/Output Schema
     - Workflow 执行上下文和事件类型
     - 错误类型和 Type Guards

3. **快速开始指南** ✅ `quickstart.md`
   - 开发环境配置 (依赖安装、环境变量)
   - 如何测试单个 Tool
   - 如何测试单个 Agent
   - 如何测试完整 Workflow
   - API 测试示例
   - 前端集成示例
   - 调试技巧和常见问题

## Phase 2: Tasks (待执行)

将在 `/speckit.tasks` 命令中生成详细的任务分解。

## 已完成的工作

### Phase 0: Research (2026-01-20)
- ✅ Web 搜索 API 技术选型 (选择阿里云百炼 MCP)
- ✅ 生图服务技术选型 (选择阿里云百炼 MCP)
- ✅ MCP 远程调用方式研究 (HTTP API)
- ✅ Mastra 错误处理机制研究
- ✅ Mastra 流式输出研究
- ✅ 并发和性能优化策略
- ✅ 生成 `research.md` (435 行)

### Phase 1: Design & Contracts (2026-01-20)
- ✅ 数据模型设计 (Prisma Schema + TypeScript Types)
  - ContentGenerationRequest, GeneratedContent
  - WorkflowExecution, WorkflowStepExecution
  - 完整的类型定义和验证规则
- ✅ API 契约定义
  - 7 个 API 端点的完整规范
  - 请求/响应 Schema
  - 错误代码和 Rate Limiting
- ✅ Workflow 类型定义
  - 5 个 Step 的 Schema
  - 事件类型和监听器接口
  - 错误类型和 Type Guards
- ✅ 快速开始指南
  - 环境配置
  - 测试示例
  - API 使用示例
  - 前端集成指南

### 生成的文档
1. ✅ `spec.md` (99 行) - Feature 规范
2. ✅ `plan.md` (179 行) - 实现计划
3. ✅ `research.md` (427 行) - 技术研究
4. ✅ `data-model.md` (474 行) - 数据模型
5. ✅ `contracts/api-endpoints.md` (580 行) - API 契约
6. ✅ `contracts/workflow-types.ts` (393 行) - Workflow 类型
7. ✅ `quickstart.md` (472 行) - 快速开始

**总计**: 2,624 行完整的规范和设计文档

## Next Steps

1. ✅ 执行 Phase 0 研究,生成 `research.md`
2. ✅ 基于研究结果执行 Phase 1 设计
3. ⏭️ 运行 `/speckit.tasks` 生成详细任务清单
4. ⏭️ 开始实现 Agents, Tools, Workflows
5. ⏭️ 实现 API 端点和服务层
6. ⏭️ 前端集成
7. ⏭️ 测试与优化
