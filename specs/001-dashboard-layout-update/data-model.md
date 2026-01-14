# Data Model: Dashboard 交互布局重构

**Feature**: 001-dashboard-layout-update  
**Date**: 2026-01-14

## Overview

此功能为纯前端布局改造，不涉及数据库或 API 数据模型变更。本文档定义前端导航配置和组件状态的数据结构。

## Entities

### DashboardSidebarItem

表示左侧导航的一个主模块项或子菜单项。

**Attributes**:
- `id` (string, required): 唯一标识符，例如 `"home"`, `"analytics"`, `"data-overview"`
- `label` (string, required): 显示文案，例如 `"主页"`, `"数据分析"`, `"数据概览"`
- `icon` (React.ReactNode, required): 图标组件（使用 `lucide-react`），例如 `<Home className="size-4" />`
- `href` (string, required): 路由路径，例如 `"/home"`, `"/analytics"`, `"/data-overview"`
- `children` (NavItem[] | undefined, optional): 子菜单项数组（用于可折叠的分组导航，如"数据分析"下包含"数据概览"）
- `visible` (boolean, optional, default: true): 是否可见（基于用户权限，FR-002 中提到权限控制）
- `badge` (string | number | undefined, optional): 徽章内容（例如通知数量），显示在标签右侧

**Relationships**:
- 无（前端配置数据，不涉及数据库关系）

**Validation Rules**:
- `id` 必须唯一
- `href` 必须以 `/` 开头
- `children` 如果存在，必须是非空数组
- `visible` 默认为 `true`，如果为 `false`，该菜单项不应渲染

**State Transitions**: N/A（静态配置数据）

---

### DashboardLayoutState

表示 dashboard 布局的整体状态（用于响应式折叠和抽屉式导航）。

**Attributes**:
- `isCollapsed` (boolean, required): 左侧导航是否收起（手动控制）
- `isMobile` (boolean, required): 是否为移动端/窄屏（通过窗口宽度判断，`< 1024px`）
- `isDrawerOpen` (boolean, required): 抽屉式导航是否打开（仅在移动端使用）

**State Transitions**:
- **初始状态**: `{ isCollapsed: false, isMobile: false, isDrawerOpen: false }`
- **手动收起**: `isCollapsed: true`（桌面端）
- **自动折叠**（窄屏）: `isMobile: true` → 导航自动折叠为图标栏
- **打开抽屉**（移动端）: `isDrawerOpen: true` → 侧滑显示导航
- **关闭抽屉**: `isDrawerOpen: false` → 隐藏导航

**Validation Rules**:
- `isDrawerOpen` 仅在 `isMobile === true` 时有效
- `isCollapsed` 仅在 `isMobile === false` 时有效（移动端使用抽屉，不使用收起状态）

---

### DashboardSectionCard

表示右侧工作区中的一个信息卡片或入口卡片（用于主页的数据概览和快速创作入口）。

**Attributes**:
- `id` (string, required): 唯一标识符，例如 `"works-overview"`, `"create-article"`
- `title` (string, required): 卡片标题，例如 `"作品数据概览"`, `"创建文章"`
- `description` (string | undefined, optional): 副标题/说明文字
- `value` (string | number | React.ReactNode | undefined, optional): 主要数据值或操作按钮内容
- `icon` (React.ReactNode | undefined, optional): 图标组件（显示在卡片右上角或左侧）
- `href` (string | undefined, optional): 点击跳转路径（如果为入口卡片）
- `onClick` (() => void | undefined, optional): 点击回调函数（如果为操作卡片）
- `badge` (string | number | undefined, optional): 徽章内容（例如数据变化 `"+12.5%"`）
- `color` ("blue" | "green" | "purple" | "pink" | undefined, optional): 卡片强调色（用于图标或边框，符合 FR-005 的 2-3 种颜色限制）

**Relationships**:
- 无（前端展示数据，可能从 API 获取，但数据结构由后端定义）

**Validation Rules**:
- `id` 必须唯一
- `href` 和 `onClick` 至少提供一个（卡片必须可点击）
- `color` 必须是预定义的颜色值之一（符合黑白极简风格的强调色限制）

**State Transitions**: N/A（展示数据，无状态转换）

---

## Type Definitions

### TypeScript 类型定义

```typescript
// types/dashboard.types.ts

import { ReactNode } from 'react'

export interface NavItem {
  id: string
  label: string
  icon: ReactNode
  href: string
  children?: NavItem[]
  visible?: boolean
  badge?: string | number
}

export interface DashboardLayoutState {
  isCollapsed: boolean
  isMobile: boolean
  isDrawerOpen: boolean
}

export interface DashboardSectionCard {
  id: string
  title: string
  description?: string
  value?: string | number | ReactNode
  icon?: ReactNode
  href?: string
  onClick?: () => void
  badge?: string | number
  color?: 'blue' | 'green' | 'purple' | 'pink'
}
```

---

## Data Sources

### Navigation Configuration

**Source**: 静态配置（`types/dashboard.types.ts` 或 `components/layout/DashboardSidebar.tsx`）

**Structure**: `NavItem[]` 数组，包含所有导航项配置

**Example**:
```typescript
const navItems: NavItem[] = [
  { id: 'home', label: '主页', icon: <Home />, href: '/home' },
  {
    id: 'analytics',
    label: '数据分析',
    icon: <BarChart3 />,
    href: '/analytics',
    children: [
      { id: 'data-overview', label: '数据概览', icon: <TrendingUp />, href: '/data-overview' },
      { id: 'content-analysis', label: '内容分析', icon: <FileText />, href: '/content-analysis' }
    ]
  },
  // ... 其他导航项
]
```

### Dashboard Cards Data

**Source**: API 端点（例如 `/api/dashboard/stats`）或静态配置（快速创作入口）

**Structure**: `DashboardSectionCard[]` 数组

**API Response Example** (如果从 API 获取):
```json
{
  "overviewCards": [
    {
      "id": "works-overview",
      "title": "作品数据概览",
      "value": "1",
      "description": "共1篇 已发布0篇",
      "badge": "+1",
      "color": "blue"
    },
    // ... 其他卡片
  ]
}
```

---

## Notes

- 所有数据结构使用 TypeScript 类型定义，符合 Type-Safety First 原则
- 导航配置为静态数据，不涉及数据库存储
- Dashboard 卡片数据可能从 API 获取，但数据结构由后端 API 定义，前端仅定义类型接口
- 布局状态（`DashboardLayoutState`）使用 React Hooks（`useState`）管理，不涉及持久化存储
