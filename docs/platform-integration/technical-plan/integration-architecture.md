# 多平台集成技术架构方案

**文档版本**: 1.0  
**创建日期**: 2025-01-05  
**基于**: 平台API对比分析结果

## 1. 架构概述

### 1.1 设计目标

- **统一接口**: 为上层应用提供统一的多平台API接口
- **平台解耦**: 屏蔽各平台API差异，便于扩展新平台
- **高可用性**: 实现错误处理、重试、降级等机制
- **可维护性**: 清晰的架构分层，便于维护和测试

### 1.2 架构原则

- **适配器模式**: 每个平台实现独立的适配器
- **接口隔离**: 定义清晰的接口规范
- **依赖倒置**: 上层依赖抽象接口，不依赖具体实现
- **单一职责**: 每个组件只负责一个功能

---

## 2. 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                   应用层 (Application Layer)             │
│  (Next.js Pages, API Routes, UI Components)            │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              统一接口层 (Unified API Layer)             │
│  - PlatformService (平台管理)                          │
│  - AuthService (认证管理)                              │
│  - PublishService (内容发布)                           │
│  - DataService (数据获取)                              │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│             适配器层 (Adapter Layer)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ WeiboAdapter │  │TwitterAdapter│  │ThreadsAdapter│ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│           平台API层 (Platform API Layer)                │
│  - OAuth Client (认证客户端)                           │
│  - HTTP Client (HTTP客户端)                            │
│  - Rate Limiter (频率限制器)                            │
│  - Error Handler (错误处理器)                          │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 核心组件设计

### 3.1 统一接口层

#### 3.1.1 PlatformService

**职责**: 平台账号管理、平台信息查询

**接口**:
```typescript
interface PlatformService {
  // 获取用户绑定的平台列表
  getPlatformAccounts(userId: string): Promise<PlatformAccount[]>
  
  // 获取平台信息
  getPlatformInfo(platform: PlatformType): Promise<PlatformInfo>
  
  // 断开平台连接
  disconnectPlatform(platformId: string): Promise<void>
}
```

#### 3.1.2 AuthService

**职责**: 统一OAuth认证流程管理

**接口**:
```typescript
interface AuthService {
  // 获取授权URL
  getAuthUrl(platform: PlatformType, redirectUri: string): Promise<AuthUrl>
  
  // 处理OAuth回调
  handleCallback(
    platform: PlatformType,
    code: string,
    state: string
  ): Promise<PlatformAccount>
  
  // 刷新Token
  refreshToken(platformId: string): Promise<TokenInfo>
  
  // 撤销授权
  revokeToken(platformId: string): Promise<void>
}
```

#### 3.1.3 PublishService

**职责**: 统一内容发布接口

**接口**:
```typescript
interface PublishService {
  // 发布内容
  publish(
    platformId: string,
    content: PublishContent
  ): Promise<PublishResult>
  
  // 批量发布
  publishBatch(
    platformIds: string[],
    content: PublishContent
  ): Promise<PublishResult[]>
  
  // 验证内容
  validateContent(
    platform: PlatformType,
    content: PublishContent
  ): Promise<ValidationResult>
}
```

#### 3.1.4 DataService

**职责**: 统一数据获取接口

**接口**:
```typescript
interface DataService {
  // 获取用户信息
  getUserInfo(platformId: string): Promise<UserInfo>
  
  // 获取内容数据
  getContentData(
    platformId: string,
    options: DataQueryOptions
  ): Promise<ContentData[]>
  
  // 获取统计数据
  getStatistics(
    platformId: string,
    dateRange: DateRange
  ): Promise<Statistics>
}
```

### 3.2 适配器层

#### 3.2.1 PlatformAdapter 接口

**职责**: 定义平台适配器统一接口

```typescript
interface PlatformAdapter {
  // 平台标识
  readonly platform: PlatformType
  
  // 获取授权URL
  getAuthUrl(config: AuthConfig): Promise<string>
  
  // 交换Token
  exchangeToken(code: string, config: AuthConfig): Promise<TokenInfo>
  
  // 刷新Token
  refreshToken(refreshToken: string): Promise<TokenInfo>
  
  // 发布内容
  publish(token: string, content: PublishContent): Promise<PublishResult>
  
  // 获取用户信息
  getUserInfo(token: string): Promise<UserInfo>
  
  // 获取内容数据
  getContentData(token: string, options: DataQueryOptions): Promise<ContentData[]>
  
  // 验证内容
  validateContent(content: PublishContent): ValidationResult
}
```

#### 3.2.2 WeiboAdapter 实现

**职责**: 微博平台适配器实现

**关键实现**:
- 实现OAuth 2.0授权流程
- 处理微博特定的API调用格式
- 适配微博的内容限制（140字、图片格式等）
- 处理微博的频率限制

**示例**:
```typescript
class WeiboAdapter implements PlatformAdapter {
  readonly platform = 'weibo'
  
  async publish(token: string, content: PublishContent): Promise<PublishResult> {
    // 1. 验证内容是否符合微博限制
    const validation = this.validateContent(content)
    if (!validation.valid) {
      throw new ValidationError(validation.errors)
    }
    
    // 2. 转换内容格式（如：添加URL、处理图片等）
    const weiboContent = this.transformContent(content)
    
    // 3. 调用微博API
    const response = await this.apiClient.post('/statuses/share.json', {
      access_token: token,
      status: weiboContent.text,
      pic: weiboContent.image,
      rip: this.getClientIP()
    })
    
    // 4. 转换响应格式
    return this.transformResponse(response)
  }
}
```

### 3.3 平台API层

#### 3.3.1 OAuth Client

**职责**: 统一OAuth客户端实现

```typescript
class OAuthClient {
  // 生成授权URL
  generateAuthUrl(config: OAuthConfig): string
  
  // 交换授权码
  async exchangeCode(code: string, config: OAuthConfig): Promise<TokenInfo>
  
  // 刷新Token
  async refreshToken(refreshToken: string, config: OAuthConfig): Promise<TokenInfo>
  
  // 撤销Token
  async revokeToken(token: string, config: OAuthConfig): Promise<void>
}
```

#### 3.3.2 Rate Limiter

**职责**: 频率限制管理

```typescript
class RateLimiter {
  // 检查是否超出限制
  async checkLimit(platform: PlatformType, userId: string): Promise<boolean>
  
  // 记录调用
  async recordCall(platform: PlatformType, userId: string): Promise<void>
  
  // 获取剩余配额
  async getRemainingQuota(platform: PlatformType, userId: string): Promise<Quota>
}
```

#### 3.3.3 Error Handler

**职责**: 统一错误处理

```typescript
class ErrorHandler {
  // 转换平台错误为统一错误
  transformError(platform: PlatformType, error: any): UnifiedError
  
  // 判断是否可重试
  isRetryable(error: UnifiedError): boolean
  
  // 获取重试延迟
  getRetryDelay(error: UnifiedError, attempt: number): number
}
```

---

## 4. 统一OAuth认证流程

### 4.1 流程设计

```
用户点击"连接平台"
    ↓
1. 前端调用 GET /api/platforms/{platform}/auth
    ↓
2. 后端生成state（CSRF防护）
    ↓
3. 适配器生成平台授权URL
    ↓
4. 返回授权URL和state
    ↓
5. 前端跳转到平台授权页面
    ↓
6. 用户授权后，平台回调 GET /api/platforms/{platform}/callback?code=xxx&state=xxx
    ↓
7. 后端验证state
    ↓
8. 适配器调用平台API交换Token
    ↓
9. 存储Token和用户信息
    ↓
10. 返回授权成功
```

### 4.2 Token管理策略

#### 4.2.1 Token存储

- **存储位置**: 数据库（加密存储）
- **加密方式**: AES-256加密
- **存储字段**: 
  - `access_token` (加密)
  - `refresh_token` (加密，如果支持)
  - `expires_at` (过期时间)
  - `token_type` (Token类型)

#### 4.2.2 Token刷新

- **自动刷新**: Token过期前自动刷新
- **刷新时机**: 过期前1小时触发刷新
- **刷新策略**: 
  - 支持Refresh Token的平台：使用Refresh Token刷新
  - 不支持Refresh Token的平台：引导用户重新授权

#### 4.2.3 Token安全

- **加密存储**: 所有Token加密存储
- **传输安全**: 使用HTTPS传输
- **访问控制**: Token仅限授权用户访问
- **定期轮换**: 定期更新加密密钥

---

## 5. 错误处理和重试策略

### 5.1 错误分类

```typescript
enum ErrorType {
  // 临时错误（可重试）
  NETWORK_ERROR = 'NETWORK_ERROR',        // 网络错误
  RATE_LIMIT = 'RATE_LIMIT',              // 频率限制
  TEMPORARY_SERVER_ERROR = 'TEMPORARY_SERVER_ERROR', // 临时服务器错误
  
  // 永久错误（不可重试）
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',     // 认证错误
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',       // 授权错误
  VALIDATION_ERROR = 'VALIDATION_ERROR',              // 验证错误
  CONTENT_POLICY_ERROR = 'CONTENT_POLICY_ERROR',     // 内容政策错误
  
  // 未知错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}
```

### 5.2 重试策略

```typescript
class RetryStrategy {
  // 重试配置
  private config = {
    maxRetries: 3,
    baseDelay: 1000,  // 1秒
    maxDelay: 10000,  // 10秒
    exponentialBackoff: true
  }
  
  // 计算重试延迟
  calculateDelay(attempt: number): number {
    if (this.config.exponentialBackoff) {
      return Math.min(
        this.config.baseDelay * Math.pow(2, attempt),
        this.config.maxDelay
      )
    }
    return this.config.baseDelay
  }
  
  // 判断是否重试
  shouldRetry(error: UnifiedError, attempt: number): boolean {
    if (attempt >= this.config.maxRetries) {
      return false
    }
    
    return this.isRetryableError(error)
  }
}
```

### 5.3 降级方案

- **缓存降级**: API失败时返回缓存数据
- **延迟发布**: 发布失败时加入重试队列
- **部分成功**: 批量发布时，部分失败不影响其他平台
- **通知用户**: 失败时通知用户，提供手动重试选项

---

## 6. 内容验证和转换

### 6.1 内容验证

```typescript
class ContentValidator {
  // 验证内容是否符合平台限制
  validate(platform: PlatformType, content: PublishContent): ValidationResult {
    const rules = this.getPlatformRules(platform)
    
    // 验证文本长度
    if (content.text.length > rules.maxTextLength) {
      return {
        valid: false,
        errors: [`文本长度超过限制（最大${rules.maxTextLength}字）`]
      }
    }
    
    // 验证图片数量
    if (content.images.length > rules.maxImages) {
      return {
        valid: false,
        errors: [`图片数量超过限制（最多${rules.maxImages}张）`]
      }
    }
    
    // 验证图片格式和大小
    for (const image of content.images) {
      const imageInfo = await this.getImageInfo(image)
      if (!rules.supportedImageFormats.includes(imageInfo.format)) {
        return {
          valid: false,
          errors: [`不支持的图片格式：${imageInfo.format}`]
        }
      }
      if (imageInfo.size > rules.maxImageSize) {
        return {
          valid: false,
          errors: [`图片大小超过限制（最大${rules.maxImageSize}MB）`]
        }
      }
    }
    
    return { valid: true }
  }
}
```

### 6.2 内容转换

```typescript
class ContentTransformer {
  // 转换内容为平台格式
  transform(platform: PlatformType, content: PublishContent): PlatformContent {
    const adapter = this.getAdapter(platform)
    return adapter.transformContent(content)
  }
  
  // 自动截断文本
  truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text
    }
    return text.substring(0, maxLength - 3) + '...'
  }
  
  // 添加必需URL（如微博statuses/share）
  addRequiredUrl(text: string, url: string): string {
    if (text.includes(url)) {
      return text
    }
    return `${text} ${url}`
  }
}
```

---

## 7. 频率限制管理

### 7.1 限制跟踪

```typescript
class RateLimitTracker {
  // 跟踪调用频率
  async trackCall(platform: PlatformType, userId: string): Promise<void> {
    const key = `${platform}:${userId}`
    const count = await redis.incr(key)
    
    if (count === 1) {
      await redis.expire(key, this.getLimitWindow(platform))
    }
    
    // 检查是否超出限制
    const limit = this.getLimit(platform)
    if (count > limit) {
      throw new RateLimitError('超出频率限制')
    }
  }
  
  // 获取剩余配额
  async getRemainingQuota(platform: PlatformType, userId: string): Promise<number> {
    const key = `${platform}:${userId}`
    const count = await redis.get(key) || 0
    const limit = this.getLimit(platform)
    return Math.max(0, limit - count)
  }
}
```

### 7.2 智能调度

```typescript
class RequestScheduler {
  // 调度请求，避免超出限制
  async schedule(platform: PlatformType, request: () => Promise<any>): Promise<any> {
    const quota = await this.rateLimitTracker.getRemainingQuota(platform, userId)
    
    if (quota === 0) {
      // 延迟执行
      await this.delay(this.calculateDelay(platform))
    }
    
    return await request()
  }
}
```

---

## 8. 技术难点和风险

### 8.1 技术难点

1. **平台差异处理**
   - **难点**: 各平台API格式、限制条件不同
   - **解决方案**: 使用适配器模式，封装平台差异

2. **Token管理**
   - **难点**: 不同平台的Token有效期、刷新机制不同
   - **解决方案**: 统一Token管理接口，自动处理刷新

3. **频率限制**
   - **难点**: 不同平台的限制规则不同
   - **解决方案**: 实现统一的频率限制管理器

4. **错误处理**
   - **难点**: 不同平台的错误码格式不同
   - **解决方案**: 统一错误码映射表

### 8.2 风险评估

| 风险项 | 影响程度 | 应对措施 |
|--------|----------|----------|
| 平台API变更 | 高 | 1. 版本化适配器<br>2. 监控API变更<br>3. 及时更新 |
| Token过期 | 中 | 1. 自动刷新机制<br>2. 过期前预警<br>3. 降级处理 |
| 频率限制 | 中 | 1. 智能调度<br>2. 请求队列<br>3. 缓存策略 |
| 内容限制 | 中 | 1. 内容验证<br>2. 自动转换<br>3. 用户提示 |

---

## 9. 实施路线图

### Phase 1: 基础架构（1-2周）
- [ ] 创建项目结构
- [ ] 实现基础接口定义
- [ ] 实现OAuth客户端
- [ ] 实现错误处理框架

### Phase 2: 微博适配器（1-2周）
- [ ] 实现WeiboAdapter
- [ ] 实现OAuth流程
- [ ] 实现内容发布
- [ ] 实现数据获取
- [ ] 单元测试

### Phase 3: 统一服务层（1周）
- [ ] 实现PlatformService
- [ ] 实现AuthService
- [ ] 实现PublishService
- [ ] 实现DataService

### Phase 4: 高级功能（1-2周）
- [ ] 实现频率限制管理
- [ ] 实现内容验证和转换
- [ ] 实现错误重试机制
- [ ] 实现Token自动刷新

### Phase 5: 测试和优化（1周）
- [ ] 集成测试
- [ ] 性能优化
- [ ] 文档完善

---

## 10. 后续扩展

### 10.1 新平台接入

1. 创建新的适配器类（如`TwitterAdapter`）
2. 实现`PlatformAdapter`接口
3. 注册到适配器工厂
4. 添加平台配置

### 10.2 功能扩展

- **定时发布**: 实现任务调度系统
- **批量操作**: 支持批量发布、批量获取数据
- **数据分析**: 实现统一的数据分析接口
- **内容同步**: 实现跨平台内容同步

---

## 11. 参考资料

- [微博开放平台API文档](https://open.weibo.com/wiki/)
- [OAuth 2.0规范](https://oauth.net/2/)
- [适配器模式设计](https://refactoring.guru/design-patterns/adapter)
