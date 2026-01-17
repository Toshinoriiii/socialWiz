# 微信公众号平台适配器

微信公众号平台适配器实现，提供 OAuth 2.0 授权、内容发布等功能。

## 功能特性

- ✅ OAuth 2.0 授权流程
- ✅ 用户信息获取
- ✅ 内容发布（纯文本、图文消息）
- ✅ Token 刷新机制（如果微信支持）
- ✅ 错误处理和重试机制
- ✅ 频率限制处理

## 快速开始

### 1. 环境配置

在 `.env.local` 中添加微信公众号配置：

```bash
WECHAT_APP_ID=your_app_id
WECHAT_APP_SECRET=your_app_secret
WECHAT_REDIRECT_URI=http://localhost:3000/api/platforms/wechat/auth/callback
```

### 2. 创建适配器实例

```typescript
import { WechatAdapter } from '@/lib/platforms/wechat/wechat-adapter'
import { getPlatformConfig } from '@/config/platform.config'

const config = getPlatformConfig(Platform.WECHAT)
const adapter = new WechatAdapter({
  appId: config.appId,
  appSecret: config.appSecret,
  redirectUri: config.redirectUri
})
```

### 3. OAuth 授权

```typescript
// 获取授权 URL
const authUrl = await adapter.getAuthUrl({
  clientId: config.appId,
  clientSecret: config.appSecret,
  redirectUri: config.redirectUri,
  state: 'random-state-string'
})

// 用户跳转到 authUrl 完成授权后，处理回调
const tokenInfo = await adapter.exchangeToken(code, {
  clientId: config.appId,
  clientSecret: config.appSecret,
  redirectUri: config.redirectUri
})
```

### 4. 发布内容

```typescript
// 发布纯文本
const result = await adapter.publish(accessToken, {
  text: '这是一条测试消息'
})

// 发布图文消息（需要先上传图片）
const result = await adapter.publish(accessToken, {
  text: '这是一条图文消息',
  images: ['https://example.com/image.jpg']
})
```

## API 参考

### WechatAdapter

#### `getAuthUrl(config: AuthConfig): Promise<string>`

生成微信公众号 OAuth 2.0 授权 URL。

**参数：**
- `config.clientId`: 微信公众号 AppID
- `config.clientSecret`: 微信公众号 AppSecret
- `config.redirectUri`: OAuth 回调地址
- `config.state`: 状态参数（用于防止 CSRF 攻击）
- `config.scope`: 授权范围（默认 `snsapi_userinfo`）

**返回：** 授权 URL 字符串

#### `exchangeToken(code: string, config: AuthConfig): Promise<TokenInfo>`

使用授权码换取 access_token。

**参数：**
- `code`: OAuth 授权码
- `config`: 授权配置

**返回：** Token 信息，包含 `accessToken`、`refreshToken`（如果支持）、`expiresIn`、`openid` 等

#### `refreshToken(refreshToken: string): Promise<TokenInfo>`

刷新 access_token（如果微信支持 refresh_token）。

**注意：** 微信公众号 OAuth 2.0 可能不支持 refresh_token，需要根据实际 API 文档确认。

#### `getUserInfo(token: string, openid: string): Promise<UserInfo>`

获取微信公众号用户信息。

**参数：**
- `token`: 访问令牌
- `openid`: 用户唯一标识

**返回：** 用户信息，包含 `id`、`username`、`name`、`avatar` 等

#### `publish(token: string, content: PublishContent): Promise<PublishResult>`

发布内容到微信公众号。

**参数：**
- `token`: 访问令牌
- `content.text`: 文本内容（必填）
- `content.images`: 图片 URL 数组（可选）
- `content.video`: 视频 URL（可选，暂不支持）
- `content.url`: 分享链接（可选）

**返回：** 发布结果，包含 `success`、`platformPostId`、`publishedUrl`、`error` 等

**注意：**
- 订阅号每天只能群发一条消息
- 服务号每月可以群发 4 条消息
- 图文消息需要先上传图片获取 media_id（当前实现仅支持纯文本）

#### `validateContent(content: PublishContent): ValidationResult`

验证内容是否符合微信公众号限制。

**返回：** 验证结果，包含 `valid` 和 `errors` 数组

### WechatClient

底层 HTTP 客户端，封装微信公众号 API 请求。

#### `getAccessToken(code: string): Promise<WechatTokenInfo>`

获取 access_token。

#### `refreshAccessToken(refreshToken: string): Promise<WechatTokenInfo>`

刷新 access_token（如果支持）。

#### `getUserInfo(accessToken: string, openid: string): Promise<WechatUserInfo>`

获取用户信息。

#### `publishText(accessToken: string, text: string, targetGroup?: string): Promise<WechatPublishResult>`

发布文本消息（群发）。

#### `publishNews(accessToken: string, articles: Array<...>, targetGroup?: string): Promise<WechatPublishResult>`

发布图文消息（群发）。

## 内容限制

根据微信公众号 API 文档（需要实际验证）：

- **文字长度**: 最多 20000 字（需要确认实际限制）
- **图片数量**: 最多 8 张（图文消息）
- **图片大小**: 每张不超过 2MB
- **图片格式**: JPG、PNG

## 错误处理

适配器会自动处理以下错误：

- **Token 过期** (`40001`, `40014`): 返回 `TOKEN_EXPIRED` 错误码，需要重新授权
- **频率限制** (`45009`, `45011`): 返回 `RATE_LIMIT` 错误码，建议延迟重试
- **内容违规** (`87014`): 返回内容不符合平台规范的错误

## 注意事项

1. **Token 有效期**: 微信公众号 access_token 有效期为 7200 秒（2 小时），需要定期刷新或重新授权
2. **频率限制**: 不同接口有不同的频率限制，需要根据实际使用情况控制调用频率
3. **账号类型**: 订阅号和服务号的功能权限不同，部分接口可能不可用
4. **图片上传**: 图文消息需要先上传图片获取 media_id，当前实现仅支持纯文本发布

## 相关文档

- [微信公众平台文档](https://developers.weixin.qq.com/doc/)
- [OAuth 2.0 规范](https://oauth.net/2/)
- [平台集成架构文档](../../../docs/platform-integration/technical-plan/integration-architecture.md)

## 开发状态

- ✅ OAuth 授权流程
- ✅ 用户信息获取
- ✅ 纯文本内容发布
- ⚠️ 图文消息发布（需要图片上传功能）
- ⚠️ Token 刷新（需要确认微信是否支持 refresh_token）
- ⚠️ 图片上传功能

## 待完成功能

- [ ] 图片上传功能（`uploadImage` 方法）
- [ ] 完整的图文消息支持
- [ ] Token 刷新机制确认和实现
- [ ] 内容限制的准确验证（需要实际测试）
