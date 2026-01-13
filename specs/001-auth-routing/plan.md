# Implementation Plan: 认证路由保护

**Branch**: `001-auth-routing` | **Date**: 2025-01-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-auth-routing/spec.md`

## Summary

实现应用根路径的认证路由保护功能。当用户访问应用根路径时，系统检查用户的登录状态：未登录用户重定向到登录页面，已登录用户重定向到管理页面。同时，已登录用户访问登录页面时也应重定向到管理页面，避免重复登录。

技术方案：在 Next.js App Router 的根布局或根页面组件中实现认证状态检查逻辑，利用现有的 AuthService 验证 JWT token，根据验证结果执行路由重定向。

## Technical Context

**Language/Version**: TypeScript 5.9+  
**Primary Dependencies**: Next.js 14+ (App Router), React 19+, Zustand 5+  
**Storage**: Redis (用于缓存用户信息，通过现有 cacheHelper), PostgreSQL (用户数据，通过 Prisma)  
**Testing**: Jest + React Testing Library (推荐), Playwright (E2E测试，可选)  
**Target Platform**: Web (浏览器)  
**Project Type**: Web application (Next.js App Router)  
**Performance Goals**: 认证状态检查在 1 秒内完成（符合 SC-003 要求）  
**Constraints**: 
- 必须与现有认证系统（JWT + AuthService）集成
- 必须支持客户端和服务端路由
- 必须处理 token 过期和无效情况
- 必须避免页面闪烁（加载状态处理）  
**Scale/Scope**: 
- 支持所有用户访问根路径
- 需要处理并发访问
- 需要考虑多标签页场景

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

验证以下 Constitution 原则的合规性：

- **Type-Safety First**: ✅ 所有新代码将包含完整的 TypeScript 类型定义，使用现有 `UserProfile` 和 `AuthResponse` 类型，避免 `any` 类型
- **Service Layer Architecture**: ✅ 认证状态检查逻辑将使用现有的 `AuthService.verifyToken()` 方法，不在组件中直接操作数据库
- **AI Model Abstraction**: N/A - 此功能不涉及 AI 模型
- **Platform Agnostic Design**: N/A - 此功能不涉及社交平台集成
- **API-First Development**: ⚠️ 此功能主要是前端路由逻辑，但会调用现有的认证 API。如果需要新的 API 端点，将先定义 API 再实现前端
- **Testing Discipline**: ✅ 路由重定向逻辑将包含单元测试和集成测试，测试将独立运行，使用 mock 的认证服务

**Violations**: 无违反原则的情况。API-First 原则在此场景下部分适用，因为主要逻辑在前端路由层，但会遵循使用现有服务层的原则。

## Project Structure

### Documentation (this feature)

```text
specs/001-auth-routing/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
app/
├── layout.tsx                    # 根布局（可能需要添加认证检查）
├── page.tsx                      # 根页面（需要实现路由重定向逻辑）
├── (auth)/
│   ├── login/
│   │   └── page.tsx              # 登录页面（需要添加已登录检查）
│   └── register/
│       └── page.tsx
├── (dashboard)/
│   └── layout.tsx                # Dashboard 布局（可能需要路由保护）
lib/
├── services/
│   └── auth.service.ts           # 现有认证服务（已包含 verifyToken）
├── middleware.ts                  # Next.js 中间件（可选，用于服务端路由保护）
└── utils/
    └── auth.ts                    # 认证工具函数（可选，封装认证检查逻辑）
components/
└── auth/
    └── AuthGuard.tsx              # 认证守卫组件（可选，用于客户端路由保护）
store/
└── user.store.ts                  # 现有用户状态管理（已包含 isAuthenticated）
types/
└── user.types.ts                  # 现有用户类型定义
```

**Structure Decision**: 采用 Next.js App Router 的标准结构。主要修改在 `app/page.tsx`（根页面）和 `app/(auth)/login/page.tsx`（登录页面）。考虑添加中间件或认证守卫组件来统一处理路由保护逻辑。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

无违反情况需要说明。
