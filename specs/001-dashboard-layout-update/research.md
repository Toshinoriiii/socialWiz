# Research: Dashboard 交互布局重构技术选型

**Feature**: 001-dashboard-layout-update  
**Date**: 2026-01-14

## Research Questions

### 1. shadcn/ui Sidebar 组件安装和配置

**Decision**: 使用 shadcn/ui CLI 工具安装 Sidebar 组件，配置响应式折叠和抽屉式导航

**Rationale**: 
- shadcn/ui Sidebar 组件基于 Radix UI 和 Tailwind CSS，与现有技术栈完美匹配
- 组件以源代码形式安装，可以完全自定义和修改，符合黑白极简风格要求
- 支持 TypeScript，符合 Type-Safety First 原则
- 内置响应式支持，可以配置断点和折叠行为
- 与项目已有的 shadcn/ui 组件（Button, Card, Tabs 等）设计风格一致

**安装步骤**:
1. 安装 Sidebar 组件: `npx shadcn@latest add sidebar`
2. 检查 `components.json` 配置（已存在，style: "new-york", baseColor: "zinc"）
3. 验证 Sidebar 组件文件生成在 `components/ui/sidebar.tsx`

**关键配置**:
- **响应式断点**: 使用 Tailwind CSS 断点（`md:`, `lg:` 等）
  - `≥ 1024px`: 完整导航显示
  - `< 1024px`: 自动折叠为图标栏
  - `< 768px`: 抽屉式导航（侧滑显示）
- **手动收起/展开**: 使用 Sidebar 组件的 `collapsible` 和 `defaultOpen` props
- **导航高亮**: 使用 `usePathname()` 和 `cn()` 工具函数实现当前路由高亮

**Alternatives considered**:
- 自定义 Sidebar 组件: 开发成本高，不符合使用 shadcn/ui 组件库的原则（FR-004）
- 使用其他 UI 库（如 Ant Design Sidebar）: 不符合项目设计风格，依赖较重
- 使用纯 CSS 实现: 缺少无障碍支持和交互状态管理，不符合 shadcn/ui 组件规范

**实现位置**: `components/ui/sidebar.tsx` (通过 CLI 安装), `components/layout/DashboardSidebar.tsx` (自定义封装)

---

### 2. 左右布局结构实现方案

**Decision**: 使用 Flexbox 布局（`flex`）实现左右结构，左侧导航固定宽度，右侧工作区自适应

**Rationale**:
- Flexbox 布局简单高效，符合现代 CSS 最佳实践
- 支持响应式折叠（通过 Tailwind CSS 类名控制）
- 与 Next.js App Router 的布局系统兼容
- 左侧导航固定宽度（例如 `w-64`），右侧工作区使用 `flex-1` 自适应

**布局结构**:
```tsx
<div className="flex h-screen">
  <aside className="w-64 border-r"> {/* 左侧导航 */}
    <DashboardSidebar />
  </aside>
  <main className="flex-1 overflow-y-auto"> {/* 右侧工作区 */}
    {children}
  </main>
</div>
```

**响应式处理**:
- 桌面端（`≥ 1024px`）: 左右布局正常显示
- 窄屏（`< 1024px`）: 左侧导航折叠为图标栏（`w-16`），或隐藏（抽屉式）
- 更窄（`< 768px`）: 左侧导航完全隐藏，通过菜单按钮触发抽屉式导航

**Alternatives considered**:
- CSS Grid 布局: 功能更强大但复杂度更高，Flexbox 已足够满足需求
- 固定定位（`fixed`）: 需要处理右侧内容区域的 padding，增加复杂度

**实现位置**: `app/(dashboard)/layout.tsx`

---

### 3. 导航路由结构和模块映射

**Decision**: 使用 Next.js App Router 的路由结构，导航配置集中管理在类型定义文件中

**Rationale**:
- Next.js App Router 支持嵌套路由和布局，符合模块化需求
- 导航配置集中管理便于维护和扩展
- 使用 TypeScript 类型定义确保类型安全
- 支持路由高亮（通过 `usePathname()` 匹配）

**路由结构**:
```text
app/(dashboard)/
├── layout.tsx          # 左右布局结构
├── home/               # 主页 → /home
│   └── page.tsx
├── analytics/          # 数据分析 → /analytics
│   └── page.tsx
├── data-overview/      # 数据概览 → /data-overview (可能需要新增)
│   └── page.tsx
├── publish/            # 发布管理 → /publish
│   └── page.tsx
├── accounts/           # 账号管理 → /accounts (可能需要新增)
│   └── page.tsx
├── platforms/          # 平台管理 → /platforms (可能需要新增)
│   └── page.tsx
└── settings/           # 设置 → /settings
    └── page.tsx
```

**导航配置结构**:
```typescript
interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  href: string
  children?: NavItem[]  // 支持子菜单（如"数据分析"下的"数据概览"）
}
```

**路由高亮逻辑**:
- 使用 `usePathname()` 获取当前路径
- 匹配规则: `pathname === item.href || pathname.startsWith(item.href + '/')`
- 使用 `cn()` 工具函数动态添加高亮样式类

**Alternatives considered**:
- 使用路由配置文件（JSON）: 缺少类型检查，不符合 Type-Safety First 原则
- 在每个页面组件中单独定义: 配置分散，不利于维护

**实现位置**: `types/dashboard.types.ts` (导航配置类型), `components/layout/DashboardSidebar.tsx` (导航组件)

---

### 4. 黑白极简风格实现方案

**Decision**: 使用 Tailwind CSS 颜色系统（`slate`, `zinc`, `gray`）和 shadcn/ui 默认主题，通过自定义 CSS 变量控制强调色

**Rationale**:
- Tailwind CSS 提供丰富的灰度色阶（`slate-50` 到 `slate-900`），符合黑白极简风格
- shadcn/ui 默认主题已配置 `baseColor: "zinc"`，与黑白风格匹配
- 通过 CSS 变量（`--primary`, `--secondary`）控制强调色，便于统一管理
- 图表和状态标签使用品牌主色（控制在 2-3 种），符合 FR-005 要求

**颜色方案**:
- **背景**: `bg-white` 或 `bg-slate-50`（浅灰）
- **文本**: `text-slate-900`（深黑）或 `text-slate-700`（深灰）
- **边框/分割线**: `border-slate-200`（低饱和灰色）
- **强调色**: 使用 CSS 变量 `--primary`（品牌主色，例如 `hsl(217, 91%, 60%)` 蓝色）
- **图表/状态**: 品牌主色 + 1-2 种辅助色（例如绿色 `hsl(142, 76%, 36%)` 用于成功状态）

**交互状态**:
- **Hover**: 使用阴影（`shadow-sm`）或边框变化（`border-slate-300`），不使用高饱和底色块
- **Active**: 使用灰度变化（`bg-slate-100`）或边框高亮（`border-primary`）
- **Focus**: 使用 `ring` 工具类（`ring-2 ring-primary ring-offset-2`）

**实现方式**:
- 在 `app/globals.css` 中定义 CSS 变量（如果尚未定义）
- 使用 Tailwind CSS 类名直接应用颜色
- shadcn/ui 组件自动使用主题颜色变量

**Alternatives considered**:
- 完全自定义颜色系统: 开发成本高，不符合使用 Tailwind CSS 和 shadcn/ui 的原则
- 使用高饱和色彩: 不符合黑白极简风格要求

**实现位置**: `app/globals.css` (CSS 变量), `tailwind.config.js` (主题配置，如需要), 各组件文件（Tailwind 类名）

---

### 5. 响应式折叠和抽屉式导航实现

**Decision**: 使用 shadcn/ui Sidebar 组件的内置响应式功能和自定义断点逻辑，结合 `useState` 和 `useEffect` 实现折叠状态管理

**Rationale**:
- shadcn/ui Sidebar 组件内置 `collapsible` 和响应式支持
- 使用 React Hooks 管理折叠状态，符合 React 最佳实践
- 结合 Tailwind CSS 断点实现自动折叠
- 抽屉式导航使用 shadcn/ui Dialog 或 Sheet 组件（如需要）

**实现逻辑**:
1. **桌面端（≥ 1024px）**: 导航完整显示，支持手动收起/展开按钮
2. **窄屏（< 1024px）**: 自动折叠为图标栏（仅显示图标，隐藏文字）
3. **更窄（< 768px）**: 导航隐藏，通过菜单按钮触发抽屉式导航（侧滑显示）

**状态管理**:
```typescript
const [isCollapsed, setIsCollapsed] = useState(false)
const [isMobile, setIsMobile] = useState(false)

useEffect(() => {
  const checkMobile = () => {
    setIsMobile(window.innerWidth < 1024)
  }
  checkMobile()
  window.addEventListener('resize', checkMobile)
  return () => window.removeEventListener('resize', checkMobile)
}, [])
```

**折叠按钮**:
- 位置: 左侧导航底部或顶部
- 图标: 使用 `lucide-react` 的 `ChevronLeft` / `ChevronRight` 或 `PanelLeftClose` / `PanelLeftOpen`
- 功能: 切换 `isCollapsed` 状态，控制导航宽度和内容显示

**Alternatives considered**:
- 使用 CSS Media Queries 纯 CSS 实现: 缺少交互控制（手动收起/展开），不符合需求
- 使用第三方响应式库（如 `react-responsive`）: 增加依赖，Tailwind CSS 断点已足够

**实现位置**: `components/layout/DashboardSidebar.tsx` (折叠逻辑), `app/(dashboard)/layout.tsx` (响应式状态管理)

---

## Summary

所有技术选型已确定，无 NEEDS CLARIFICATION 项。主要决策：
1. 使用 shadcn/ui Sidebar 组件构建左侧导航
2. 使用 Flexbox 实现左右布局结构
3. 导航配置集中管理在 TypeScript 类型定义中
4. 使用 Tailwind CSS 灰度色系和 CSS 变量实现黑白极简风格
5. 使用 React Hooks 和 Tailwind 断点实现响应式折叠和抽屉式导航

所有方案均符合项目技术栈和 Constitution 原则，可以直接进入 Phase 1 设计阶段。
