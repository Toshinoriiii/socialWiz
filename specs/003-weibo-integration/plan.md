# Implementation Plan: 微博平台接入

**Branch**: `003-weibo-integration` | **Date**: 2025-01-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-weibo-integration/spec.md`

## Summary

实现微博平台的完整接入功能，包括 OAuth 2.0 授权流程、内容发布接口、Token 刷新机制和错误处理。基于已有的平台集成架构设计，实现 WeiboAdapter 适配器，集成到统一的平台服务层。

技术方案：遵循 Platform Agnostic Design 原则，实现 WeiboAdapter 适配器，通过统一的 PlatformAdapter 接口集成到现有系统。使用已有的 Prisma 数据模型存储平台账号信息，通过 PublishService 调用平台适配器发布内容。

## Technical Context

**Language/Version**: TypeScript 5.9+  
**Primary Dependencies**: Next.js 14+ (App Router), Prisma ORM, Axios/Fetch (HTTP客户端)  
**Storage**: PostgreSQL (通过 Prisma), Redis (Token缓存，可选)  
**Testing**: Jest + React Testing Library (单元测试), Playwright (E2E测试，可选)  
**Target Platform**: Web (浏览器 + Node.js 服务端)  
**Project Type**: Web application (Next.js App Router)  
**Performance Goals**: 
- OAuth 授权流程在 3 秒内完成
- 内容发布 API 调用在 2 秒内完成（不含图片上传）
- Token 刷新在 1 秒内完成  
**Constraints**: 
- 必须遵循微博 API 频率限制（单授权用户每天100次，发微博每小时30次）
- 必须处理 Token 过期（测试应用1天，普通应用30天）
- 必须验证内容限制（文字长度、图片数量、格式等）
- 必须支持错误重试和降级处理  
**Scale/Scope**: 
- 支持所有已连接微博账号的用户
- 需要处理并发发布请求
- 需要考虑 Token 过期和刷新场景

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

验证以下 Constitution 原则的合规性：

- **Type-Safety First**: ✅ 所有新代码将包含完整的 TypeScript 类型定义，使用现有 `PlatformAccount`、`Platform` 等类型，避免 `any` 类型。新增接口将定义明确的类型契约。
- **Service Layer Architecture**: ✅ 业务逻辑将在服务层实现（`lib/services/`），API 路由仅负责请求验证和响应返回。微博适配器将作为独立服务实现。
- **AI Model Abstraction**: N/A - 此功能不涉及 AI 模型
- **Platform Agnostic Design**: ✅ 微博适配器将实现统一的 `PlatformAdapter` 接口（如已定义），遵循现有平台集成架构。适配器将独立于其他平台实现，易于扩展和维护。
- **API-First Development**: ✅ 将先定义和实现 API 端点（OAuth 回调、发布接口），再构建前端组件。API 将提供完整的错误处理和状态码。
- **Testing Discipline**: ✅ 关键业务逻辑（OAuth 流程、内容发布、Token 刷新）将包含单元测试。测试将独立运行，使用 mock 的微博 API 响应。

**Violations**: 无违反原则的情况。所有实现将严格遵循 Constitution 原则。

## Project Structure

### Documentation (this feature)

```text
specs/003-weibo-integration/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
lib/
├── services/
│   ├── auth.service.ts           # 现有认证服务（可能需要扩展支持平台授权）
│   └── publish.service.ts        # 现有发布服务（需要集成平台适配器）
├── platforms/                     # 新增：平台适配器目录
│   ├── base/
│   │   └── platform-adapter.ts   # 平台适配器基类/接口（如未存在）
│   ├── weibo/
│   │   ├── weibo-adapter.ts      # 微博适配器实现
│   │   ├── weibo-client.ts       # 微博 API 客户端
│   │   ├── weibo-types.ts        # 微博相关类型定义
│   │   └── weibo-utils.ts        # 微博工具函数（内容验证、转换等）
│   └── index.ts                  # 平台适配器导出
app/
├── api/
│   ├── platforms/
│   │   ├── weibo/
│   │   │   ├── auth/
│   │   │   │   ├── route.ts      # 获取授权 URL
│   │   │   │   └── callback/
│   │   │   │       └── route.ts   # OAuth 回调处理
│   │   │   └── publish/
│   │   │       └── route.ts       # 微博发布接口（可选，或通过统一发布接口）
│   └── publish/
│       └── route.ts               # 统一发布接口（需要集成平台适配器）
config/
└── platform.config.ts             # 现有平台配置（已包含微博配置）
types/
└── platform.types.ts              # 现有平台类型（已包含 Platform.WEIBO）
```

**Structure Decision**: 采用适配器模式，在 `lib/platforms/weibo/` 目录下实现微博适配器。适配器实现统一的接口，通过 `PublishService` 调用。API 路由遵循 RESTful 设计，OAuth 流程通过 `/api/platforms/weibo/auth` 端点处理。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

无违反情况需要说明。
