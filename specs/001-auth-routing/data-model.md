# Data Model: 认证路由保护

**Feature**: 001-auth-routing  
**Date**: 2025-01-05

## Overview

此功能主要涉及认证状态的管理和路由决策，不涉及新的数据库实体。主要使用现有的用户认证相关数据结构和状态管理。

## Entities

### Authentication State (客户端状态)

**类型**: 客户端状态（Zustand store + localStorage）

**描述**: 表示用户当前的认证状态，用于路由决策

**属性**:
- `isAuthenticated: boolean` - 用户是否已登录
- `user: UserProfile | null` - 用户信息（如果已登录）
- `token: string | null` - JWT token（如果已登录）

**状态转换**:
- `未登录` → `已登录`: 用户成功登录后，设置 token 和 user，isAuthenticated = true
- `已登录` → `未登录`: 用户登出或 token 过期后，清除 token 和 user，isAuthenticated = false
- `已登录` → `已登录（更新）`: token 刷新或用户信息更新

**验证规则**:
- token 必须通过 `AuthService.verifyToken()` 验证
- token 过期或无效时，状态自动转换为未登录
- 多标签页间状态通过 localStorage 同步

### User Session (服务端)

**类型**: 现有实体（通过 AuthService 管理）

**描述**: 服务端的用户会话信息，存储在 Redis 缓存中

**属性**:
- `userId: string` - 用户 ID
- `userProfile: UserProfile` - 用户信息
- `expiresAt: Date` - 缓存过期时间（1小时）

**关系**:
- 与 `User` 实体关联（通过 userId）
- 存储在 Redis 中，key 格式：`user:{userId}`

## State Management

### Zustand Store (useUserStore)

**位置**: `store/user.store.ts`

**状态**:
```typescript
interface UserState {
  user: UserProfile | null
  token: string | null
  isAuthenticated: boolean
}
```

**操作**:
- `setUser(user, token)`: 设置用户信息和 token，标记为已登录
- `clearUser()`: 清除用户信息和 token，标记为未登录
- `updateProfile(updates)`: 更新用户信息

**持久化**: 使用 `persist` middleware，存储到 localStorage

## API Data Flow

### Token 验证请求

**端点**: `POST /api/auth/verify`

**请求**:
```typescript
{
  token: string
}
```

**响应（成功）**:
```typescript
{
  valid: true,
  user: UserProfile
}
```

**响应（失败）**:
```typescript
{
  valid: false,
  error: string
}
```

### 状态同步流程

1. **客户端检查**: 从 localStorage 读取 token
2. **API 验证**: 调用 `/api/auth/verify` 验证 token
3. **状态更新**: 根据验证结果更新 Zustand store
4. **路由决策**: 根据 `isAuthenticated` 状态决定重定向目标

## Validation Rules

1. **Token 格式**: 必须是有效的 JWT 格式
2. **Token 签名**: 必须使用正确的 JWT_SECRET 签名
3. **Token 过期**: 过期 token 视为无效
4. **用户存在性**: token 中的 userId 必须对应存在的用户

## Edge Cases Handling

1. **Token 不存在**: 视为未登录
2. **Token 格式错误**: 视为未登录，清除无效 token
3. **Token 验证失败（网络错误）**: 降级处理，默认视为未登录并重定向到登录页
4. **多标签页登出**: 通过 storage 事件同步状态，其他标签页自动更新

## Dependencies

- **UserProfile**: 来自 `types/user.types.ts`
- **AuthService**: 来自 `lib/services/auth.service.ts`
- **useUserStore**: 来自 `store/user.store.ts`
- **cacheHelper**: 来自 `lib/db/redis.ts`
