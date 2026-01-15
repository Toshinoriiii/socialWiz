# Data Model: 微信公众号平台接入

**Feature**: 005-wechat-integration  
**Date**: 2026-01-15

## Overview

微信公众号平台接入功能主要使用现有的 `PlatformAccount` 数据模型，扩展微信公众号特定的字段和状态管理。同时需要实现微信公众号适配器相关的类型定义和状态管理。

## Entities

### PlatformAccount (平台账号)

**位置**: `prisma/schema.prisma` (已存在)

**描述**: 存储用户连接的微信公众号账号信息

**字段**:
- `id: string` - 平台账号 ID（UUID）
- `userId: string` - 用户 ID（关联 User）
- `platform: Platform` - 平台类型（WECHAT）
- `platformUserId: string` - 微信公众号用户 ID（openid）
- `platformUsername: string` - 微信公众号名称（nickname）
- `accessToken: string` - 访问令牌（加密存储）
- `refreshToken: string?` - 刷新令牌（如果微信支持）
- `tokenExpiry: DateTime?` - Token 过期时间
- `isConnected: boolean` - 是否已连接（默认 true）
- `createdAt: DateTime` - 创建时间
- `updatedAt: DateTime` - 更新时间

**验证规则**:
- `userId` 和 `platform` 组合必须唯一（一个用户只能连接一个微信公众号账号）
- `accessToken` 必须加密存储
- `tokenExpiry` 必须设置（需要调研微信 Token 有效期）

**状态转换**:
- `未连接` → `已连接`: 用户完成 OAuth 授权，保存 access_token
- `已连接` → `需要重新授权`: token 过期或失效，标记 isConnected = false
- `需要重新授权` → `已连接`: 用户重新授权，更新 token

### WechatTokenInfo (微信公众号 Token 信息)

**类型**: TypeScript 接口（临时数据结构）

**位置**: `lib/platforms/wechat/wechat-types.ts`

**描述**: 微信公众号 OAuth 返回的 Token 信息

**字段**:
```typescript
interface WechatTokenInfo {
  access_token: string
  expires_in: number // 过期时间（秒）
  refresh_token?: string // 如果微信支持
  openid: string // 微信公众号用户 ID
  scope?: string // 授权范围
}
```

**转换逻辑**:
- `expires_in` → `tokenExpiry`: `new Date(Date.now() + expires_in * 1000)`
- `openid` → `platformUserId`
- 需要调用用户信息接口获取 `nickname` → `platformUsername`

### WechatUserInfo (微信公众号用户信息)

**类型**: TypeScript 接口（临时数据结构）

**位置**: `lib/platforms/wechat/wechat-types.ts`

**描述**: 微信公众号用户信息（从 API 获取）

**字段**:
```typescript
interface WechatUserInfo {
  openid: string // 用户唯一标识
  nickname: string // 用户昵称
  headimgurl?: string // 头像 URL
  sex?: number // 性别（1-男，2-女，0-未知）
  city?: string // 城市
  province?: string // 省份
  country?: string // 国家
  unionid?: string // 用户统一标识（如果存在）
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
  images?: string[] // 图片 URL 数组（需要确认最多支持多少张）
  video?: string // 视频 URL（可选）
  url?: string // 分享链接（可选）
}
```

**微信公众号特定限制** (需要实际验证):
- `text`: 需要确认具体限制（可能支持较长文本）
- `images`: 需要确认最多支持多少张，每张大小限制
- `video`: 需要确认视频格式和大小限制
- 富文本支持：需要确认是否支持 HTML 格式

### PublishResult (发布结果)

**类型**: TypeScript 接口

**位置**: `lib/platforms/wechat/wechat-types.ts`

**描述**: 微信公众号发布 API 返回的结果

**字段**:
```typescript
interface PublishResult {
  success: boolean
  platformPostId?: string // 微信公众号消息 ID（msg_id）
  publishedUrl?: string // 发布链接（如果可用）
  error?: string // 错误信息
  errorCode?: string // 微信错误码
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
- `platformContentId: string?` - 平台内容 ID（微信公众号消息 ID）
- `publishStatus: PublishStatus` - 发布状态（PENDING/SUCCESS/FAILED）
- `errorMessage: string?` - 错误信息
- `publishedUrl: string?` - 发布链接
- `createdAt: DateTime` - 创建时间

**状态转换**:
- `PENDING` → `SUCCESS`: 发布成功，保存 platformContentId 和 publishedUrl
- `PENDING` → `FAILED`: 发布失败，保存 errorMessage
- `SUCCESS` → `FAILED`: 发布后检测到错误（如内容被删除）

## Type Definitions

### WechatAdapter Types

**位置**: `lib/platforms/wechat/wechat-types.ts`

```typescript
// 微信公众号 API 响应类型
interface WechatApiResponse<T = any> {
  errcode?: number // 错误码，0 表示成功
  errmsg?: string // 错误信息
  data?: T // 响应数据
}

// 微信公众号错误类型
enum WechatErrorCode {
  INVALID_TOKEN = 40001, // access_token 无效
  TOKEN_EXPIRED = 40014, // access_token 过期
  FREQUENCY_LIMIT = 45009, // 频率限制
  CONTENT_ILLEGAL = 87014, // 内容违规
  // 需要补充完整的错误码列表
}

// 微信公众号内容验证结果
interface WechatValidationResult {
  valid: boolean
  errors: string[]
  warnings?: string[]
}
```

## Validation Rules

### Content Validation

**位置**: `lib/platforms/wechat/wechat-utils.ts`

**验证规则** (需要实际验证):
- 文字长度：需要确认具体限制
- 图片数量：需要确认最多支持多少张
- 图片大小：需要确认大小限制（如 <2M）
- 图片格式：需要确认支持的格式（JPEG、PNG、GIF等）
- 视频限制：需要确认视频格式和大小限制
- 敏感词：需要确认是否有内容安全接口

**实现**:
```typescript
function validateWechatContent(content: PublishContent): WechatValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // 文字长度验证（需要确认具体限制）
  if (content.text.length > MAX_TEXT_LENGTH) {
    errors.push(`文字内容超过限制（${MAX_TEXT_LENGTH}字）`)
  }
  
  // 图片数量验证（需要确认具体限制）
  if (content.images && content.images.length > MAX_IMAGES) {
    errors.push(`图片数量超过限制（最多${MAX_IMAGES}张）`)
  }
  
  // 图片大小验证（需要确认具体限制）
  // 需要实际下载图片检查大小
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}
```

## State Management

### Token State

**位置**: `lib/platforms/wechat/wechat-adapter.ts`

**状态**:
- `VALID`: Token 有效
- `EXPIRED`: Token 过期
- `INVALID`: Token 无效
- `REFRESHING`: 正在刷新 Token

**状态转换**:
- `VALID` → `EXPIRED`: Token 过期时间到达
- `EXPIRED` → `REFRESHING`: 尝试刷新 Token（如果支持）
- `REFRESHING` → `VALID`: 刷新成功
- `REFRESHING` → `INVALID`: 刷新失败
- `INVALID` → `VALID`: 用户重新授权

### Account State

**位置**: `PlatformAccount.isConnected`

**状态**:
- `true`: 账号已连接，可以发布内容
- `false`: 账号需要重新授权

**状态转换**:
- `true` → `false`: Token 过期或失效
- `false` → `true`: 用户重新授权成功

## Data Flow

### OAuth Flow

1. **用户发起授权**:
   - 前端调用 `GET /api/platforms/wechat/auth`
   - 后端生成授权 URL 和 state
   - 前端跳转到微信授权页面

2. **微信回调**:
   - 微信回调 `GET /api/platforms/wechat/auth/callback?code=xxx&state=xxx`
   - 后端验证 state
   - 后端调用微信 API 交换 code 获取 token
   - 后端调用微信 API 获取用户信息
   - 后端保存到 `PlatformAccount`

3. **完成授权**:
   - 重定向到设置页面
   - 显示连接成功状态

### Publish Flow

1. **用户发布内容**:
   - 前端调用 `POST /api/platforms/wechat/{platformAccountId}/publish`
   - 后端验证内容（调用 `validateContent`）
   - 后端检查 Token 是否过期
   - 后端调用微信 API 发布内容

2. **保存结果**:
   - 创建 `ContentPlatform` 记录
   - 保存 `platformContentId` 和 `publishedUrl`
   - 更新 `publishStatus`

3. **错误处理**:
   - Token 过期：标记账号需要重新授权
   - 内容错误：返回错误信息
   - 频率限制：延迟重试
   - 网络错误：重试（最多3次）

## Database Schema

### PlatformAccount (已存在)

```prisma
model PlatformAccount {
  id               String    @id @default(uuid())
  userId           String
  platform         Platform  // WECHAT
  platformUserId   String    // openid
  platformUsername String    // nickname
  accessToken      String    // 加密存储
  refreshToken     String?   // 如果微信支持
  tokenExpiry      DateTime?
  isConnected      Boolean   @default(true)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  
  user             User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  contentPlatforms ContentPlatform[]
  
  @@unique([userId, platform])
  @@index([userId])
}
```

### ContentPlatform (已存在)

```prisma
model ContentPlatform {
  id                String        @id @default(uuid())
  contentId         String
  platformAccountId String
  platformContentId String?       // 微信公众号消息 ID
  publishStatus     PublishStatus @default(PENDING)
  errorMessage      String?
  publishedUrl      String?
  createdAt         DateTime      @default(now())
  
  content         Content         @relation(fields: [contentId], references: [id], onDelete: Cascade)
  platformAccount PlatformAccount @relation(fields: [platformAccountId], references: [id], onDelete: Cascade)
  
  @@index([contentId])
  @@index([platformAccountId])
}
```

## Migration Notes

### 无需数据库迁移

微信公众号平台接入使用现有的 `PlatformAccount` 和 `ContentPlatform` 表，无需创建新的数据库表。只需要：

1. 确保 `Platform` 枚举包含 `WECHAT`（已存在）
2. 确保字段足够存储微信公众号相关信息（已满足）

### 数据迁移（如果需要）

如果已有测试数据需要迁移：
- 无需特殊迁移逻辑
- 新连接的账号会自动使用新的字段结构
