# Quick Start: Dashboard 交互布局重构

**Feature**: 001-dashboard-layout-update  
**Date**: 2026-01-14

## 功能概述

将 dashboard 页面从当前的顶部导航 + 水平标签导航结构重构为左右结构布局（左侧主导航栏 + 右侧工作区），采用黑白极简风格设计，并基于项目现有的 shadcn/ui 组件体系实现。

主要任务：
- 安装 shadcn/ui Sidebar 组件
- 重构 `app/(dashboard)/layout.tsx` 实现左右布局
- 创建左侧导航组件（`components/layout/DashboardSidebar.tsx`）
- 调整导航配置和路由结构
- 实现响应式折叠和抽屉式导航
- 优化所有 dashboard 子页面的布局适配

## 前置条件

### 1. 环境配置

1. **Node.js 和包管理器**:
   - Node.js 18+ 已安装
   - pnpm 或 npm 已配置

2. **项目依赖**:
   - Next.js 14+ 已安装
   - TypeScript 5.9+ 已配置
   - Tailwind CSS 4.1+ 已配置
   - shadcn/ui 组件库已配置（`components.json` 已存在）
   - Radix UI 组件已安装（shadcn/ui 依赖）

3. **开发环境**:
   ```bash
   # 确保项目可以正常运行
   pnpm install
   pnpm dev
   ```

4. **Git 分支**:
   ```bash
   # 确保在正确的分支上
   git checkout 001-dashboard-layout-update
   ```

## 快速开始

### 步骤 1: 安装 shadcn/ui Sidebar 组件

```bash
# 安装 Sidebar 组件
npx shadcn@latest add sidebar

# 按照提示确认配置：
# - 组件会安装到 components/ui/sidebar.tsx
# - 依赖的 Radix UI 组件会自动安装
```

**验证**: 检查 `components/ui/sidebar.tsx` 文件是否存在，并确认导出的组件可用。

---

### 步骤 2: 创建导航配置类型定义

创建 `types/dashboard.types.ts` 文件：

```typescript
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
```

---

### 步骤 3: 创建左侧导航组件

创建 `components/layout/DashboardSidebar.tsx` 文件：

```typescript
'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, BarChart3, TrendingUp, FileText, Users, Globe, Settings } from 'lucide-react'
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { NavItem } from '@/types/dashboard.types'

const navItems: NavItem[] = [
  { id: 'home', label: '主页', icon: <Home className="size-4" />, href: '/home' },
  {
    id: 'analytics',
    label: '数据分析',
    icon: <BarChart3 className="size-4" />,
    href: '/analytics',
    children: [
      { id: 'data-overview', label: '数据概览', icon: <TrendingUp className="size-4" />, href: '/data-overview' },
      { id: 'content-analysis', label: '内容分析', icon: <FileText className="size-4" />, href: '/content-analysis' }
    ]
  },
  {
    id: 'publish',
    label: '发布管理',
    icon: <FileText className="size-4" />,
    href: '/publish',
    children: [
      { id: 'create-article', label: '创建图文', icon: <FileText className="size-4" />, href: '/publish/create-article' },
      { id: 'create-video', label: '创建视频', icon: <FileText className="size-4" />, href: '/publish/create-video' },
      { id: 'works-management', label: '作品管理', icon: <FileText className="size-4" />, href: '/publish/works' },
      { id: 'publish-history', label: '发布记录', icon: <FileText className="size-4" />, href: '/publish/history' }
    ]
  },
  { id: 'accounts', label: '账号管理', icon: <Users className="size-4" />, href: '/accounts' },
  { id: 'platforms', label: '平台管理', icon: <Globe className="size-4" />, href: '/platforms' },
  { id: 'settings', label: '设置', icon: <Settings className="size-4" />, href: '/settings' }
]

export function DashboardSidebar() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(href + '/')
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            {navItems
              .filter(item => item.visible !== false)
              .map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)}>
                    <Link href={item.href}>
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.children && (
                    <SidebarGroupContent>
                      {item.children.map((child) => (
                        <SidebarMenuItem key={child.id}>
                          <SidebarMenuButton asChild isActive={isActive(child.href)}>
                            <Link href={child.href}>
                              {child.icon}
                              <span>{child.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarGroupContent>
                  )}
                </SidebarMenuItem>
              ))}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
```

**注意**: 这是一个简化版本，实际实现需要：
- 处理响应式折叠逻辑
- 实现抽屉式导航（移动端）
- 添加手动收起/展开按钮
- 优化子菜单的展开/收起交互

---

### 步骤 4: 重构 Dashboard Layout

修改 `app/(dashboard)/layout.tsx` 文件，改为左右布局结构：

```typescript
'use client'

import { SidebarProvider } from '@/components/ui/sidebar'
import { DashboardSidebar } from '@/components/layout/DashboardSidebar'
// ... 其他导入

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <DashboardSidebar />
        <main className="flex-1 overflow-y-auto">
          {/* 顶部品牌和用户信息区域（可选，保留或移除） */}
          <header className="h-16 border-b flex items-center px-6">
            {/* 品牌 Logo 和用户信息 */}
          </header>
          {/* 右侧工作区内容 */}
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
```

**注意**: 实际实现需要：
- 处理响应式布局（窄屏时折叠导航）
- 保留或重构顶部品牌和用户信息区域
- 确保右侧工作区内容正确显示

---

### 步骤 5: 验证和测试

1. **启动开发服务器**:
   ```bash
   pnpm dev
   ```

2. **验证功能**:
   - 访问 `http://localhost:3000/home`，检查左右布局是否正确显示
   - 点击左侧导航项，检查路由切换是否正常
   - 检查导航高亮状态是否正确
   - 调整浏览器宽度，检查响应式折叠是否正常工作
   - 检查黑白极简风格是否符合要求

3. **检查 TypeScript 类型**:
   ```bash
   pnpm build
   # 或
   npx tsc --noEmit
   ```

---

## 后续步骤

1. **优化响应式折叠逻辑**: 实现自动折叠（窄屏）和手动收起/展开功能
2. **实现抽屉式导航**: 在移动端使用侧滑抽屉显示导航
3. **调整子页面布局**: 确保所有 dashboard 子页面在新布局下正确显示
4. **优化黑白极简风格**: 调整颜色、间距、阴影等细节，确保符合设计规范
5. **添加加载状态**: 实现 skeleton 骨架屏或 loading 状态（FR-010）

---

## 常见问题

**Q: Sidebar 组件安装失败？**  
A: 检查 `components.json` 配置是否正确，确保 `tailwind.config.js` 和 `app/globals.css` 路径正确。

**Q: 导航高亮不工作？**  
A: 检查 `usePathname()` 是否正确导入，确保路由路径匹配逻辑正确。

**Q: 响应式折叠不生效？**  
A: 检查 Tailwind CSS 断点配置，确保 `md:`, `lg:` 等类名正确应用。

**Q: 右侧工作区内容溢出？**  
A: 检查 `overflow-y-auto` 是否正确应用，确保 `flex-1` 和 `h-screen` 布局正确。

---

## 参考资源

- [shadcn/ui Sidebar 文档](https://ui.shadcn.com/docs/components/sidebar)
- [Next.js App Router 文档](https://nextjs.org/docs/app)
- [Tailwind CSS 响应式设计](https://tailwindcss.com/docs/responsive-design)
- [Radix UI 文档](https://www.radix-ui.com/)
