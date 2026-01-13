# Data Model: 微博平台接入

**Feature**: 003-weibo-integration  
**Date**: 2025-01-13

## Overview

微博平台接入功能主要使用现有的 `PlatformAccount` 数据模型，扩展微博特定的字段和状态管理。同时需要实现微博适配器相关的类型定义和状态管理。

## Entities

### PlatformAccount (平台账号)

**位置**: `prisma/schema.prisma` (已存在)

**描述**: 存储用户连接的微博账号信息

**字段**:
- `id: string` - 平台账号 ID（UUID）
- `userId: string` - 用户 ID（关联 User）
- `platform: Platform` - 平台类型（WEIBO）
- `platformUserId: string` - 微博用户 ID（uid）
- `platformUsername: string` - 微博用户名（screen_name）
- `accessToken: string` - 访问令牌（加密存储）
- `refreshToken: string?` - 刷新令牌（Web 应用不支持，为 null）
- `tokenExpiry: DateTime?` - Token 过期时间
- `isConnected: boolean` - 是否已连接（默认 true）
- `createdAt: DateTime` - 创建时间
- `updatedAt: DateTime` - 更新时间

**验证规则**:
- `userId` 和 `platform` 组合必须唯一（一个用户只能连接一个微博账号）
- `accessToken` 必须加密存储
- `tokenExpiry` 必须设置（测试应用1天，普通应用30天）

**状态转换**:
- `未连接` → `已连接`: 用户完成 OAuth 授权，保存 access_token
- `已连接` → `需要重新授权`: token 过期或失效，标记 isConnected = false
- `需要重新授权` → `已连接`: 用户重新授权，更新 token

### WeiboTokenInfo (微博 Token 信息)

**类型**: TypeScript 接口（临时数据结构）

**位置**: `lib/platforms/weibo/weibo-types.ts`

**描述**: 微博 OAuth 返回的 Token 信息

**字段**:
```typescript
interface WeiboTokenInfo {
  access_token: string
  expires_in: number // 过期时间（秒）
  uid: string // 微博用户 ID
  refresh_token?: string // Web 应用不支持
}
```

**转换逻辑**:
- `expires_in` → `tokenExpiry`: `new Date(Date.now() + expires_in * 1000)`
- `uid` → `platformUserId`
- 需要调用 `users/show` 接口获取 `screen_name` → `platformUsername`

### WeiboUserInfo (微博用户信息)

**类型**: TypeScript 接口（临时数据结构）

**位置**: `lib/platforms/weibo/weibo-types.ts`

**描述**: 微博用户信息（从 API 获取）

**字段**:
```typescript
interface WeiboUserInfo {
  id: string // uid
  screen_name: string // 用户名
  name: string // 昵称
  avatar_large: string // 头像 URL
  followers_count: number // 粉丝数
  friends_count: number // 关注数
  statuses_count: number // 微博数
}
```

**用途**:
- 保存到 `PlatformAccount.platformUsername`
- 显示在用户界面
- 用于账号验证

### PublishContent (发布内容)

**类型**: TypeScript 接口

**位置**: `types/content.types.ts` (已存在，可能需要扩展)

**描述**: 统一的内容发布格式

**字段**:
```typescript
interface PublishContent {
  text: string // 文字内容
  images?: string[] // 图片 URL 数组（最多9张）
  video?: string // 视频 URL（可选）
  url?: string // 分享链接（可选）
}
```

**微博特定限制**:
- `text`: 纯文字2000字，分享链接140字
- `images`: 最多9张，每张<5M，格式 JPEG/GIF/PNG
- `video`: 需要进一步确认限制

### PublishResult (发布结果)

**类型**: TypeScript 接口

**位置**: `lib/platforms/weibo/weibo-types.ts`

**描述**: 微博发布 API 返回的结果

**字段**:
```typescript
interface PublishResult {
  success: boolean
  platformPostId?: string // 微博 ID（idstr）
  publishedUrl?: string // 微博链接
  error?: string // 错误信息
  errorCode?: string // 微博错误码
}
```

**存储**:
- `platformPostId` → `ContentPlatform.platformContentId`
- `publishedUrl` → `ContentPlatform.publishedUrl`
- `error` → `ContentPlatform.errorMessage`

### ContentPlatform (内容平台关联)

**位置**: `prisma/schema.prisma` (已存在)

**描述**: 内容发布到平台的记录

**字段**:
- `id: string` - 记录 ID
- `contentId: string` - 内容 ID
- `platformAccountId: string` - 平台账号 ID
- `platformContentId: string?` - 平台内容 ID（微博 ID）
- `publishStatus: PublishStatus` - 发布状态（PENDING/SUCCESS/FAILED）
- `errorMessage: string?` - 错误信息
- `publishedUrl: string?` - 发布链接
- `createdAt: DateTime` - 创建时间

**状态转换**:
- `PENDING` → `SUCCESS`: 发布成功
- `PENDING` → `FAILED`: 发布失败
- `FAILED` → `PENDING`: 重试发布

## State Management

### WeiboAdapter State (适配器状态)

**类型**: 类实例状态

**位置**: `lib/platforms/weibo/weibo-adapter.ts`

**状态**:
```typescript
class WeiboAdapter {
  private readonly apiClient: WeiboClient
  private readonly config: WeiboConfig
  
  // 平台标识
  readonly platform = Platform.WEIBO
}
```

**操作**:
- `getAuthUrl(config)`: 生成授权 URL
- `exchangeToken(code, config)`: 交换授权码获取 token
- `refreshToken(refreshToken)`: Web 应用不支持，返回错误
- `publish(token, content)`: 发布内容
- `getUserInfo(token)`: 获取用户信息
- `validateContent(content)`: 验证内容

### OAuth State (OAuth 状态)

**类型**: 服务端 Session 或 Redis

**位置**: OAuth 回调处理

**状态**:
- `state: string` - CSRF 防护 token
- `userId: string` - 发起授权的用户 ID
- `redirectUri: string` - 回调后的重定向地址

**存储策略**:
- 使用 Redis 存储（key: `oauth:weibo:{state}`）
- 过期时间：10分钟
- 回调后删除

## API Data Flow

### OAuth 授权流程

1. **获取授权 URL**:
   - 请求: `GET /api/platforms/weibo/auth`
   - 响应: `{ authUrl: string, state: string }`
   - 生成 state，保存到 Redis
   - 返回授权 URL

2. **用户授权**:
   - 用户跳转到微博授权页面
   - 用户完成授权
   - 微博回调: `GET /api/platforms/weibo/auth/callback?code=xxx&state=xxx`

3. **处理回调**:
   - 验证 state 参数
   - 调用 `WeiboAdapter.exchangeToken(code)`
   - 获取用户信息
   - 保存到 `PlatformAccount`
   - 重定向到设置页面

### 内容发布流程

1. **验证内容**:
   - 调用 `WeiboAdapter.validateContent(content)`
   - 检查文字长度、图片数量等

2. **检查 Token**:
   - 检查 `PlatformAccount.tokenExpiry`
   - 如果过期，标记需要重新授权

3. **发布内容**:
   - 调用 `WeiboAdapter.publish(token, content)`
   - 根据内容类型选择接口（update/upload/upload_url_text）

4. **保存结果**:
   - 更新 `ContentPlatform` 记录
   - 保存 `platformContentId` 和 `publishedUrl`

## Validation Rules

### Token 验证

1. **Token 格式**: 必须是有效的字符串
2. **Token 过期**: 检查 `tokenExpiry`，如果过期则无效
3. **Token 有效性**: 调用 `oauth2/get_token_info` 验证（可选）

### 内容验证

1. **文字长度**: 
   - 纯文字：≤2000字
   - 分享链接：≤140字且必须包含 URL
2. **图片数量**: ≤9张
3. **图片大小**: 每张<5M
4. **图片格式**: 仅支持 JPEG、GIF、PNG
5. **敏感词**: 需要调用内容安全接口（可选）

## Edge Cases Handling

1. **Token 过期**: 标记账号需要重新授权，不重试发布
2. **频率限制**: 延迟重试，返回友好错误提示
3. **内容不符合要求**: 返回具体错误信息，不重试
4. **网络错误**: 重试3次，使用指数退避
5. **用户取消授权**: 检测 token 失效，标记账号断开

## Dependencies

- **PlatformAccount**: `prisma/schema.prisma`
- **ContentPlatform**: `prisma/schema.prisma`
- **Platform enum**: `types/platform.types.ts`
- **PublishService**: `lib/services/publish.service.ts`
- **WeiboAdapter**: `lib/platforms/weibo/weibo-adapter.ts` (待创建)
- **WeiboClient**: `lib/platforms/weibo/weibo-client.ts` (待创建)

## 新增类型定义

需要在 `lib/platforms/weibo/weibo-types.ts` 中定义：

- `WeiboTokenInfo`
- `WeiboUserInfo`
- `WeiboPublishResult`
- `WeiboError`
- `WeiboConfig`
- `WeiboAuthConfig`
