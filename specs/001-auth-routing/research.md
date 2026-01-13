# Research: 认证路由保护

**Feature**: 001-auth-routing  
**Date**: 2025-01-05

## Research Questions

### 1. Next.js App Router 路由保护最佳实践

**Decision**: 采用混合方案 - 客户端组件进行路由重定向，服务端中间件进行 API 路由保护

**Rationale**: 
- Next.js App Router 支持服务端组件（Server Components）和客户端组件（Client Components）
- 对于页面级路由重定向，客户端组件更灵活，可以访问 localStorage 和 Zustand store
- 对于 API 路由保护，服务端中间件更安全，可以验证 token 而不暴露给客户端
- 现有代码已使用客户端组件（`app/page.tsx` 使用 'use client'），保持一致性

**Alternatives considered**:
- **纯服务端方案（Middleware）**: 优点是可以保护所有路由，但 Next.js middleware 无法直接访问 localStorage，需要从 cookie 读取 token，需要修改现有认证流程
- **纯客户端方案**: 简单直接，但无法保护 API 路由，安全性较低
- **混合方案**: 结合两者优势，客户端处理页面路由，服务端保护 API

### 2. 认证状态检查位置和时机

**Decision**: 在根页面组件（`app/page.tsx`）的 `useEffect` 中检查，同时考虑添加中间件用于 API 路由保护

**Rationale**:
- 根页面是用户访问应用的第一入口点，在此检查最直接
- `useEffect` 在客户端渲染后执行，可以访问 localStorage 和 Zustand store
- 现有代码已在 `app/page.tsx` 中有部分认证检查逻辑，可以扩展
- 对于 API 路由，使用 Next.js middleware 在请求到达 API handler 前验证

**Alternatives considered**:
- **根布局（layout.tsx）**: 会在所有页面加载时执行，但根布局通常是服务端组件，无法直接访问客户端状态
- **自定义 HOC**: 需要包装每个页面，增加复杂度
- **路由守卫组件**: 可以作为可复用组件，但根页面场景下直接检查更简单

### 3. Token 验证和错误处理

**Decision**: 使用现有 `AuthService.verifyToken()` 方法，在客户端调用 API 端点进行验证

**Rationale**:
- 现有 `AuthService.verifyToken()` 已实现完整的 token 验证逻辑（JWT 验证 + 缓存查询）
- 客户端不应直接调用服务层代码，应通过 API 端点调用
- 需要创建新的 API 端点 `/api/auth/verify` 来验证 token
- 错误处理：token 无效/过期时返回 401，客户端据此判断未登录状态

**Alternatives considered**:
- **直接调用 AuthService**: 违反 Constitution 的 Service Layer Architecture 原则
- **仅检查 localStorage token 存在性**: 不安全，无法验证 token 有效性
- **服务端中间件验证**: 对于页面路由，middleware 无法直接访问客户端 token（localStorage）

### 4. 路由重定向实现方式

**Decision**: 使用 Next.js `useRouter().push()` 进行客户端重定向

**Rationale**:
- Next.js App Router 推荐使用 `useRouter` hook 进行客户端导航
- `router.push()` 支持客户端路由，不会触发完整页面刷新，性能更好
- 现有代码已使用 `useRouter`，保持一致性
- 对于服务端场景，可以使用 `redirect()` 函数

**Alternatives considered**:
- **`window.location.href`**: 会触发完整页面刷新，性能较差
- **`<Link>` 组件**: 需要用户交互，不适合自动重定向
- **服务端 `redirect()`**: 仅适用于服务端组件，当前场景是客户端组件

### 5. 多标签页场景处理

**Decision**: 使用 `window.addEventListener('storage')` 监听 localStorage 变化，同步更新认证状态

**Rationale**:
- 当用户在标签页 A 登出时，localStorage 的 token 被清除
- `storage` 事件会在其他标签页触发，可以监听并更新 Zustand store
- 更新 store 后，组件会自动重新渲染并执行路由检查
- 这是 Web 应用处理多标签页状态同步的标准做法

**Alternatives considered**:
- **轮询检查**: 性能开销大，不推荐
- **WebSocket**: 过度设计，对于认证状态同步不需要实时通信
- **忽略多标签页**: 用户体验差，可能导致状态不一致

### 6. 加载状态和页面闪烁

**Decision**: 在认证检查期间显示加载状态，避免页面内容闪烁

**Rationale**:
- 认证检查是异步操作（API 调用），需要时间
- 在检查期间显示加载指示器，提升用户体验
- 避免先显示根页面内容再重定向造成的闪烁
- 可以使用简单的 loading spinner 或 skeleton screen

**Alternatives considered**:
- **不显示加载状态**: 用户体验差，可能出现内容闪烁
- **服务端预检查**: 需要修改为服务端组件，增加复杂度
- **Suspense 边界**: Next.js 13+ 支持，但需要服务端组件，当前场景不适合

### 7. 登录页面已登录检查

**Decision**: 在登录页面组件中添加认证检查，如果已登录则重定向到管理页面

**Rationale**:
- 登录页面应该检查用户是否已登录
- 如果已登录，直接重定向到管理页面，避免重复登录流程
- 实现方式与根页面类似，在 `useEffect` 中检查
- 提升用户体验，符合规范要求（User Story 3）

**Alternatives considered**:
- **不检查**: 用户体验差，已登录用户会看到登录表单
- **服务端检查**: 需要将登录页面改为服务端组件，增加复杂度

## Technical Decisions Summary

1. **架构**: 客户端组件 + API 端点 + 可选中间件
2. **认证检查**: 在根页面和登录页面的 `useEffect` 中执行
3. **Token 验证**: 通过 `/api/auth/verify` API 端点调用 `AuthService.verifyToken()`
4. **路由重定向**: 使用 `useRouter().push()` 进行客户端导航
5. **多标签页**: 使用 `storage` 事件监听 localStorage 变化
6. **加载状态**: 显示简单的加载指示器
7. **错误处理**: API 返回 401 时视为未登录，重定向到登录页

## Dependencies

- 现有 `AuthService.verifyToken()` 方法 ✅
- 现有 `useUserStore` Zustand store ✅
- 需要创建 `/api/auth/verify` API 端点 ⚠️
- 可选：创建 `lib/middleware.ts` 用于 API 路由保护 ⚠️

## Implementation Notes

- 所有代码必须通过 TypeScript 类型检查
- 遵循 Service Layer Architecture，不在组件中直接调用 AuthService
- 错误处理要完善，网络错误时应有降级方案（默认重定向到登录页）
- 考虑 token 过期场景，确保正确识别并重定向
