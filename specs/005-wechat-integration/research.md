# Research: 微信公众号平台接入实现方案

**Feature**: 005-wechat-integration  
**Date**: 2026-01-15

## Research Questions

### 1. 微信公众号 API 类型和接口选择

**Decision**: 需要调研微信公众号的具体 API 类型和内容发布接口

**Rationale**: 
- 微信公众号分为订阅号、服务号、企业号，不同账号类型权限不同
- 需要确认内容发布的具体接口和参数
- 需要了解 API 调用频率限制和内容限制

**需要调研的关键信息**:
- **官方文档地址**: https://developers.weixin.qq.com/doc/ (需要验证最新版本)
- **账号类型**: 
  - 订阅号：功能受限，不支持高级接口
  - 服务号：需要认证，支持高级接口
  - 企业号：企业微信相关
- **内容发布接口**: 
  - 群发消息接口（需要确认具体接口名称）
  - 素材管理接口（上传图片、视频）
  - 消息推送接口
- **API 调用频率限制**: 需要确认具体数值
- **内容限制**: 
  - 文字长度限制
  - 图片数量和大小限制
  - 视频限制

**⚠️ 需要实际验证**:
- 当前 API 版本和文档地址
- 具体的 API 调用频率限制
- 内容发布接口的具体参数和限制
- Token 刷新机制
- 订阅号和服务号的功能差异

**Alternatives considered**:
- 第三方SDK：可能存在稳定性风险，优先使用官方API
- Webhook方式：微信支持，但需要服务器配置

**实现位置**: `lib/platforms/wechat/wechat-adapter.ts`

---

### 2. 微信公众号 OAuth 2.0 授权流程实现

**Decision**: 需要调研微信公众号的 OAuth 2.0 授权流程

**Rationale**:
- 微信公众号的 OAuth 流程可能与微博不同
- 需要确认授权 URL、Token 获取方式
- 需要了解 Token 有效期和刷新机制

**关键信息** (基于现有配置，需要验证):
- **授权 URL**: `https://open.weixin.qq.com/connect/oauth2/authorize` (需要验证)
- **Token 获取**: `https://api.weixin.qq.com/sns/oauth2/access_token` (需要验证)
- **授权范围**: `snsapi_userinfo` (需要确认是否还有其他范围)
- **Token 类型**: 需要确认是 Bearer Token 还是其他方式
- **Token 有效期**: 需要调研具体有效期
- **Refresh Token**: 需要确认是否支持 refresh_token

**实现要点**:
- 生成 state 参数防止 CSRF 攻击
- 保存 state 到 session 或 Redis
- 回调时验证 state 参数
- 交换 code 获取 access_token
- 保存 token 到数据库（加密存储）

**⚠️ 需要实际验证**:
- OAuth 2.0 授权流程的具体步骤
- Token 获取接口的参数格式
- Token 刷新机制（是否支持 refresh_token）
- Token 有效期和过期处理

**Alternatives considered**:
- 使用第三方 OAuth 库：增加依赖，但可以简化实现（可选）

**实现位置**: `lib/platforms/wechat/wechat-adapter.ts`

---

### 3. 微信公众号内容发布接口选择

**Decision**: 需要调研微信公众号的内容发布接口

**Rationale**:
- 微信公众号可能提供多个发布接口
- 需要根据内容类型选择合适的接口
- 需要了解不同账号类型的接口权限

**接口调研** (需要实际验证):
- **群发消息接口**: 需要确认接口名称和参数
- **素材管理接口**: 上传图片、视频等素材
- **消息推送接口**: 主动推送消息给用户
- **草稿箱接口**: 保存草稿后再发布

**内容限制** (需要实际验证):
- 文字长度：需要确认具体限制
- 图片数量：需要确认最多支持多少张
- 图片大小：需要确认大小限制
- 视频限制：需要确认视频格式和大小限制
- 富文本支持：需要确认是否支持 HTML 格式

**实现策略**:
- 根据内容类型自动选择接口
- 优先使用群发消息接口（如果支持）
- 有图片时先上传素材，再发布
- 有视频时先上传视频素材，再发布

**⚠️ 需要实际验证**:
- 具体的发布接口名称和参数
- 内容格式要求（纯文本、HTML、Markdown）
- 图片和视频上传流程
- 不同账号类型的接口权限差异

**Alternatives considered**:
- 统一使用一个接口：可能不符合微信 API 设计，需要根据实际情况选择

**实现位置**: `lib/platforms/wechat/wechat-adapter.ts` 的 `publish` 方法

---

### 4. Token 刷新机制实现

**Decision**: 需要调研微信公众号的 Token 刷新机制

**Rationale**:
- Token 过期会导致发布失败
- 需要实现自动刷新机制保证服务可用性
- 需要了解微信是否支持 refresh_token

**实现策略** (需要验证):
- 如果支持 refresh_token：实现自动刷新逻辑
- 如果不支持 refresh_token：实现 token 过期检测和重新授权流程
- 保存 token 过期时间（tokenExpiry）
- 发布前检查 token 是否过期
- 如果过期，优先尝试刷新（如果可能），否则标记账号为需要重新授权

**Token 验证**:
- 使用微信提供的 token 验证接口（需要确认接口名称）
- 返回 token 过期时间和剩余有效时间
- 定期检查（如每天）或发布前检查

**⚠️ 需要实际验证**:
- 微信是否支持 refresh_token
- Token 有效期是多长
- Token 验证接口的具体实现
- 重新授权的流程

**Alternatives considered**:
- 忽略 token 过期：会导致发布失败，用户体验差
- 完全阻止发布：用户体验差，需要智能处理

**实现位置**: 
- Token 验证：`lib/platforms/wechat/wechat-adapter.ts` 的 `refreshToken` 方法
- Token 检查：`lib/services/publish.service.ts` 发布前检查

---

### 5. 内容验证和转换

**Decision**: 实现微信公众号特定的内容验证和格式转换逻辑

**Rationale**:
- 微信公众号有特定的内容限制（长度、格式等）
- 需要将通用内容格式转换为微信 API 格式
- 提前验证避免 API 调用失败

**验证规则** (需要实际验证):
- 文字长度：根据接口类型验证（需要确认具体限制）
- 图片数量：需要确认最多支持多少张
- 图片大小：需要确认大小限制
- 图片格式：需要确认支持的格式（JPEG、PNG、GIF等）
- 视频限制：需要确认视频格式和大小限制
- 敏感词：需要确认是否有内容安全接口

**转换逻辑**:
- 文字内容：处理特殊字符、Emoji、HTML 标签（如果支持）
- 图片：上传到微信素材库，获取 media_id
- 视频：上传到微信素材库，获取 media_id
- URL：处理短链接、添加跟踪参数（可选）

**⚠️ 需要实际验证**:
- 具体的内容限制数值
- 内容格式要求（纯文本、HTML、Markdown）
- 图片和视频上传接口的具体实现
- 内容安全接口的使用方式

**实现位置**: `lib/platforms/wechat/wechat-utils.ts`

---

### 6. API 频率限制处理

**Decision**: 实现频率限制检测和重试机制

**Rationale**:
- 微信公众号 API 有频率限制
- 需要避免超出限制导致账号被封禁
- 实现智能重试和降级处理

**频率限制** (需要实际验证):
- 需要确认具体的频率限制数值
- 不同接口可能有不同的限制
- 不同账号类型可能有不同的限制

**实现策略**:
- 使用微信提供的频率限制查询接口（如果存在）
- 发布前检查剩余次数
- 如果接近限制，延迟发布或提示用户
- 实现请求队列，控制发布频率
- 记录 API 调用日志，监控频率使用

**重试机制**:
- 频率限制错误：延迟后重试（指数退避）
- 网络错误：立即重试（最多3次）
- Token 过期：不重试，标记需要重新授权
- 内容错误：不重试，返回错误信息

**⚠️ 需要实际验证**:
- 具体的频率限制数值
- 频率限制查询接口（如果存在）
- 不同接口的限制差异

**Alternatives considered**:
- 忽略频率限制：会导致账号被封禁，不可取
- 完全阻止发布：用户体验差，需要智能处理

**实现位置**: 
- 频率检查：`lib/platforms/wechat/wechat-client.ts`
- 重试逻辑：`lib/platforms/wechat/wechat-adapter.ts`

---

### 7. 错误处理和日志记录

**Decision**: 实现完整的错误分类和处理机制

**Rationale**:
- 微信公众号 API 可能返回各种错误
- 需要区分可重试错误和不可重试错误
- 记录错误日志便于排查问题

**错误分类**:
- **Token 错误**: token 过期、无效 → 标记需要重新授权
- **频率限制**: 超出频率限制 → 延迟重试
- **内容错误**: 内容不符合要求 → 返回错误信息
- **网络错误**: 请求超时、连接失败 → 重试
- **服务器错误**: 微信服务器错误 → 重试

**错误处理**:
- 定义错误类型枚举
- 实现错误转换（微信错误码 → 通用错误）
- 记录错误日志（包含请求参数、响应内容）
- 返回友好的错误提示给用户

**⚠️ 需要实际验证**:
- 微信 API 错误码的完整列表
- 错误码和处理方式的对应关系
- 错误响应的格式

**实现位置**: `lib/platforms/wechat/wechat-client.ts` 和 `lib/platforms/wechat/wechat-types.ts`

---

### 8. HTTP 客户端选择

**Decision**: 使用 `axios` 库（与微博集成保持一致）

**Rationale**:
- 与现有微博集成保持一致
- 更好的错误处理
- 支持请求/响应拦截器
- 支持文件上传（multipart/form-data）
- 支持请求取消
- 更好的 TypeScript 支持

**选择**: 使用 `axios` 库

**Alternatives considered**:
- 原生 `fetch`: 需要手动处理很多细节，代码复杂
- `node-fetch`: Node.js 环境需要，但 Next.js 已内置 fetch

**实现位置**: `lib/platforms/wechat/wechat-client.ts`

---

### 9. 环境变量配置

**Decision**: 使用环境变量存储微信公众号 AppID 和 AppSecret

**Rationale**:
- 敏感信息不能硬编码
- 不同环境使用不同配置
- 符合 Constitution 原则

**环境变量**:
- `WECHAT_APP_ID`: 微信公众号 AppID
- `WECHAT_APP_SECRET`: 微信公众号 AppSecret
- `WECHAT_REDIRECT_URI`: OAuth 回调地址

**配置管理**:
- 在 `config/platform.config.ts` 中读取环境变量
- 提供配置验证函数
- 开发环境使用 `.env.local`

**实现位置**: `config/platform.config.ts`（扩展现有配置）

---

### 10. 测试页面实现

**Decision**: 创建专门的测试页面用于功能验证

**Rationale**:
- 用户需求明确要求"在测试页面验证"
- 测试页面便于功能验证和调试
- 可以快速验证 OAuth 流程、内容发布等功能

**测试页面功能**:
- OAuth 授权连接测试
- 内容发布测试
- Token 状态查看
- 错误场景测试
- 日志查看

**实现位置**: `app/test/wechat/page.tsx`

**页面结构**:
- 授权连接区域：显示连接状态，提供连接/断开按钮
- 内容发布区域：输入内容，选择发布选项，显示发布结果
- 状态查看区域：显示 Token 信息、账号信息等
- 日志查看区域：显示 API 调用日志和错误信息

**Alternatives considered**:
- 使用现有设置页面：可能不够灵活，专门的测试页面更适合调试

---

### 11. 测试策略

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
- **E2E 测试**:
  - 测试页面的端到端功能验证

**Mock 策略**:
- 使用 `nock` 或 `msw` mock HTTP 请求
- Mock 微信 API 响应
- 测试各种错误场景

**实现位置**: `lib/platforms/wechat/__tests__/`

---

## 技术决策总结

| 决策项 | 选择 | 状态 |
|--------|------|------|
| 适配器接口 | PlatformAdapter 统一接口 | ✅ 已确定 |
| OAuth 流程 | OAuth 2.0 授权码模式 | ⚠️ 需要验证 |
| 发布接口 | 需要调研具体接口 | ⚠️ 需要验证 |
| Token 刷新 | 需要调研是否支持 refresh_token | ⚠️ 需要验证 |
| 内容验证 | 提前验证+格式转换 | ⚠️ 需要验证限制 |
| 频率限制 | 检测+重试+队列 | ⚠️ 需要验证限制 |
| 错误处理 | 分类处理+日志记录 | ⚠️ 需要验证错误码 |
| HTTP 客户端 | axios | ✅ 已确定 |
| 配置管理 | 环境变量 | ✅ 已确定 |
| 测试页面 | 专门的测试页面 | ✅ 已确定 |
| 测试策略 | 单元+集成+E2E测试 | ✅ 已确定 |

## 待确认信息

以下信息需要在实现过程中进一步确认：

- [ ] 微信公众号 API 官方文档的最新版本和地址
- [ ] 订阅号和服务号的功能差异和接口权限
- [ ] OAuth 2.0 授权流程的具体步骤和参数
- [ ] Token 有效期和刷新机制（是否支持 refresh_token）
- [ ] 内容发布接口的具体名称、参数和限制
- [ ] 内容限制的具体数值（文字长度、图片数量、大小等）
- [ ] API 调用频率限制的具体数值
- [ ] 图片和视频上传接口的具体实现
- [ ] 微信 API 错误码的完整列表和处理方式
- [ ] 内容安全接口的使用方式（如果存在）

## 参考资料

- 微信公众平台文档: https://developers.weixin.qq.com/doc/ (需要验证最新版本)
- OAuth 2.0 规范: https://oauth.net/2/
- 已有调研文档: `docs/platform-integration/research/` (需要查看是否有微信相关文档)
- 技术架构文档: `docs/platform-integration/technical-plan/integration-architecture.md`
- 微博集成参考: `specs/003-weibo-integration/research.md`
