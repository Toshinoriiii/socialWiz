# Implementation Plan: 页面重构与 shadcn/ui 组件接入

**Branch**: `004-page-refactor-shadcn` | **Date**: 2025-01-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-page-refactor-shadcn/spec.md`

## Summary

将现有页面和组件重构并迁移到 shadcn/ui 组件库，统一 UI 风格，提升代码质量和可维护性。基于已有的 Next.js 14 + TypeScript + Tailwind CSS 技术栈，集成 shadcn/ui 组件库，逐步替换现有自定义组件，优化页面结构和响应式设计。

技术方案：使用 shadcn/ui CLI 工具安装组件库，配置 `components.json`，逐步迁移现有页面和组件。保持功能不变，统一使用 Tailwind CSS 进行样式管理，移除 CSS Modules 文件。

## Technical Context

**Language/Version**: TypeScript 5.9+  
**Primary Dependencies**: Next.js 14+ (App Router), shadcn/ui, Tailwind CSS 4.1+, Radix UI (shadcn/ui 底层依赖)  
**Storage**: N/A (此功能不涉及数据存储变更)  
**Testing**: Jest + React Testing Library (组件测试), Playwright (E2E测试，可选)  
**Target Platform**: Web (浏览器)  
**Project Type**: Web application (Next.js App Router)  
**Performance Goals**: 
- 页面加载时间不增加（组件库按需加载）
- 组件渲染性能保持或提升
- 样式文件大小优化（移除 CSS Modules，统一使用 Tailwind CSS）  
**Constraints**: 
- 必须保持所有现有功能不变
- 必须保持与现有 API 的兼容性
- 必须确保 TypeScript 类型安全
- 必须遵循 shadcn/ui 组件使用规范
- 必须保持响应式设计  
**Scale/Scope**: 
- 重构所有 dashboard 页面（home, publish, schedule, analytics, settings）
- 重构认证页面（login, register）
- 迁移所有自定义 UI 组件到 shadcn/ui
- 优化组件复用性和可维护性

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

验证以下 Constitution 原则的合规性：

- **Type-Safety First**: ✅ 所有 shadcn/ui 组件具有完整的 TypeScript 类型定义，迁移过程中保持类型安全，避免 `any` 类型。组件 props 必须明确定义类型。
- **Service Layer Architecture**: ✅ 页面重构不涉及业务逻辑变更，服务层架构保持不变。API 路由和业务逻辑分离原则继续遵循。
- **AI Model Abstraction**: N/A - 此功能不涉及 AI 模型
- **Platform Agnostic Design**: N/A - 此功能不涉及平台集成
- **API-First Development**: ✅ 页面重构不涉及 API 变更，保持现有 API 接口不变。前端组件仅负责 UI 展示和交互。
- **Testing Discipline**: ✅ 关键组件和页面重构后需要更新测试用例，确保功能不变。组件测试使用 React Testing Library，E2E 测试使用 Playwright（可选）。

**Violations**: 无违反原则的情况。所有实现将严格遵循 Constitution 原则。

## Project Structure

### Documentation (this feature)

```text
specs/004-page-refactor-shadcn/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command) - N/A (不涉及数据模型变更)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command) - N/A (不涉及 API 变更)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
components/
├── ui/                  # shadcn/ui 组件（已存在部分，需要补充）
│   ├── button.tsx       # 替换 components/ui/Button.tsx
│   ├── input.tsx        # 替换 components/ui/Input.tsx
│   ├── card.tsx         # 替换 components/ui/Card.tsx
│   ├── dialog.tsx       # 已存在，需要检查
│   ├── tabs.tsx         # 替换 components/ui/Tabs.tsx
│   └── ...              # 其他 shadcn/ui 组件
├── layout/              # 布局组件（需要重构）
│   ├── Header.tsx       # 使用 shadcn/ui 组件重构
│   ├── Sidebar.tsx      # 使用 shadcn/ui 组件重构
│   └── TabNav.tsx       # 使用 shadcn/ui 组件重构
├── dashboard/           # Dashboard 组件（需要重构）
│   ├── StatsCard.tsx    # 使用 shadcn/ui Card 组件
│   ├── ContentGrid.tsx  # 使用 shadcn/ui 组件重构
│   └── ...              # 其他 dashboard 组件
└── ai-elements/         # AI 相关组件（保持不变或部分重构）

app/
├── (auth)/              # 认证页面（需要重构）
│   ├── login/
│   │   ├── page.tsx     # 使用 shadcn/ui 组件重构，移除 login.module.css
│   │   └── ...          # 移除 CSS Modules 文件
│   └── register/
│       ├── page.tsx     # 使用 shadcn/ui 组件重构，移除 register.module.css
│       └── ...          # 移除 CSS Modules 文件
├── (dashboard)/         # Dashboard 页面（需要重构）
│   ├── home/
│   │   ├── page.tsx     # 使用 shadcn/ui 组件重构，移除 home.module.css
│   │   └── ...          # 移除 CSS Modules 文件
│   ├── publish/
│   │   ├── page.tsx     # 使用 shadcn/ui 组件重构，移除 publish.module.css
│   │   └── ...          # 移除 CSS Modules 文件
│   ├── schedule/
│   │   ├── page.tsx     # 使用 shadcn/ui 组件重构，移除 schedule.module.css
│   │   └── ...          # 移除 CSS Modules 文件
│   ├── analytics/
│   │   ├── page.tsx     # 使用 shadcn/ui 组件重构，移除 analytics.module.css
│   │   └── ...          # 移除 CSS Modules 文件
│   ├── settings/
│   │   ├── page.tsx     # 使用 shadcn/ui 组件重构，移除 settings.module.css
│   │   └── ...          # 移除 CSS Modules 文件
│   └── layout.tsx       # 使用 shadcn/ui 组件重构，移除 layout.module.css

lib/
└── utils/
    └── cn.ts            # 工具函数，用于合并 Tailwind CSS 类名（shadcn/ui 标准）

components.json           # shadcn/ui 配置文件（需要创建）
```

**Structure Decision**: 保持现有项目结构，在 `components/ui/` 目录下使用 shadcn/ui 组件替换现有自定义组件。逐步移除 CSS Modules 文件，统一使用 Tailwind CSS。页面组件保持现有路由结构，仅重构 UI 层。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

无违反原则的情况，无需填写。
