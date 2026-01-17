# Implementation Plan: 平台发布配置管理

**Branch**: `006-platform-publish-config` | **Date**: 2026-01-17 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/006-platform-publish-config/spec.md`

## Summary

实现平台发布配置管理功能,允许用户为每个社交媒体平台创建和管理多个发布配置项。每个配置项包含平台特定的发布参数(如微信的作者、原文链接、创作来源等),在发布内容时可以选择使用预设配置,避免重复输入。技术实现遵循服务层架构,使用 JSON 字段存储平台特定配置数据,前端使用组合组件模式处理不同平台的表单字段。

## Technical Context

**Language/Version**: TypeScript 5.9+ (Next.js 14+ App Router)  
**Primary Dependencies**: 
- Next.js 14+ (React Server Components + Client Components)
- Prisma ORM (数据库操作)
- Zod (配置数据验证)
- React Hook Form (表单管理)
- shadcn/ui (Dialog, Form, Select 等组件)

**Storage**: PostgreSQL 14+ (via Prisma), JSON 字段存储平台特定配置  
**Testing**: Jest + React Testing Library (单元测试), Playwright (E2E 测试)  
**Target Platform**: Web (响应式设计,支持桌面和移动端)  
**Project Type**: Web application (Next.js App Router)  
**Performance Goals**: 
- 配置列表加载 < 500ms
- 配置保存响应 < 1s
- 支持 100+ 配置项无明显性能下降

**Constraints**: 
- 配置数据必须与用户绑定(用户隔离)
- 配置名称在同一用户同一平台下唯一
- 删除配置不影响已发布内容(解耦设计)
- 配置数据必须通过 Zod schema 验证

**Scale/Scope**: 
- 支持 4+ 社交媒体平台(微信、微博、抖音、小红书)
- 单用户最多 50 个配置项(软限制)
- 预计覆盖 3 个主要用户故事

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

验证以下 Constitution 原则的合规性：

- ✅ **Type-Safety First**: 所有新代码包含完整的 TypeScript 类型定义。定义 `PlatformPublishConfig` 接口和平台特定配置接口(如 `WechatPublishConfigData`)。避免使用 `any`,对 JSON 字段使用明确的类型映射。

- ✅ **Service Layer Architecture**: 业务逻辑在 `lib/services/platform-config.service.ts` 实现。API 路由(`app/api/platforms/publish-configs/`)仅负责请求验证、调用服务和返回响应。数据库访问通过 Prisma Client,不在 API 路由中直接操作。

- ⚪ **AI Model Abstraction**: 本功能不涉及 AI 功能,无需验证。

- ✅ **Platform Agnostic Design**: 使用统一的配置数据模型,平台特定字段存储在 JSON 字段中。新增平台只需添加配置字段定义和验证 schema,不破坏现有功能。前端使用组合组件模式(`WechatConfigFields`, `WeiboConfigFields`),易于扩展。

- ✅ **API-First Development**: 先定义和实现 API 端点(`/api/platforms/publish-configs`及其子路由),完成数据模型和服务层,再构建前端组件(`PlatformConfigDialog`, 配置表单等)。

- ✅ **Testing Discipline**: 关键业务逻辑包含测试:
  - 单元测试: `PlatformConfigService` 的 CRUD 操作、配置验证
  - 集成测试: API 端点的请求/响应、权限校验
  - E2E 测试: 配置创建/编辑/删除流程
  - 测试使用 Mock Prisma Client,不依赖真实数据库

**Violations**: 无违反原则。

## Project Structure

### Documentation (this feature)

```text
specs/006-platform-publish-config/
├── spec.md              # Feature specification (已创建)
├── plan.md              # This file (Implementation plan)
├── research.md          # Phase 0 output (技术决策和最佳实践)
├── data-model.md        # Phase 1 output (数据模型详细设计)
├── quickstart.md        # Phase 1 output (快速开始指南)
├── contracts/           # Phase 1 output (API 契约定义)
│   └── api.yaml        # OpenAPI 规范
└── tasks.md             # Phase 2 output (任务分解,由 /speckit.tasks 生成)
```

### Source Code (repository root)

```text
# Next.js App Router 结构
app/
├── api/
│   └── platforms/
│       └── publish-configs/
│           ├── route.ts                    # GET /api/platforms/publish-configs (列表)
│           │                              # POST /api/platforms/publish-configs (创建)
│           └── [configId]/
│               ├── route.ts               # GET/PUT/DELETE /api/platforms/publish-configs/:id
│               └── set-default/
│                   └── route.ts          # POST /api/platforms/publish-configs/:id/set-default
└── (dashboard)/
    └── platforms/
        └── page.tsx                       # 平台管理页面(展示平台列表和配置按钮)

components/
└── dashboard/
    ├── PlatformConfigDialog.tsx          # 配置管理弹窗(列表+创建/编辑入口)
    ├── PlatformConfigForm.tsx            # 配置表单(通用部分)
    └── platform-config-fields/           # 平台特定字段组件
        ├── WechatConfigFields.tsx        # 微信配置字段
        ├── WeiboConfigFields.tsx         # 微博配置字段
        └── index.ts

lib/
├── services/
│   └── platform-config.service.ts        # 配置管理服务(CRUD + 验证)
├── validators/
│   └── platform-config.validator.ts      # Zod schemas for config validation
└── utils/
    └── platform-config.utils.ts          # 配置相关工具函数

types/
└── platform-config.types.ts              # 配置相关类型定义

config/
└── platform.config.ts                    # 平台能力定义(扩展现有文件)
    # 添加 platformConfigFields 配置

prisma/
└── schema.prisma                         # 添加 PlatformPublishConfig 模型
    # 添加迁移脚本

tests/
├── unit/
│   └── services/
│       └── platform-config.service.test.ts
├── integration/
│   └── api/
│       └── platform-configs.test.ts
└── e2e/
    └── platform-config-management.spec.ts
```

**Structure Decision**: 采用 Next.js App Router 结构(Option 2 变体),前后端集成在同一个 Next.js 应用中。API 路由位于 `app/api/`,前端页面和组件分别在 `app/(dashboard)/` 和 `components/`。服务层和类型定义独立于框架,位于 `lib/` 和 `types/`,便于测试和复用。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

无违反原则,无需填写此部分。

---

## Phase 0: Research & Technical Decisions

### Research Topics

1. **JSON 字段存储策略**
   - 研究 Prisma JSON 字段的最佳实践
   - 类型安全的 JSON 数据访问方式
   - JSON 字段的查询和索引策略

2. **平台配置字段定义**
   - 研究各平台 API 文档,确定发布相关参数
   - 微信公众号: author, contentSourceUrl, originType, comment 设置
   - 微博: visibility, comment/repost 设置
   - 设计可扩展的字段定义结构

3. **表单验证策略**
   - Zod schema 与 React Hook Form 集成
   - 平台特定字段的动态验证
   - 错误消息国际化和用户友好提示

4. **组件组合模式**
   - 研究如何设计可复用的表单组件
   - 平台特定字段组件的注册和加载机制
   - Props 传递和状态管理最佳实践

### Research Artifacts

输出文件: `specs/006-platform-publish-config/research.md`

包含内容:
- 每个研究主题的决策和理由
- 考虑过的替代方案
- 技术选型的权衡分析
- 代码示例和最佳实践

---

## Phase 1: Design & Contracts

### Data Model Design

输出文件: `specs/006-platform-publish-config/data-model.md`

包含内容:

1. **PlatformPublishConfig Entity**
   - 字段详细说明
   - 关系定义(与 User 的关系)
   - 约束和索引
   - Prisma schema 定义

2. **Platform-Specific Config Data Structures**
   - `WechatPublishConfigData` 接口定义
   - `WeiboPublishConfigData` 接口定义
   - 其他平台的配置数据结构
   - JSON 字段的类型映射策略

3. **Validation Rules**
   - 配置名称唯一性(per user per platform)
   - 配置数据的 Zod schema
   - 业务规则验证

4. **State Transitions**
   - 配置的生命周期(创建 → 使用 → 更新 → 删除)
   - 默认配置的切换逻辑

### API Contracts

输出文件: `specs/006-platform-publish-config/contracts/api.yaml`

包含内容(OpenAPI 3.0 规范):

1. **GET /api/platforms/publish-configs**
   - 查询参数: `platform` (optional)
   - 响应: 配置列表(200), 认证错误(401)

2. **POST /api/platforms/publish-configs**
   - 请求体: `CreateConfigInput`
   - 响应: 创建的配置(201), 验证错误(400), 冲突(409)

3. **GET /api/platforms/publish-configs/:id**
   - 路径参数: `configId`
   - 响应: 配置详情(200), 未找到(404)

4. **PUT /api/platforms/publish-configs/:id**
   - 请求体: `UpdateConfigInput`
   - 响应: 更新的配置(200), 验证错误(400)

5. **DELETE /api/platforms/publish-configs/:id**
   - 响应: 成功(204), 未找到(404)

6. **POST /api/platforms/publish-configs/:id/set-default**
   - 响应: 成功(200), 未找到(404)

每个端点包含:
- 完整的请求/响应 schema
- 错误响应格式
- 认证要求
- 示例 payload

### Quickstart Guide

输出文件: `specs/006-platform-publish-config/quickstart.md`

包含内容:
1. 功能概览(1-2 段)
2. 前置条件(数据库迁移、环境变量)
3. 开发环境设置
4. 基本使用示例(创建配置、发布时使用配置)
5. 测试运行指南
6. 常见问题排查

### Agent Context Update

运行命令:
```powershell
.specify/scripts/powershell/update-agent-context.ps1 -AgentType claude
```

更新内容:
- 添加平台配置管理相关的技术栈信息
- 更新项目结构文档(新增的服务、组件、API 端点)
- 添加代码示例和使用模式

---

## Phase 2: Task Breakdown

**Note**: Phase 2 (任务分解)由 `/speckit.tasks` 命令执行,不在 `/speckit.plan` 范围内。

Phase 1 完成后,运行:
```bash
/speckit.tasks
```

将生成 `specs/006-platform-publish-config/tasks.md`,包含:
- 详细的实现任务列表
- 任务依赖关系
- 预估工作量
- 验收标准

---

## Implementation Phases (概览)

### Phase 0: Research (当前阶段)
- [ ] 研究 Prisma JSON 字段最佳实践
- [ ] 确定各平台配置字段定义
- [ ] 设计表单验证策略
- [ ] 设计组件组合模式
- [ ] 输出 `research.md`

### Phase 1: Design & Contracts
- [ ] 设计数据模型(输出 `data-model.md`)
- [ ] 定义 API 契约(输出 `contracts/api.yaml`)
- [ ] 编写快速开始指南(输出 `quickstart.md`)
- [ ] 更新 agent context
- [ ] Re-check Constitution 合规性

### Phase 2: Implementation (由 /speckit.tasks 详细规划)
- 数据库 schema 和迁移
- 服务层实现
- API 端点实现
- 前端组件实现
- 测试编写
- 集成和 E2E 测试

### Phase 3: Testing & Validation
- 单元测试验证
- 集成测试验证
- E2E 测试验证
- 性能测试
- 安全审查

### Phase 4: Documentation & Deployment
- API 文档完善
- 用户指南编写
- 部署脚本准备
- 生产环境验证

---

## Next Steps

1. ✅ 创建 feature spec (`spec.md`)
2. ✅ 创建 implementation plan (`plan.md` - 本文件)
3. ⏭️ 执行 Phase 0: 生成 `research.md`
4. ⏭️ 执行 Phase 1: 生成 `data-model.md`, `contracts/`, `quickstart.md`
5. ⏭️ 运行 `/speckit.tasks` 生成详细任务分解

---

**Plan Status**: ✅ Complete  
**Last Updated**: 2026-01-17  
**Ready for Phase 0**: Yes
