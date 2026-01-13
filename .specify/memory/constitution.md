<!--
Sync Impact Report:
Version change: 0.0.0 → 1.0.0 (Initial constitution creation)
Modified principles: N/A (initial creation)
Added sections: Core Principles, Technology Stack, Development Workflow, Governance
Removed sections: N/A
Templates requiring updates:
  ✅ plan-template.md - Constitution Check section references constitution principles
  ✅ spec-template.md - No direct constitution references, but aligns with principles
  ✅ tasks-template.md - No direct constitution references, but aligns with principles
Follow-up TODOs: None
-->

# SocialWiz Constitution

## Core Principles

### I. Type-Safety First (NON-NEGOTIABLE)
所有代码必须通过 TypeScript 类型检查。禁止使用 `any` 类型，除非有明确的技术理由并添加注释说明。类型定义必须集中管理在 `types/` 目录，共享类型必须通过明确的导入使用。API 请求和响应必须有完整的类型定义。

**Rationale**: 类型安全是大型项目可维护性的基础，能够在编译时捕获错误，减少运行时问题，提高开发效率。

### II. Service Layer Architecture
业务逻辑必须在服务层（`lib/services/`）实现，API 路由（`app/api/`）仅负责请求验证、调用服务和返回响应。服务层必须独立于框架，可被测试和复用。数据库访问必须通过 Prisma Client，禁止在 API 路由中直接操作数据库。

**Rationale**: 服务层架构确保业务逻辑与框架解耦，便于测试、复用和维护。清晰的职责分离使代码更易理解和修改。

### III. AI Model Abstraction
所有 AI 模型访问必须通过抽象层（`lib/ai/model-router.ts`）进行。新增 AI 模型必须实现统一的接口，支持模型切换和降级。AI 配置必须集中在 `config/ai.config.ts`，环境变量必须通过配置层访问。

**Rationale**: AI 模型抽象层使系统能够灵活切换不同的 AI 提供商，支持多模型策略和故障转移，便于成本优化和性能调优。

### IV. Platform Agnostic Design
社交平台集成必须通过统一的接口实现。每个平台必须实现标准化的 OAuth 和发布接口。平台配置必须集中在 `config/platform.config.ts`。新增平台必须遵循现有接口契约，不得破坏现有功能。

**Rationale**: 平台无关设计使系统易于扩展新的社交平台，同时保持代码的一致性和可维护性。统一的接口使平台切换对用户透明。

### V. API-First Development
API 接口必须优先于前端组件开发。所有功能必须首先定义和实现 API 端点，然后构建前端组件。API 必须提供完整的错误处理和状态码。API 文档必须与实现保持同步。

**Rationale**: API 优先开发确保前后端解耦，支持多客户端（Web、移动端）复用，便于独立测试和部署。

### VI. Testing Discipline
关键业务逻辑（认证、内容管理、发布服务）必须有单元测试或集成测试覆盖。测试必须独立运行，不依赖外部服务（使用 mock）。新增功能必须包含相应的测试用例。

**Rationale**: 测试覆盖确保代码质量和系统稳定性，支持重构和持续集成。测试优先的开发方式有助于设计更好的 API 和接口。

## Technology Stack

### Required Technologies
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript 5.9+
- **Database**: PostgreSQL 14+ (via Prisma ORM)
- **Cache**: Redis 6+
- **UI Styling**: Tailwind CSS + Stylus
- **State Management**: Zustand
- **Form Handling**: React Hook Form + Zod

### AI Integration Requirements
- 必须支持多模型切换（DeepSeek, Qwen, OpenAI）
- 必须支持流式响应
- 必须实现错误处理和重试机制
- API 密钥必须通过环境变量管理，不得硬编码

### Database Requirements
- 所有数据库操作必须通过 Prisma ORM
- 数据库迁移必须通过 Prisma Migrate 管理
- 禁止直接 SQL 查询（除非 Prisma 无法满足需求）
- 数据库连接必须通过 `lib/db/prisma.ts` 统一管理

## Development Workflow

### Code Organization
- **API Routes**: `app/api/` - 仅处理 HTTP 请求/响应
- **Services**: `lib/services/` - 业务逻辑实现
- **AI Integration**: `lib/ai/` - AI 模型抽象和集成
- **Database**: `lib/db/` - 数据库连接和配置
- **Components**: `components/` - React 组件（按功能分类）
- **Types**: `types/` - TypeScript 类型定义
- **Config**: `config/` - 应用配置（非环境变量）

### Code Review Requirements
- 所有 PR 必须通过 TypeScript 类型检查
- 所有 PR 必须通过 ESLint 检查
- 新增 API 端点必须包含错误处理
- 新增服务必须包含必要的日志记录
- 破坏性变更必须更新相关文档

### Deployment Standards
- 生产环境必须使用环境变量配置
- 数据库迁移必须在部署前验证
- API 端点必须包含适当的错误响应
- 敏感信息（API 密钥、数据库密码）不得提交到代码仓库

## Governance

本 Constitution 是 SocialWiz 项目的最高指导原则，所有开发活动必须遵循这些原则。任何违反原则的代码变更必须提供明确的技术理由，并在代码审查中讨论。

**Amendment Process**: 
- 原则修改必须通过项目维护者批准
- 版本号遵循语义化版本（MAJOR.MINOR.PATCH）
- MAJOR: 原则删除或重大修改（向后不兼容）
- MINOR: 新增原则或扩展现有原则
- PATCH: 澄清说明、措辞改进、非语义性修改

**Compliance Review**:
- 所有 PR 必须验证是否符合 Constitution 原则
- 定期审查代码库以确保持续合规
- 违反原则的代码必须重构或提供例外说明

**Version**: 1.0.0 | **Ratified**: 2025-01-05 | **Last Amended**: 2025-01-05
