# Implementation Plan: 微信公众号平台接入

**Branch**: `005-wechat-integration` | **Date**: 2026-01-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-wechat-integration/spec.md`

## Summary

实现微信公众号平台的完整接入功能，包括 OAuth 2.0 授权流程、内容发布接口、Token 刷新机制和错误处理。基于已有的平台集成架构设计，实现 WechatAdapter 适配器，集成到统一的平台服务层。同时创建测试页面用于验证功能。

技术方案：遵循 Platform Agnostic Design 原则，实现 WechatAdapter 适配器，通过统一的 PlatformAdapter 接口集成到现有系统。使用已有的 Prisma 数据模型存储平台账号信息，通过 PublishService 调用平台适配器发布内容。创建专门的测试页面用于功能验证和调试。

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
- 必须遵循微信 API 频率限制（需要调研具体限制）
- 必须处理 Token 过期（需要调研微信 Token 有效期）
- 必须验证内容限制（文字长度、图片数量、格式等，需要调研微信限制）
- 必须支持错误重试和降级处理  
**Scale/Scope**: 
- 支持所有已连接微信公众号账号的用户
- 需要处理并发发布请求
- 需要考虑 Token 过期和刷新场景
- 需要提供测试页面用于功能验证

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

验证以下 Constitution 原则的合规性：

- **Type-Safety First**: ✅ 所有新代码将包含完整的 TypeScript 类型定义，使用现有 `PlatformAccount`、`Platform` 等类型，避免 `any` 类型。新增接口将定义明确的类型契约。
- **Service Layer Architecture**: ✅ 业务逻辑将在服务层实现（`lib/services/`），API 路由仅负责请求验证和响应返回。微信公众号适配器将作为独立服务实现。
- **AI Model Abstraction**: N/A - 此功能不涉及 AI 模型
- **Platform Agnostic Design**: ✅ 微信公众号适配器将实现统一的 `PlatformAdapter` 接口，遵循现有平台集成架构。适配器将独立于其他平台实现，易于扩展和维护。
- **API-First Development**: ✅ 将先定义和实现 API 端点（OAuth 回调、发布接口），再构建前端组件和测试页面。API 将提供完整的错误处理和状态码。
- **Testing Discipline**: ✅ 关键业务逻辑（OAuth 流程、内容发布、Token 刷新）将包含单元测试。测试将独立运行，使用 mock 的微信 API 响应。测试页面将用于端到端功能验证。

**Violations**: 无违反原则的情况。所有实现将严格遵循 Constitution 原则。

## Project Structure

### Documentation (this feature)

```text
specs/005-wechat-integration/
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
│   └── publish.service.ts        # 现有发布服务（需要集成微信公众号适配器）
├── platforms/                     # 平台适配器目录
│   ├── base/
│   │   ├── platform-adapter.ts   # 平台适配器基类/接口（已存在）
│   │   └── types.ts              # 平台适配器类型定义（已存在）
│   ├── weibo/                    # 微博适配器（已存在）
│   ├── wechat/                   # 新增：微信公众号适配器目录
│   │   ├── wechat-adapter.ts     # 微信公众号适配器实现
│   │   ├── wechat-client.ts     # 微信公众号 API 客户端
│   │   ├── wechat-types.ts       # 微信公众号相关类型定义
│   │   └── wechat-utils.ts       # 微信公众号工具函数（内容验证、转换等）
│   └── index.ts                  # 平台适配器导出（需要添加微信公众号适配器）
app/
├── api/
│   ├── platforms/
│   │   ├── weibo/                # 微博 API 路由（已存在）
│   │   └── wechat/               # 新增：微信公众号 API 路由
│   │       ├── auth/
│   │       │   ├── route.ts      # 获取授权 URL
│   │       │   └── callback/
│   │       │       └── route.ts   # OAuth 回调处理
│   │       ├── [platformAccountId]/
│   │       │   ├── publish/
│   │       │   │   └── route.ts   # 微信公众号发布接口
│   │       │   ├── disconnect/
│   │       │   │   └── route.ts   # 断开连接接口
│   │       │   └── status/
│   │       │       └── route.ts   # 获取状态接口
│   └── publish/
│       └── route.ts               # 统一发布接口（需要集成微信公众号适配器）
├── test/                          # 新增：测试页面目录
│   └── wechat/                    # 新增：微信公众号测试页面
│       └── page.tsx               # 测试页面组件
config/
└── platform.config.ts             # 现有平台配置（已包含微信公众号配置）
types/
└── platform.types.ts             # 现有平台类型（已包含 Platform.WECHAT）
```

**Structure Decision**: 采用适配器模式，在 `lib/platforms/wechat/` 目录下实现微信公众号适配器。适配器实现统一的接口，通过 `PublishService` 调用。API 路由遵循 RESTful 设计，OAuth 流程通过 `/api/platforms/wechat/auth` 端点处理。创建专门的测试页面 `app/test/wechat/page.tsx` 用于功能验证和调试。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

无违反情况需要说明。
