# Data Model: 微信公众号平台接入

**Feature**: 005-wechat-integration  
**Date**: 2026-01-15  
**Updated**: 2026-01-17（架构变更：用户维度配置）

## Overview

微信公众号平台接入功能采用**用户维度配置**架构，每个用户配置自己的微信公众号凭证（AppID和Secret），存储在数据库中。主要涉及以下数据模型：

1. **WechatAccountConfig**: 用户的微信公众号配置（AppID、Secret）
2. **WechatAccessToken**: Access Token缓存（Redis）
3. **ContentPlatform**: 内容发布记录

**架构要点**：
- AppID 和 Secret 与用户ID绑定，存储在数据库中
- 支持同一用户配置多个微信公众号
- 每个公众号的access_token独立管理，使用Redis缓存
- 数据完全隔离，每个用户只能访问自己的配置
- 由于个人开发者限制，采用手动配置方式，不使用OAuth

## Entities

### WechatAccountConfig (微信公众号配置) - **新增**

**位置**: `prisma/schema.prisma` (需要新增)

**描述**: 存储用户的微信公众号凭证（AppID和Secret），**与用户维度绑定**

**字段**:
- `id: string` - 配置ID（UUID）
- `userId: string` - **用户ID（关联User）- 关键字段**
- `appId: string` - 公众号AppID（明文存储）
- `appSecret: string` - 公众号Secret（**加密存储**）
- `accountName: string?` - 公众号名称（用户自定义或系统获取）
- `accountType: string?` - 账号类型（订阅号/服务号/企业微信）
- `subjectType: string?` - 主体类型（个人/企业）
- `canPublish: boolean` - 是否支持发布（企业主体为true，默认false）
- `isActive: boolean` - 是否激活（默认true）
- `createdAt: DateTime` - 创建时间
- `updatedAt: DateTime` - 更新时间

**关系**:
- 属于某个用户：`user: User` (many-to-one)
- 有多个内容发布记录：`contentPlatforms: ContentPlatform[]` (one-to-many)

**验证规则**:
- `appId` 必填，不能为空
- `appSecret` 必填，必须加密存储（使用AES-256或类似算法）
- `userId` + `appId` 组合应该唯一（同一用户不能重复添加同一个公众号）

**操作**:
- 创建配置：用户手动输入AppID和Secret，系统调用`/cgi-bin/token`验证后保存
- 编辑配置：用户更新AppID或Secret
- 删除配置：级联删除关联的ContentPlatform记录，清除Redis中的token缓存
- 查询配置：用户只能查询自己的配置（通过userId过滤）

**Prisma Schema**:
```prisma
model WechatAccountConfig {
  id              String   @id @default(uuid())
  userId          String
  appId           String
  appSecret       String   // 加密存储
  accountName     String?
  accountType     String?  // subscription/service/enterprise
  subjectType     String?  // personal/enterprise
  canPublish      Boolean  @default(false)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  user             User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  contentPlatforms ContentPlatform[]
  
  @@unique([userId, appId])
  @@index([userId])
  @@map("wechat_account_configs")
}
```

---

### PlatformAccount (平台账号) - **不再使用**

**说明**: 微信公众号由于个人开发者限制，**不使用OAuth授权流程**，因此不需要`PlatformAccount`实体来存储OAuth token。

**架构区别**：
- **微博模式**：`WeiboAppConfig`（应用配置） + `PlatformAccount`（OAuth授权后token）
- **微信公众号模式**：`WechatAccountConfig`（公众号配置 + 凭证），Access Token存储在Redis中

**原因**：
1. 微信公众号采用手动配置，用户直接提供AppID和Secret
2. Access Token通过`/cgi-bin/token`接口直接获取，不需要OAuth流程
3. Access Token有效期7200秒，缓存到Redis中，到期后自动刷新
4. 一个公众号配置对应一个token，不需要存储多个平台账号

---

### WechatAccessToken (Access Token缓存) - **Redis**

**位置**: Redis缓存

**描述**: 微信公众号Access Token的缓存，有效期7200秒（2小时）

**Key 格式**:
```
wechat:token:{userId}:{configId}
```

**值结构** (JSON):
```typescript
interface WechatAccessTokenCache {
  accessToken: string      // access_token值
  expiresAt: number        // 过期时间戳（毫秒）
  appId: string            // 关联的AppID
  userId: string           // 用户ID
  configId: string         // 配置ID
  createdAt: number        // 创建时间戳
}
```

**TTL**: 7000秒（提前200秒过期，预留刷新时间）

**操作**:
- **获取Token**: 检查Redis缓存，如果存在且未过期则直接返回
- **刷新Token**: 当剩余有效期<300秒时，调用`/cgi-bin/token`重新获取，更新缓存
- **删除Token**: 当用户删除配置或配置失效时，清除对应的Redis缓存
- **并发控制**: 使用分布式锁（`wechat:lock:{userId}:{configId}`）防止并发获取token

**使用场景**:
1. 用户发布内容时，先检查对应公众号的token缓存
2. 如果token不存在或即将过期，则使用分布式锁获取新token
3. token获取成功后，缓存到Redis并设置TTL
4. 多个并发请求可以共享同一个token，避免重复获取

**注意事项**:
- 同一个公众号的access_token是唯一的，重复获取会导致之fore的token失效
- 必须使用分布式锁确保同一时间只有一个请求获取token
- 每个用户的每个公众号配置都有独立的token缓存
- Token刷新建议提前5分钟进行，避免临界时间调用失败

---

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

**位置**: `prisma/schema.prisma` (已存在，需要扩展)

**描述**: 内容发布到平台的记录

**字段**:
- `id: string` - 记录 ID
- `contentId: string` - 内容 ID
- `wechatConfigId: string?` - **关联的微信公众号配置ID（外键到WechatAccountConfig）- 新增字段**
- `platformAccountId: string?` - 平台账号ID（用于其他平台）
- `platformContentId: string?` - 平台内容 ID（微信公众号消息 ID）
- `publishStatus: PublishStatus` - 发布状态（PENDING/SUCCESS/FAILED）
- `errorMessage: string?` - 错误信息
- `publishedUrl: string?` - 发布链接
- `createdAt: DateTime` - 创建时间

**关系**:
- 关联到内容：`content: Content` (many-to-one)
- **关联到微信公众号配置：`wechatConfig: WechatAccountConfig` (many-to-one) - 新增**
- 关联到其他平台账号：`platformAccount: PlatformAccount` (many-to-one, optional)

**状态转换**:
- `PENDING` → `SUCCESS`: 发布成功，保存 platformContentId 和 publishedUrl
- `PENDING` → `FAILED`: 发布失败，保存 errorMessage
- `SUCCESS` → `FAILED`: 发布后检测到错误（如内容被删除）

**Prisma Schema 更新**:
```prisma
model ContentPlatform {
  id                String        @id @default(uuid())
  contentId         String
  platformAccountId String?       // 用于其他平台（如微博）
  wechatConfigId    String?       // 新增：用于微信公众号
  platformContentId String?       // 微信公众号消息 ID
  publishStatus     PublishStatus @default(PENDING)
  errorMessage      String?
  publishedUrl      String?
  createdAt         DateTime      @default(now())
  
  content           Content              @relation(fields: [contentId], references: [id], onDelete: Cascade)
  platformAccount   PlatformAccount?     @relation(fields: [platformAccountId], references: [id], onDelete: Cascade)
  wechatConfig      WechatAccountConfig? @relation(fields: [wechatConfigId], references: [id], onDelete: Cascade)
  
  @@index([contentId])
  @@index([platformAccountId])
  @@index([wechatConfigId])
  @@map("content_platforms")
}
```

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
