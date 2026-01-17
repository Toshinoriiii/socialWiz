# Research: 微信公众号平台接入技术调研

**Feature**: 005-wechat-integration  
**Date**: 2026-01-17  
**Status**: ✅ Complete

## Overview

本文档记录微信公众号平台接入功能的技术调研结果，包括Token管理、API规范、加密方案、中间件设计和测试策略。

## 1. Token管理最佳实践

### 1.1 Redis缓存策略

**Decision**: 使用Redis存储access_token，采用以下策略

**Key设计**:
```
wechat:token:{userId}:{configId}
```

**理由**:
- `userId`: 确保用户间数据隔离
- `configId`: 支持同一用户配置多个公众号
- 前缀`wechat:token:`: 命名空间隔离，避免与其他缓存key冲突

**Value结构** (JSON):
```json
{
  "accessToken": "string",
  "expiresAt": 1234567890000,
  "appId": "string",
  "userId": "string",
  "configId": "string",
  "createdAt": 1234567890000
}
```

**TTL设置**: 7000秒
- 微信token有效期为7200秒
- 提前200秒过期，预留刷新时间
- 避免临界时间获取token失败

**Alternatives considered**:
- ❌ 仅使用`appId`作为key：无法支持多用户场景，不同用户可能使用相同appId
- ❌ 存储在数据库：读写性能差，增加数据库负担
- ❌ 不设置TTL：可能导致过期token仍被使用

### 1.2 分布式锁实现

**Decision**: 使用Redis SETNX + 过期时间实现简单分布式锁

**Lock Key**:
```
wechat:lock:{userId}:{configId}
```

**实现方案**:
```typescript
async function acquireLock(key: string, ttl: number = 30000): Promise<boolean> {
  const lockValue = `${Date.now()}-${Math.random()}`
  const result = await redis.set(key, lockValue, {
    NX: true,  // Only set if not exists
    PX: ttl    // Expire after ttl milliseconds
  })
  return result === 'OK'
}

async function releaseLock(key: string): Promise<void> {
  await redis.del(key)
}
```

**参数**:
- TTL: 30秒（足够完成token获取操作）
- 锁持有者ID: `${timestamp}-${random}` 用于调试

**Rationale**:
- 简单可靠，无需Redlock等复杂算法
- 自动过期机制防止死锁
- 性能开销小

**Alternatives considered**:
- ❌ Redlock算法：过于复杂，单Redis实例无需使用
- ❌ 数据库锁：性能差，增加数据库负担
- ❌ 无锁设计：会导致并发获取token，之前的token失效

### 1.3 Token提前刷新策略

**Decision**: 剩余有效期 < 300秒时主动刷新

**刷新时机计算**:
```typescript
function shouldRefreshToken(expiresAt: number): boolean {
  const now = Date.now()
  const remainingMs = expiresAt - now
  const REFRESH_THRESHOLD = 300 * 1000 // 5 minutes
  return remainingMs < REFRESH_THRESHOLD
}
```

**流程**:
1. API调用前检查Redis中的`expiresAt`
2. 如果剩余时间 < 300秒，获取分布式锁
3. 获取锁成功：调用微信API刷新token，更新Redis
4. 获取锁失败：等待其他请求刷新完成，读取新token

**Rationale**:
- 提前5分钟刷新，避免临界时间调用失败
- 使用分布式锁避免并发刷新导致token失效
- 微信官方建议提前刷新token

**Alternatives considered**:
- ❌ 被动刷新（token过期后再刷新）：会导致API调用失败，用户体验差
- ❌ 定时任务刷新：复杂度高，需要维护定时任务
- ❌ 更短阈值（如1分钟）：可能导致频繁刷新
- ❌ 更长阈值（如10分钟）：浪费token有效期

## 2. 微信公众号API调研

### 2.1 Token获取接口

**接口**: `GET https://api.weixin.qq.com/cgi-bin/token`

**请求参数**:
| 参数 | 必选 | 说明 |
|------|------|------|
| grant_type | 是 | 固定值：client_credential |
| appid | 是 | 公众号的AppID |
| secret | 是 | 公众号的AppSecret |

**响应示例**:
```json
{
  "access_token": "58_xxxxxxxxxxxxxxxxxxxxx",
  "expires_in": 7200
}
```

**错误码**:
| 错误码 | 说明 | 处理方式 |
|--------|------|----------|
| 40001 | AppSecret错误 | 提示用户检查配置 |
| 40164 | IP白名单未配置 | 显示当前IP和配置指引 |
| 89503 | 请求过于频繁 | 延迟重试 |

**注意事项**:
- Token有效期7200秒（2小时）
- 同一AppID的token是唯一的，重复获取会导致之前的token失效
- 建议使用中控服务器统一管理token

### 2.2 草稿创建接口

**接口**: `POST https://api.weixin.qq.com/cgi-bin/draft/add?access_token=ACCESS_TOKEN`

**请求体**:
```json
{
  "articles": [
    {
      "title": "标题",
      "author": "作者",
      "digest": "摘要",
      "content": "内容（HTML格式）",
      "content_source_url": "原文链接",
      "thumb_media_id": "封面图片media_id"
    }
  ]
}
```

**重要**:
- `thumb_media_id`: 必需字段，需先上传图片获取media_id
- 本次迭代仅支持纯文字，图片功能后续实现

**错误码**:
| 错误码 | 说明 | 处理方式 |
|--------|------|----------|
| 40001 | access_token失效 | 自动刷新token |
| 40007 | media_id无效 | 提示上传有效图片 |
| 48001 | 无权限（个人主体） | 阻止发布并提示 |
| 87014 | 内容违规 | 友好提示用户修改内容 |

### 2.3 IP白名单配置

**位置**: 微信公众平台 → 开发 → 基本配置 → IP白名单

**要求**:
- 必须配置服务器的**公网IP地址**
- 不能使用域名
- 支持配置多个IP（换行分隔）

**获取服务器IP**:
```typescript
// 方法1：通过外部API获取
const response = await fetch('https://api.ipify.org?format=json')
const { ip } = await response.json()

// 方法2：从环境变量读取
const serverIp = process.env.SERVER_PUBLIC_IP
```

**配置指引**:
1. 登录微信公众平台
2. 进入"开发" → "基本配置"
3. 找到"IP白名单"，点击"修改"
4. 添加服务器公网IP（如：123.456.789.012）
5. 保存并生效

## 3. 加密存储方案

### 3.1 加密算法选择

**Decision**: AES-256-GCM加密AppSecret

**理由**:
- 对称加密，性能高（vs 非对称加密）
- 支持认证加密（AEAD），防止篡改
- 业界标准，Node.js crypto模块原生支持

**实现**:
```typescript
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const KEY_LENGTH = 32

function encrypt(text: string, masterKey: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH)
  const key = crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha512')
  const iv = crypto.randomBytes(IV_LENGTH)
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const tag = cipher.getAuthTag()
  
  // Format: salt:iv:encrypted:tag
  return `${salt.toString('hex')}:${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`
}

function decrypt(encryptedData: string, masterKey: string): string {
  const parts = encryptedData.split(':')
  const salt = Buffer.from(parts[0], 'hex')
  const iv = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]
  const tag = Buffer.from(parts[3], 'hex')
  
  const key = crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha512')
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}
```

**Alternatives considered**:
- ❌ bcrypt: 用于密码哈希，不可逆，无法解密
- ❌ AES-256-CBC: 无认证功能，可能被篡改
- ❌ RSA: 非对称加密，性能开销大，密钥管理复杂

### 3.2 加密密钥管理

**Decision**: 环境变量存储主密钥

**配置**:
```bash
# .env
ENCRYPTION_KEY="your-32-character-hex-key-here"
```

**生成密钥**:
```typescript
// 一次性生成（不要提交到代码仓库）
const key = crypto.randomBytes(32).toString('hex')
console.log(key)
```

**Rationale**:
- 简单可行，适合小型项目
- 密钥不在代码中硬编码
- 不同环境可使用不同密钥

**Alternatives considered**:
- ❌ KMS (Key Management Service): 过于复杂，成本高
- ❌ 硬编码: 严重安全风险
- ❌ 配置文件: 容易误提交到代码仓库

### 3.3 性能考虑

**加密/解密性能**:
- AES-256-GCM加密1KB数据: ~0.1ms
- 对AppSecret（约32字节）加密: <0.05ms
- 性能开销可忽略不计

**缓存策略**:
- 解密后的AppSecret临时存储在内存（使用WeakMap）
- 避免重复解密操作
- 进程重启后自动清理

## 4. API中间件设计

### 4.1 中间件实现方案

**Decision**: 使用高阶函数（HOF）封装API路由

**实现**:
```typescript
// lib/middleware/wechat-token-middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { WechatTokenService } from '@/lib/services/wechat-token.service'

export function withWechatToken(
  handler: (req: NextRequest, token: string) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    try {
      const userId = req.headers.get('x-user-id') // 从JWT中提取
      const configId = req.nextUrl.searchParams.get('configId')
      
      if (!userId || !configId) {
        return NextResponse.json({ error: 'Missing userId or configId' }, { status: 400 })
      }
      
      const tokenService = new WechatTokenService()
      const token = await tokenService.getValidToken(userId, configId)
      
      // 调用实际的handler，注入token
      return await handler(req, token)
    } catch (error) {
      console.error('Token middleware error:', error)
      return NextResponse.json(
        { error: 'Failed to get access token', details: error.message },
        { status: 500 }
      )
    }
  }
}
```

**使用示例**:
```typescript
// app/api/wechat/publish/route.ts
import { withWechatToken } from '@/lib/middleware/wechat-token-middleware'

export const POST = withWechatToken(async (req, token) => {
  const body = await req.json()
  
  // 使用注入的token调用微信API
  const result = await fetch('https://api.weixin.qq.com/cgi-bin/draft/add?access_token=' + token, {
    method: 'POST',
    body: JSON.stringify(body)
  })
  
  return NextResponse.json(await result.json())
})
```

**Rationale**:
- 透明代理：前端无需关心token管理
- 职责单一：中间件只负责token注入
- 易于测试：可以mock tokenService
- 可复用：其他微信API端点可共用

**Alternatives considered**:
- ❌ Next.js Middleware (middleware.ts): 无法访问数据库和Redis，功能受限
- ❌ 在每个API路由中手动获取token: 代码重复，难以维护
- ❌ 前端传递token: 不安全，前端无法获取token

### 4.2 错误处理策略

**Token获取失败场景**:
| 场景 | HTTP状态码 | 响应 |
|------|-----------|------|
| 配置不存在 | 404 | `{ error: 'Wechat config not found' }` |
| AppSecret解密失败 | 500 | `{ error: 'Failed to decrypt secret' }` |
| 微信API调用失败 | 502 | `{ error: 'Wechat API error', wechatErrorCode: 40001 }` |
| 分布式锁获取超时 | 503 | `{ error: 'Token refresh in progress, retry later' }` |

**重试策略**:
- 网络错误：重试3次，指数退避（1s, 2s, 4s）
- 微信API错误：根据错误码决定是否重试
  - 40001 (token失效): 不重试，直接刷新token
  - 89503 (频率限制): 延迟重试
  - 其他错误: 不重试，直接返回

### 4.3 日志和监控

**日志记录**:
```typescript
// 成功获取token
logger.info('Token acquired', {
  userId,
  configId,
  expiresAt,
  fromCache: true/false
})

// Token刷新
logger.info('Token refreshed', {
  userId,
  configId,
  oldExpiresAt,
  newExpiresAt
})

// 错误
logger.error('Token acquisition failed', {
  userId,
  configId,
  error: error.message,
  wechatErrorCode: 40001
})
```

**监控指标**:
- Token获取成功率
- Token刷新频率
- 分布式锁等待时间
- 微信API调用延迟

## 5. 测试策略

### 5.1 单元测试

**WechatTokenService测试**:
```typescript
describe('WechatTokenService', () => {
  it('should get token from cache if valid', async () => {
    // Mock Redis返回有效token
    // 验证不调用微信API
  })
  
  it('should refresh token if expiring soon', async () => {
    // Mock Redis返回即将过期的token
    // 验证调用微信API刷新
  })
  
  it('should use distributed lock for concurrent requests', async () => {
    // 模拟并发请求
    // 验证只有一个请求获取锁
  })
  
  it('should handle wechat API errors', async () => {
    // Mock微信API返回错误
    // 验证错误处理逻辑
  })
})
```

**WechatConfigService测试**:
```typescript
describe('WechatConfigService', () => {
  it('should encrypt appSecret when saving', async () => {
    // 验证保存时加密
  })
  
  it('should decrypt appSecret when reading', async () => {
    // 验证读取时解密
  })
  
  it('should validate config by calling wechat API', async () => {
    // Mock微信API验证
  })
})
```

### 5.2 集成测试

**配置管理API测试**:
```typescript
describe('POST /api/wechat/config', () => {
  it('should create config and validate with wechat', async () => {
    // 发送POST请求
    // 验证数据库保存
    // 验证Redis无缓存（新配置）
  })
  
  it('should return 403 if user tries to access another user config', async () => {
    // 验证权限控制
  })
})
```

**发布API测试**:
```typescript
describe('POST /api/wechat/publish', () => {
  it('should publish content with valid token', async () => {
    // Mock token service
    // Mock微信API
    // 验证发布成功
  })
  
  it('should auto-refresh token if expiring', async () => {
    // Mock即将过期的token
    // 验证自动刷新
  })
})
```

### 5.3 Mock策略

**微信API Mock**:
```typescript
// tests/mocks/wechat-api.mock.ts
export function mockWechatTokenApi(success: boolean) {
  if (success) {
    return {
      access_token: 'mock_token_12345',
      expires_in: 7200
    }
  } else {
    return {
      errcode: 40001,
      errmsg: 'invalid appid'
    }
  }
}

export function mockWechatPublishApi(success: boolean) {
  if (success) {
    return {
      media_id: 'mock_media_id',
      url: 'https://mp.weixin.qq.com/s/mock'
    }
  } else {
    return {
      errcode: 48001,
      errmsg: 'api unauthorized'
    }
  }
}
```

### 5.4 测试覆盖率目标

- **Services**: > 90% (核心业务逻辑)
- **API Routes**: > 80% (主要场景覆盖)
- **Utils**: > 95% (工具函数应充分测试)
- **Overall**: > 80%

## 6. 技术栈确认

基于调研结果，确认以下技术选型：

**后端**:
- Next.js 14 App Router (API Routes)
- TypeScript 5.9+
- Prisma ORM (PostgreSQL)
- Redis (ioredis)
- Node.js crypto (加密)

**前端**:
- React 18+
- Next.js 14 (Server Components + Client Components)
- React Hook Form + Zod (表单验证)
- Tailwind CSS (样式)

**测试**:
- Jest (测试框架)
- @testing-library/react (React测试)
- supertest (API测试，可选)

**工具**:
- ESLint + Prettier (代码规范)
- TypeScript Compiler (类型检查)

## 7. 风险评估

| 风险 | 影响 | 概率 | 缓解措施 | 优先级 |
|------|------|------|----------|--------|
| Token频繁失效 | 高 | 中 | 分布式锁 + 提前刷新 | P0 |
| IP白名单配置错误 | 高 | 高 | 详细配置指引 + 错误提示 | P0 |
| AppSecret泄露 | 高 | 低 | 加密存储 + 权限控制 | P0 |
| 微信API限流 | 中 | 低 | 重试机制 + 延迟策略 | P1 |
| 并发竞争 | 中 | 中 | 分布式锁 | P0 |
| 加密性能问题 | 低 | 低 | 缓存解密结果 | P2 |

## 8. 性能基准

基于调研和经验估算：

| 操作 | 预期耗时 |
|------|----------|
| Token获取（首次） | 500-800ms |
| Token获取（缓存） | 5-10ms |
| Token刷新 | 500-800ms |
| 配置验证 | 600-1000ms |
| 内容发布 | 1000-2000ms |
| 加密/解密AppSecret | <1ms |
| 分布式锁获取 | 1-5ms |

## Summary

所有技术调研已完成，关键决策如下：

1. **Token管理**: Redis缓存 + 分布式锁 + 提前300秒刷新策略
2. **加密方案**: AES-256-GCM加密AppSecret，主密钥存储在环境变量
3. **中间件设计**: 高阶函数封装API路由，透明注入token
4. **测试策略**: Jest + Mock微信API + 80%覆盖率目标
5. **错误处理**: 友好提示 + 重试机制 + 详细日志

**Status**: ✅ Research Complete  
**Ready for**: Phase 1 Design (data-model.md, contracts/, quickstart.md)
