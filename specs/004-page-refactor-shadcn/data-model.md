# Data Model: 页面重构与 shadcn/ui 组件接入

**Feature**: 004-page-refactor-shadcn  
**Date**: 2025-01-13

## 说明

此功能不涉及数据模型变更。页面重构和组件迁移仅影响前端 UI 层，不涉及数据库结构、API 接口或业务逻辑的变更。

## 相关实体

### 现有数据模型（保持不变）

- **User**: 用户实体（认证相关）
- **PlatformAccount**: 平台账号实体（平台集成相关）
- **Content**: 内容实体（内容管理相关）
- **ContentPlatform**: 内容发布记录（发布相关）

所有数据模型保持不变，页面重构仅影响前端展示层。

## 组件结构（非数据模型）

### UI 组件层级

```
components/
├── ui/              # shadcn/ui 基础组件
├── layout/          # 布局组件
├── dashboard/       # Dashboard 特定组件
└── ai-elements/    # AI 相关组件
```

### 页面结构（非数据模型）

```
app/
├── (auth)/          # 认证页面
└── (dashboard)/     # Dashboard 页面
```

## 结论

此功能专注于前端 UI 重构，不涉及数据模型设计或变更。所有数据模型保持现有结构不变。
