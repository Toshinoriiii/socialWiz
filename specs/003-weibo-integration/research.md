# Research: 微博平台接入实现方案

**Feature**: 003-weibo-integration  
**Date**: 2025-01-13

## Research Questions

### 1. 平台适配器接口定义

**Decision**: 使用文档中定义的 `PlatformAdapter` 接口，在 `lib/platforms/base/platform-adapter.ts` 中实现基础接口定义

**Rationale**: 
- 已有技术架构文档定义了统一的 `PlatformAdapter` 接口
- 遵循 Platform Agnostic Design 原则，确保所有平台适配器实现统一接口
- 便于后续扩展其他平台（Twitter、Threads 等）

**接口定义**:
```typescript
interface PlatformAdapter {
  readonly platform: PlatformType
  
  getAuthUrl(config: AuthConfig): Promise<string>
  exchangeToken(code: string, config: AuthConfig): Promise<TokenInfo>
  refreshToken(refreshToken: string): Promise<TokenInfo>
  publish(token: string, content: PublishContent): Promise<PublishResult>
  getUserInfo(token: string): Promise<UserInfo>
  getContentData(token: string, options: DataQueryOptions): Promise<ContentData[]>
  validateContent(content: PublishContent): ValidationResult
}
```

**Alternatives considered**:
- 直接实现微博特定接口：不符合架构设计，不利于扩展
- 使用第三方 SDK：增加依赖，不符合自主可控原则

**实现位置**: `lib/platforms/base/platform-adapter.ts`（需要创建）

---

### 2. 微博 OAuth 2.0 授权流程实现

**Decision**: 实现标准 OAuth 2.0 授权码模式，支持 Web 应用授权流程

**Rationale**:
- 微博开放平台支持 OAuth 2.0 标准流程
- Web 应用使用授权码模式，安全可靠
- 与现有认证系统（AuthService）集成

**关键信息**:
- **授权 URL**: `https://api.weibo.com/oauth2/authorize`
- **Token 获取**: `https://api.weibo.com/oauth2/access_token`
- **Token 类型**: Bearer Token，支持参数或 Header 传递
- **授权级别**: 
  - 测试级别：1天有效期
  - 普通级别：30天有效期
  - 开发者自身：5年有效期
- **Refresh Token**: 仅移动应用 SDK 支持，Web 应用不支持

**实现要点**:
- 生成 state 参数防止 CSRF 攻击
- 保存 state 到 session 或 Redis
- 回调时验证 state 参数
- 交换 code 获取 access_token
- 保存 token 到数据库（加密存储）

**Alternatives considered**:
- 使用第三方 OAuth 库：增加依赖，但可以简化实现（可选）

**实现位置**: `lib/platforms/weibo/weibo-adapter.ts`

---

### 3. 微博内容发布接口选择

**Decision**: 根据内容类型选择不同的发布接口

**Rationale**:
- 微博提供多个发布接口，针对不同内容类型
- 需要根据实际内容选择合适的接口

**接口选择**:
- **纯文字**: `statuses/update` - 发布纯文字微博（支持2000字）
- **文字+图片**: `statuses/upload` - 发布带图片的微博（最多9张）
- **文字+视频**: `statuses/upload_url_text` - 发布带视频的微博
- **分享链接**: `statuses/share` - 分享第三方链接（140字+URL）

**内容限制**:
- 文字长度：纯文字2000字，分享链接140字
- 图片数量：最多9张
- 图片大小：<5M
- 图片格式：JPEG、GIF、PNG
- 视频限制：需要进一步确认

**实现策略**:
- 根据内容类型自动选择接口
- 优先使用 `statuses/update`（最通用）
- 有图片时使用 `statuses/upload`
- 有视频时使用 `statuses/upload_url_text`

**Alternatives considered**:
- 统一使用一个接口：不符合微博 API 设计，可能无法支持所有内容类型

**实现位置**: `lib/platforms/weibo/weibo-adapter.ts` 的 `publish` 方法

---

### 4. Token 刷新机制实现

**Decision**: Web 应用不支持 refresh_token，需要实现 token 过期检测和重新授权流程

**Rationale**:
- 微博 Web 应用不支持 refresh_token（仅移动 SDK 支持）
- Token 有效期：测试应用1天，普通应用30天
- 需要检测 token 过期并引导用户重新授权

**实现策略**:
- 保存 token 过期时间（tokenExpiry）
- 发布前检查 token 是否过期
- 如果过期，标记账号为需要重新授权
- 前端检测到需要重新授权，引导用户重新连接
- 可选：实现 token 有效性验证接口（`oauth2/get_token_info`）

**Token 验证**:
- 使用 `oauth2/get_token_info` 接口验证 token 有效性
- 返回 token 过期时间和剩余有效时间
- 定期检查（如每天）或发布前检查

**Alternatives considered**:
- 使用移动 SDK 获取 refresh_token：不符合 Web 应用场景
- 忽略 token 过期：会导致发布失败，用户体验差

**实现位置**: 
- Token 验证：`lib/platforms/weibo/weibo-adapter.ts` 的 `refreshToken` 方法（实际为重新授权）
- Token 检查：`lib/services/publish.service.ts` 发布前检查

---

### 5. 内容验证和转换

**Decision**: 实现微博特定的内容验证和格式转换逻辑

**Rationale**:
- 微博有特定的内容限制（长度、格式等）
- 需要将通用内容格式转换为微博 API 格式
- 提前验证避免 API 调用失败

**验证规则**:
- 文字长度：根据接口类型验证（2000字或140字）
- 图片数量：最多9张
- 图片大小：每张<5M
- 图片格式：仅支持 JPEG、GIF、PNG
- 敏感词：需要调用微博内容安全接口（可选）

**转换逻辑**:
- 文字内容：处理特殊字符、Emoji、话题标签
- 图片：上传到微博图床，获取图片 URL
- 视频：上传到微博视频平台，获取视频 URL
- URL：处理短链接、添加跟踪参数（可选）

**实现位置**: `lib/platforms/weibo/weibo-utils.ts`

---

### 6. API 频率限制处理

**Decision**: 实现频率限制检测和重试机制

**Rationale**:
- 微博 API 有严格的频率限制
- 需要避免超出限制导致账号被封禁
- 实现智能重试和降级处理

**频率限制**:
- 单授权用户每天：100次
- 单IP每小时：15000次
- 发微博接口单授权用户每小时：30次

**实现策略**:
- 使用 `account/rate_limit_status` 接口查询剩余次数
- 发布前检查剩余次数
- 如果接近限制，延迟发布或提示用户
- 实现请求队列，控制发布频率
- 记录 API 调用日志，监控频率使用

**重试机制**:
- 频率限制错误：延迟后重试（指数退避）
- 网络错误：立即重试（最多3次）
- Token 过期：不重试，标记需要重新授权
- 内容错误：不重试，返回错误信息

**Alternatives considered**:
- 忽略频率限制：会导致账号被封禁，不可取
- 完全阻止发布：用户体验差，需要智能处理

**实现位置**: 
- 频率检查：`lib/platforms/weibo/weibo-client.ts`
- 重试逻辑：`lib/platforms/weibo/weibo-adapter.ts`

---

### 7. 错误处理和日志记录

**Decision**: 实现完整的错误分类和处理机制

**Rationale**:
- 微博 API 可能返回各种错误
- 需要区分可重试错误和不可重试错误
- 记录错误日志便于排查问题

**错误分类**:
- **Token 错误**: token 过期、无效 → 标记需要重新授权
- **频率限制**: 超出频率限制 → 延迟重试
- **内容错误**: 内容不符合要求 → 返回错误信息
- **网络错误**: 请求超时、连接失败 → 重试
- **服务器错误**: 微博服务器错误 → 重试

**错误处理**:
- 定义错误类型枚举
- 实现错误转换（微博错误码 → 通用错误）
- 记录错误日志（包含请求参数、响应内容）
- 返回友好的错误提示给用户

**实现位置**: `lib/platforms/weibo/weibo-client.ts` 和 `lib/platforms/weibo/weibo-types.ts`

---

### 8. HTTP 客户端选择

**Decision**: 使用原生 `fetch` API 或 `axios` 库

**Rationale**:
- Next.js 14+ 支持原生 `fetch` API
- `axios` 提供更好的错误处理和拦截器
- 需要支持文件上传（图片、视频）

**选择**: 使用 `axios` 库

**理由**:
- 更好的错误处理
- 支持请求/响应拦截器
- 支持文件上传（multipart/form-data）
- 支持请求取消
- 更好的 TypeScript 支持

**Alternatives considered**:
- 原生 `fetch`: 需要手动处理很多细节，代码复杂
- `node-fetch`: Node.js 环境需要，但 Next.js 已内置 fetch

**实现位置**: `lib/platforms/weibo/weibo-client.ts`

---

### 9. 环境变量配置

**Decision**: 使用环境变量存储微博 App Key 和 App Secret

**Rationale**:
- 敏感信息不能硬编码
- 不同环境使用不同配置
- 符合 Constitution 原则

**环境变量**:
- `WEIBO_APP_KEY`: 微博 App Key
- `WEIBO_APP_SECRET`: 微博 App Secret
- `WEIBO_REDIRECT_URI`: OAuth 回调地址

**配置管理**:
- 在 `config/platform.config.ts` 中读取环境变量
- 提供配置验证函数
- 开发环境使用 `.env.local`

**实现位置**: `config/platform.config.ts`（扩展现有配置）

---

### 10. 测试策略

**Decision**: 实现单元测试和集成测试

**Rationale**:
- 符合 Constitution Testing Discipline 原则
- 确保代码质量和稳定性
- 支持重构和持续集成

**测试范围**:
- **单元测试**: 
  - 内容验证逻辑
  - 内容转换逻辑
  - 错误处理逻辑
- **集成测试**:
  - OAuth 流程（使用 mock）
  - API 调用（使用 mock 响应）
  - Token 验证

**Mock 策略**:
- 使用 `nock` 或 `msw` mock HTTP 请求
- Mock 微博 API 响应
- 测试各种错误场景

**实现位置**: `lib/platforms/weibo/__tests__/`

---

## 技术决策总结

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 适配器接口 | PlatformAdapter 统一接口 | 符合架构设计，易于扩展 |
| OAuth 流程 | OAuth 2.0 授权码模式 | 标准流程，安全可靠 |
| 发布接口 | 根据内容类型选择 | 支持所有内容类型 |
| Token 刷新 | 过期检测+重新授权 | Web 应用不支持 refresh_token |
| 内容验证 | 提前验证+格式转换 | 避免 API 调用失败 |
| 频率限制 | 检测+重试+队列 | 避免账号被封禁 |
| 错误处理 | 分类处理+日志记录 | 提高可维护性 |
| HTTP 客户端 | axios | 更好的功能和错误处理 |
| 配置管理 | 环境变量 | 符合安全规范 |
| 测试策略 | 单元+集成测试 | 符合 Constitution 原则 |

## 待确认信息

以下信息需要在实现过程中进一步确认：

- [ ] 微博视频发布接口的具体参数和限制
- [ ] 微博内容安全接口的使用方式
- [ ] 微博图床上传接口的具体实现
- [ ] 实际测试环境的 App Key 和 App Secret
- [ ] 微博 API 错误码的完整列表和处理方式

## 参考资料

- 微博开放平台文档: https://open.weibo.com/wiki/
- 微博 API 参考: https://open.weibo.com/wiki/API
- OAuth 2.0 规范: https://oauth.net/2/
- 已有调研文档: `docs/platform-integration/research/weibo-api-research.md`
- 技术架构文档: `docs/platform-integration/technical-plan/integration-architecture.md`
