# Research: 页面重构与 shadcn/ui 组件接入方案

**Feature**: 004-page-refactor-shadcn  
**Date**: 2025-01-13

## Research Questions

### 1. shadcn/ui 组件库安装和配置

**Decision**: 使用 shadcn/ui CLI 工具安装组件，配置 `components.json` 文件

**Rationale**: 
- shadcn/ui 是基于 Radix UI 和 Tailwind CSS 的组件库，与现有技术栈完美匹配
- 组件以源代码形式安装，可以完全自定义和修改
- 支持 TypeScript，符合 Type-Safety First 原则
- 组件按需安装，不增加不必要的依赖

**安装步骤**:
1. 初始化 shadcn/ui: `npx shadcn@latest init`
2. 配置 `components.json`:
   ```json
   {
     "$schema": "https://ui.shadcn.com/schema.json",
     "style": "default",
     "rsc": true,
     "tsx": true,
     "tailwind": {
       "config": "tailwind.config.js",
       "css": "app/globals.css",
       "baseColor": "slate",
       "cssVariables": true
     },
     "aliases": {
       "components": "@/components",
       "utils": "@/lib/utils"
     }
   }
   ```
3. 安装所需组件: `npx shadcn@latest add button input card dialog tabs ...`

**关键配置**:
- **style**: 使用 "default" 风格（可自定义）
- **rsc**: 启用 React Server Components 支持（Next.js 14 App Router）
- **tsx**: 使用 TypeScript
- **tailwind**: 配置 Tailwind CSS 路径和主题
- **aliases**: 配置路径别名（与现有 tsconfig.json 一致）

**Alternatives considered**:
- 使用 Material-UI: 不符合项目设计风格，依赖较重
- 使用 Ant Design: 不符合项目设计风格，组件风格固定
- 使用 Chakra UI: 不符合项目设计风格，需要额外配置

**实现位置**: 项目根目录 `components.json`

---

### 2. 现有组件迁移策略

**Decision**: 逐步迁移，优先迁移核心组件（Button, Input, Card），然后迁移页面组件

**Rationale**:
- 渐进式迁移降低风险，确保功能稳定
- 优先迁移基础组件，为页面重构提供基础
- 保持功能不变，仅替换 UI 层

**迁移顺序**:
1. **Phase 1**: 基础组件（Button, Input, Card, Dialog, Tabs）
2. **Phase 2**: 布局组件（Header, Sidebar, TabNav）
3. **Phase 3**: Dashboard 组件（StatsCard, ContentGrid）
4. **Phase 4**: 页面组件（login, register, home, publish, schedule, analytics, settings）

**迁移步骤**:
1. 安装对应的 shadcn/ui 组件
2. 替换现有组件引用
3. 调整样式（使用 Tailwind CSS 类名）
4. 移除 CSS Modules 文件
5. 测试功能是否正常

**样式迁移**:
- CSS Modules → Tailwind CSS 类名
- 使用 `cn()` 工具函数合并类名
- 保持响应式设计（使用 Tailwind 断点）

**Alternatives considered**:
- 一次性迁移所有组件: 风险太高，难以测试和回滚
- 仅迁移部分组件: 不符合统一组件库的目标

**实现位置**: `components/ui/` 和 `app/` 目录

---

### 3. CSS Modules 迁移到 Tailwind CSS

**Decision**: 逐步移除 CSS Modules 文件，统一使用 Tailwind CSS 进行样式管理

**Rationale**:
- Tailwind CSS 已在项目中配置，无需额外设置
- 统一样式管理方式，提升开发效率
- 减少样式文件数量，简化项目结构
- 更好的响应式设计支持

**迁移策略**:
1. **分析现有样式**: 识别 CSS Modules 中的样式规则
2. **转换为 Tailwind 类名**: 将 CSS 规则转换为对应的 Tailwind 类名
3. **处理复杂样式**: 对于 Tailwind 无法直接表达的样式，使用 `@apply` 指令或自定义 CSS
4. **移除 CSS Modules 文件**: 确认样式迁移完成后删除 `.module.css` 文件

**样式转换示例**:
```css
/* 原 CSS Modules */
.container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  background: white;
  border-radius: 0.5rem;
}

/* 转换为 Tailwind */
<div className="flex flex-col gap-4 p-6 bg-white rounded-lg">
```

**自定义样式处理**:
- 使用 `@apply` 指令: 对于重复的样式组合，可以在 `globals.css` 中定义
- 使用 CSS 变量: 对于主题色等，使用 Tailwind 的 CSS 变量系统
- 使用 `cn()` 函数: 动态合并类名，处理条件样式

**Alternatives considered**:
- 保留 CSS Modules: 不符合统一管理目标，增加维护成本
- 使用 Styled Components: 不符合项目技术栈，增加运行时开销

**实现位置**: `app/globals.css` 和组件文件

---

### 4. 响应式设计优化

**Decision**: 使用 Tailwind CSS 默认断点系统，优化移动端和桌面端体验

**Rationale**:
- Tailwind CSS 提供标准的响应式断点（sm, md, lg, xl, 2xl）
- 移动优先的设计方法，确保基础体验良好
- 统一的断点系统，便于维护和扩展

**断点定义**:
- **sm**: 640px（小屏设备）
- **md**: 768px（平板）
- **lg**: 1024px（桌面）
- **xl**: 1280px（大桌面）
- **2xl**: 1536px（超大桌面）

**响应式策略**:
1. **移动优先**: 基础样式针对移动端设计
2. **渐进增强**: 使用 `md:`, `lg:` 等前缀增强桌面端体验
3. **布局适配**: 使用 Flexbox 和 Grid 实现响应式布局
4. **组件适配**: 组件在不同屏幕尺寸下自适应

**实现示例**:
```tsx
// 响应式布局
<div className="flex flex-col md:flex-row gap-4">
  <div className="w-full md:w-1/2">...</div>
  <div className="w-full md:w-1/2">...</div>
</div>

// 响应式文本
<h1 className="text-2xl md:text-3xl lg:text-4xl">标题</h1>

// 响应式间距
<div className="p-4 md:p-6 lg:p-8">...</div>
```

**Alternatives considered**:
- 自定义断点: 不符合标准，增加维护成本
- 使用媒体查询: Tailwind 已提供响应式工具，无需手动编写

**实现位置**: 所有页面和组件文件

---

### 5. 组件类型定义和文档

**Decision**: 使用 shadcn/ui 组件的 TypeScript 类型定义，补充必要的 JSDoc 注释

**Rationale**:
- shadcn/ui 组件自带完整的 TypeScript 类型定义
- 符合 Type-Safety First 原则
- JSDoc 注释提供更好的开发体验和文档

**类型定义**:
- shadcn/ui 组件已包含完整的 props 类型定义
- 自定义组件需要明确定义 props 类型
- 避免使用 `any` 类型，必要时使用 `unknown`

**文档要求**:
- 组件文件顶部添加简要说明
- Props 接口添加 JSDoc 注释
- 复杂组件添加使用示例

**实现示例**:
```tsx
/**
 * Button 组件 - 基于 shadcn/ui Button 组件
 * 
 * @example
 * <Button variant="default" size="default">点击</Button>
 */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 按钮变体 */
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  /** 按钮尺寸 */
  size?: "default" | "sm" | "lg" | "icon"
}
```

**Alternatives considered**:
- 不添加文档: 降低代码可维护性
- 使用外部文档工具: 增加维护成本，不符合项目需求

**实现位置**: 所有组件文件

---

### 6. 测试策略

**Decision**: 使用 React Testing Library 进行组件测试，确保重构后功能不变

**Rationale**:
- React Testing Library 专注于用户行为测试，符合测试原则
- 测试组件功能而非实现细节
- 确保重构后功能保持不变

**测试范围**:
1. **组件测试**: 测试核心组件功能（Button, Input, Card 等）
2. **页面测试**: 测试页面关键功能（登录、发布等）
3. **集成测试**: 测试页面与 API 的集成（可选）

**测试重点**:
- 组件渲染正常
- 用户交互正常（点击、输入等）
- 样式应用正确（响应式布局）
- 功能逻辑不变

**实现示例**:
```tsx
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/button'

test('Button renders correctly', () => {
  render(<Button>Click me</Button>)
  expect(screen.getByRole('button')).toBeInTheDocument()
})
```

**Alternatives considered**:
- 不进行测试: 风险太高，无法确保功能稳定
- 使用 Enzyme: 不符合 React Testing Library 的最佳实践

**实现位置**: `__tests__/` 或 `*.test.tsx` 文件

---

## 技术选型总结

| 技术 | 选择 | 理由 |
|------|------|------|
| 组件库 | shadcn/ui | 与现有技术栈匹配，可自定义，TypeScript 支持 |
| 样式管理 | Tailwind CSS | 已在项目中配置，统一管理，响应式支持 |
| 迁移策略 | 渐进式迁移 | 降低风险，确保功能稳定 |
| 测试框架 | React Testing Library | 符合测试原则，专注用户行为 |

## 下一步行动

1. 安装和配置 shadcn/ui
2. 迁移基础组件（Button, Input, Card）
3. 迁移布局组件（Header, Sidebar）
4. 迁移页面组件（逐步进行）
5. 移除 CSS Modules 文件
6. 优化响应式设计
7. 编写测试用例
