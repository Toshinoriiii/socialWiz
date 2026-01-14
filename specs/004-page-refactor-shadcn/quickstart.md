# Quick Start: 页面重构与 shadcn/ui 组件接入

**Feature**: 004-page-refactor-shadcn  
**Date**: 2025-01-13

## 功能概述

将现有页面和组件重构并迁移到 shadcn/ui 组件库，统一 UI 风格，提升代码质量和可维护性。

主要任务：
- 安装和配置 shadcn/ui 组件库
- 迁移现有组件到 shadcn/ui
- 移除 CSS Modules，统一使用 Tailwind CSS
- 优化响应式设计
- 提升代码组织和可维护性

## 前置条件

### 1. 环境配置

1. **Node.js 和包管理器**:
   - Node.js 18+ 已安装
   - pnpm 或 npm 已配置

2. **项目依赖**:
   - Next.js 14+ 已安装
   - TypeScript 5.9+ 已配置
   - Tailwind CSS 4.1+ 已配置
   - Radix UI 组件已安装（shadcn/ui 依赖）

3. **开发环境**:
   ```bash
   # 确保项目可以正常运行
   pnpm install
   pnpm dev
   ```

## 快速开始

### 步骤 1: 安装 shadcn/ui

```bash
# 初始化 shadcn/ui
npx shadcn@latest init

# 按照提示配置：
# - Style: default
# - Base color: slate
# - CSS variables: yes
# - Components: @/components
# - Utils: @/lib/utils
```

这将创建 `components.json` 配置文件。

### 步骤 2: 安装基础组件

```bash
# 安装核心组件
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add card
npx shadcn@latest add dialog
npx shadcn@latest add tabs
npx shadcn@latest add label
npx shadcn@latest add textarea
npx shadcn@latest add select
npx shadcn@latest add dropdown-menu
npx shadcn@latest add tooltip
npx shadcn@latest add badge
npx shadcn@latest add alert
npx shadcn@latest add separator
npx shadcn@latest add scroll-area
npx shadcn@latest add progress
```

### 步骤 3: 创建工具函数

确保 `lib/utils/cn.ts` 文件存在（shadcn/ui 需要）：

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### 步骤 4: 迁移基础组件

#### 4.1 迁移 Button 组件

**原组件**: `components/ui/Button.tsx`  
**新组件**: `components/ui/button.tsx` (shadcn/ui)

```tsx
// 替换所有 Button 引用
import { Button } from "@/components/ui/button"

// 使用示例
<Button variant="default" size="default">点击</Button>
```

#### 4.2 迁移 Input 组件

**原组件**: `components/ui/Input.tsx`  
**新组件**: `components/ui/input.tsx` (shadcn/ui)

```tsx
// 替换所有 Input 引用
import { Input } from "@/components/ui/input"

// 使用示例
<Input type="text" placeholder="请输入..." />
```

#### 4.3 迁移 Card 组件

**原组件**: `components/ui/Card.tsx`  
**新组件**: `components/ui/card.tsx` (shadcn/ui)

```tsx
// 替换所有 Card 引用
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

// 使用示例
<Card>
  <CardHeader>
    <CardTitle>标题</CardTitle>
  </CardHeader>
  <CardContent>内容</CardContent>
</Card>
```

### 步骤 5: 迁移页面组件

#### 5.1 迁移登录页面

**文件**: `app/(auth)/login/page.tsx`

```tsx
// 移除 CSS Modules 导入
// import styles from './login.module.css'

// 使用 shadcn/ui 组件
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

// 使用 Tailwind CSS 类名替换 CSS Modules
<div className="flex items-center justify-center min-h-screen">
  <Card className="w-full max-w-md">
    <CardHeader>
      <CardTitle>登录</CardTitle>
    </CardHeader>
    <CardContent>
      <form className="space-y-4">
        <Input type="email" placeholder="邮箱" />
        <Input type="password" placeholder="密码" />
        <Button type="submit" className="w-full">登录</Button>
      </form>
    </CardContent>
  </Card>
</div>
```

**删除文件**: `app/(auth)/login/login.module.css`

#### 5.2 迁移 Dashboard 首页

**文件**: `app/(dashboard)/home/page.tsx`

```tsx
// 使用 shadcn/ui 组件重构
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

// 使用 Tailwind CSS 响应式类名
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <Card>
    <CardHeader>
      <CardTitle>统计卡片</CardTitle>
    </CardHeader>
    <CardContent>内容</CardContent>
  </Card>
</div>
```

**删除文件**: `app/(dashboard)/home/home.module.css`

### 步骤 6: 验证功能

1. **启动开发服务器**:
   ```bash
   pnpm dev
   ```

2. **测试页面功能**:
   - 访问 `http://localhost:3000/login` - 验证登录页面
   - 访问 `http://localhost:3000/dashboard/home` - 验证首页
   - 访问 `http://localhost:3000/dashboard/publish` - 验证发布页面
   - 测试响应式布局（调整浏览器窗口大小）

3. **检查控制台**:
   - 确保没有 TypeScript 错误
   - 确保没有运行时错误
   - 确保样式正确应用

## 迁移检查清单

### 基础组件迁移

- [ ] Button 组件已迁移
- [ ] Input 组件已迁移
- [ ] Card 组件已迁移
- [ ] Dialog 组件已迁移
- [ ] Tabs 组件已迁移
- [ ] 其他基础组件已迁移

### 布局组件迁移

- [ ] Header 组件已迁移
- [ ] Sidebar 组件已迁移
- [ ] TabNav 组件已迁移

### 页面组件迁移

- [ ] 登录页面已迁移
- [ ] 注册页面已迁移
- [ ] Dashboard 首页已迁移
- [ ] 发布页面已迁移
- [ ] 计划页面已迁移
- [ ] 分析页面已迁移
- [ ] 设置页面已迁移

### 样式迁移

- [ ] CSS Modules 文件已移除
- [ ] 样式已转换为 Tailwind CSS 类名
- [ ] 响应式设计已优化
- [ ] 自定义样式已处理

### 代码质量

- [ ] TypeScript 类型检查通过
- [ ] 组件功能测试通过
- [ ] 响应式布局测试通过
- [ ] 代码审查通过

## 常见问题

### Q: shadcn/ui 组件样式不符合设计？

**A**: shadcn/ui 组件可以完全自定义。修改 `components/ui/` 目录下的组件文件，或使用 Tailwind CSS 类名覆盖样式。

### Q: 如何保持现有功能不变？

**A**: 逐步迁移，每次迁移一个组件或页面，确保功能正常后再继续。使用 Git 分支管理，便于回滚。

### Q: CSS Modules 中的复杂样式如何迁移？

**A**: 
1. 优先使用 Tailwind CSS 类名
2. 对于 Tailwind 无法表达的样式，使用 `@apply` 指令
3. 对于动态样式，使用 `cn()` 函数合并类名
4. 必要时在 `globals.css` 中添加自定义 CSS

### Q: 响应式设计如何实现？

**A**: 使用 Tailwind CSS 响应式前缀：
- `sm:` - 640px+
- `md:` - 768px+
- `lg:` - 1024px+
- `xl:` - 1280px+
- `2xl:` - 1536px+

### Q: 组件类型定义在哪里？

**A**: shadcn/ui 组件自带完整的 TypeScript 类型定义。自定义组件需要在组件文件中定义 props 类型。

## 下一步

完成基础迁移后，可以：
1. 运行 `/speckit.tasks` 生成详细任务列表
2. 优化组件复用性
3. 完善响应式设计
4. 编写组件测试
5. 优化性能（代码分割、懒加载等）
