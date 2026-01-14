# Implementation Plan: Dashboard 交互布局重构

**Branch**: `001-dashboard-layout-update` | **Date**: 2026-01-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-dashboard-layout-update/spec.md`

## Summary

将 dashboard 页面从当前的顶部导航 + 水平标签导航结构重构为左右结构布局（左侧主导航栏 + 右侧工作区），采用黑白极简风格设计，并基于项目现有的 shadcn/ui 组件体系实现。主要改造包括：安装并使用 shadcn/ui Sidebar 组件构建左侧导航，重构 `app/(dashboard)/layout.tsx` 实现左右布局，调整路由结构以支持导航高亮和模块切换，优化响应式设计以支持窄屏折叠和抽屉式导航。

技术方案：使用 shadcn/ui Sidebar 组件（需安装）构建左侧导航栏，重构 dashboard layout 为左右结构，保持顶部品牌和用户信息区域，右侧工作区根据导航选中项动态渲染对应模块内容。导航支持自动折叠（窄屏时）和手动收起/展开，遵循黑白极简风格，使用 shadcn/ui 组件保持设计一致性。

## Technical Context

**Language/Version**: TypeScript 5.9+  
**Primary Dependencies**: Next.js 14+ (App Router), shadcn/ui (需安装 Sidebar 组件), Tailwind CSS 4.1+, Radix UI (shadcn/ui 底层依赖), lucide-react (图标库)  
**Storage**: N/A (此功能不涉及数据存储变更，仅前端布局和路由改造)  
**Testing**: Jest + React Testing Library (组件测试，可选), Playwright (E2E测试，可选)  
**Target Platform**: Web (浏览器，支持桌面端和窄屏适配)  
**Project Type**: Web application (Next.js App Router)  
**Performance Goals**: 
- 布局切换无整页刷新，使用客户端路由实现平滑过渡
- 首次加载主布局和导航可见时间不超过 3 秒（符合 SC-002）
- 导航折叠/展开动画流畅（60fps）
- 组件按需加载，不增加不必要的 bundle 大小  
**Constraints**: 
- 必须保持所有现有功能不变（仅改变布局结构）
- 必须保持与现有 API 的兼容性
- 必须确保 TypeScript 类型安全（所有新组件和工具函数需完整类型定义）
- 必须遵循 shadcn/ui 组件使用规范
- 必须支持响应式设计（桌面端 ≥ 1024px，窄屏折叠，更窄时抽屉式）
- 必须遵循黑白极简风格（主要颜色：黑、白、灰，强调色控制在 2-3 种）
- 左侧导航必须支持垂直滚动（菜单项较多时）  
**Scale/Scope**: 
- 重构 dashboard 布局组件 (`app/(dashboard)/layout.tsx`)
- 创建左侧导航组件（基于 shadcn/ui Sidebar）
- 调整 7 个主要导航模块的路由结构（主页、数据分析、数据概览、发布管理、账号管理、平台管理、设置）
- 优化所有 dashboard 子页面的布局适配（确保在右侧工作区正确显示）
- 实现响应式折叠和抽屉式导航逻辑

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

验证以下 Constitution 原则的合规性：

- **Type-Safety First**: ✅ 所有新代码将包含完整的 TypeScript 类型定义，导航配置、路由参数、组件 props 均使用类型定义，避免 `any` 类型
- **Service Layer Architecture**: ✅ N/A（此功能为纯前端布局改造，不涉及业务逻辑或 API 调用）
- **AI Model Abstraction**: ✅ N/A（此功能不涉及 AI 功能）
- **Platform Agnostic Design**: ✅ N/A（此功能不涉及平台集成）
- **API-First Development**: ✅ N/A（此功能为纯前端布局改造，不涉及新 API 端点）
- **Testing Discipline**: ⚠️ 布局组件测试为可选（UI 重构任务，主要关注视觉一致性），但关键交互逻辑（导航切换、折叠展开）建议包含基础测试

**Violations**: 无违反原则的情况。测试为可选符合 UI 重构任务的特点，主要验证通过视觉走查和可用性测试完成。

## Project Structure

### Documentation (this feature)

```text
specs/001-dashboard-layout-update/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command) - N/A (纯前端改造)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
app/
├── (dashboard)/                    # Dashboard 路由组
│   ├── layout.tsx                  # ⚠️ 需要重构：改为左右布局结构
│   ├── home/                       # 主页（需适配新布局）
│   │   └── page.tsx
│   ├── analytics/                  # 数据分析（需适配新布局）
│   │   └── page.tsx
│   ├── publish/                     # 发布管理（需适配新布局）
│   │   └── page.tsx
│   ├── accounts/                   # 账号管理（需适配新布局，可能需要新增路由）
│   │   └── page.tsx
│   ├── platforms/                  # 平台管理（需适配新布局，可能需要新增路由）
│   │   └── page.tsx
│   └── settings/                   # 设置（需适配新布局）
│       └── page.tsx

components/
├── ui/                             # shadcn/ui 组件（已存在）
│   ├── sidebar.tsx                 # ⚠️ 需要安装：npx shadcn@latest add sidebar
│   ├── Button.tsx                  # 已存在
│   ├── Card.tsx                    # 已存在
│   ├── Tabs.tsx                    # 已存在
│   └── ...                         # 其他已安装组件
└── layout/                         # 布局组件（可能需要新增或重构）
    ├── DashboardSidebar.tsx        # ⚠️ 需要创建：基于 shadcn/ui Sidebar 的左侧导航组件
    ├── DashboardHeader.tsx         # ⚠️ 可能需要重构：顶部品牌和用户信息区域
    └── DashboardContent.tsx        # ⚠️ 可能需要创建：右侧工作区容器组件

lib/
└── utils/                          # 工具函数（已存在）
    └── cn.ts                       # 已存在（shadcn/ui 需要）

types/
└── dashboard.types.ts              # ⚠️ 需要创建：导航配置、路由类型定义
```

**Structure Decision**: 采用 Next.js App Router 的现有结构，主要改造集中在 `app/(dashboard)/layout.tsx` 和新增 `components/layout/DashboardSidebar.tsx`。导航配置和类型定义集中在 `types/dashboard.types.ts` 便于维护。shadcn/ui Sidebar 组件通过 CLI 安装到 `components/ui/sidebar.tsx`。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

无违反情况需要说明。

---

## Phase Completion Status

### Phase 0: Outline & Research ✅ COMPLETE

**Output**: `research.md`

**Research Questions Resolved**:
1. ✅ shadcn/ui Sidebar 组件安装和配置方案
2. ✅ 左右布局结构实现方案（Flexbox）
3. ✅ 导航路由结构和模块映射方案
4. ✅ 黑白极简风格实现方案（Tailwind CSS + CSS 变量）
5. ✅ 响应式折叠和抽屉式导航实现方案

**Key Decisions**:
- 使用 shadcn/ui Sidebar 组件构建左侧导航
- 使用 Flexbox 实现左右布局结构
- 导航配置集中管理在 TypeScript 类型定义中
- 使用 Tailwind CSS 灰度色系和 CSS 变量实现黑白极简风格
- 使用 React Hooks 和 Tailwind 断点实现响应式折叠

**No NEEDS CLARIFICATION markers remain** - 所有技术选型已确定。

---

### Phase 1: Design & Contracts ✅ COMPLETE

**Outputs**: 
- ✅ `data-model.md` - 前端数据结构定义（导航配置、布局状态、卡片数据）
- ✅ `quickstart.md` - 快速开始指南（安装步骤、代码示例、验证方法）
- ⚠️ `contracts/` - N/A（纯前端改造，不涉及 API 端点）

**Design Artifacts**:
- ✅ **Navigation Configuration**: `NavItem` 接口定义，支持主菜单和子菜单
- ✅ **Layout State**: `DashboardLayoutState` 接口定义，管理折叠和抽屉状态
- ✅ **Card Data**: `DashboardSectionCard` 接口定义，用于主页数据概览和快速创作入口
- ✅ **Type Definitions**: 完整的 TypeScript 类型定义文件结构

**Implementation Guidance**:
- ✅ Sidebar 组件安装步骤
- ✅ 导航组件创建示例代码
- ✅ Layout 重构示例代码
- ✅ 验证和测试方法

**Constitution Check (Post-Design)**: ✅ PASSED
- 所有设计符合 Type-Safety First 原则（完整类型定义）
- 不涉及 Service Layer、AI Model、Platform Integration、API 开发
- 测试为可选，符合 UI 重构任务特点

---

## Next Steps

**Ready for Phase 2**: `/speckit.tasks` command can now be executed to break down the implementation into specific tasks.

**Key Implementation Areas**:
1. 安装 shadcn/ui Sidebar 组件
2. 创建导航配置类型定义
3. 创建左侧导航组件（DashboardSidebar）
4. 重构 Dashboard Layout（左右布局）
5. 实现响应式折叠和抽屉式导航
6. 调整所有 dashboard 子页面布局适配
7. 优化黑白极简风格细节
