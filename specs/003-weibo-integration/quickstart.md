# Quick Start: 微博平台接入功能

**Feature**: 003-weibo-integration  
**Date**: 2025-01-13

## 功能概述

实现微博平台的完整接入功能，包括：
- OAuth 2.0 授权流程（连接微博账号）
- 内容发布到微博（支持文字、图片、视频）
- Token 过期检测和重新授权
- 错误处理和重试机制

## 前置条件

### 1. 环境配置

1. **微博开放平台账号**:
   - 访问 https://open.weibo.com/ 注册开发者账号
   - 创建应用，获取 App Key 和 App Secret
   - **重要**: 由于微博不支持 localhost 回调，需要使用内网穿透工具（如 ngrok）
   - 配置回调地址：`https://your-ngrok-url.ngrok-free.app/api/platforms/weibo/auth/callback`
   - 详细配置步骤请参考：[本地开发配置指南](../../docs/WEIBO_LOCAL_SETUP.md)

2. **环境变量配置**:
   在 `.env.local` 中添加：
   ```bash
   WEIBO_APP_KEY=your_app_key
   WEIBO_APP_SECRET=your_app_secret
   WEIBO_REDIRECT_URI=http://localhost:3000/api/platforms/weibo/auth/callback
   ```

3. **数据库和 Redis**:
   - 确保 PostgreSQL 数据库已运行
   - 确保 Redis 已运行（用于 OAuth state 存储）
   - 运行数据库迁移：`pnpm prisma migrate dev`

### 2. 启动应用

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

## 快速测试

### 测试场景 1: 连接微博账号

1. **登录 SocialWiz**:
   - 访问 `http://localhost:3000/login`
   - 使用有效账号登录

2. **进入设置页面**:
   - 访问 `http://localhost:3000/dashboard/settings`
   - 找到"连接微博"按钮

3. **发起授权**:
   - 点击"连接微博"按钮
   - 系统跳转到微博授权页面
   - 在微博页面完成授权

4. **验证结果**:
   - ✅ 自动跳转回设置页面
   - ✅ 显示"微博已连接"状态
   - ✅ 显示微博用户名
   - ✅ 数据库 `PlatformAccount` 表中有新记录

**API 测试**:
```bash
# 获取授权URL
curl http://localhost:3000/api/platforms/weibo/auth

# 响应示例
{
  "authUrl": "https://api.weibo.com/oauth2/authorize?client_id=xxx&...",
  "state": "random-state-12345"
}
```

### 测试场景 2: 发布内容到微博

1. **创建内容**:
   - 访问 `http://localhost:3000/dashboard/publish`
   - 创建新内容（文字+图片）

2. **发布到微博**:
   - 选择"微博"平台
   - 点击"发布"按钮

3. **验证结果**:
   - ✅ 发布成功提示
   - ✅ 显示微博链接
   - ✅ 数据库 `ContentPlatform` 表中有发布记录
   - ✅ 实际微博账号中可以看到发布的微博

**API 测试**:
```bash
# 发布内容（需要先获取 platformAccountId）
PLATFORM_ACCOUNT_ID="your-platform-account-id"
CONTENT_ID="your-content-id"

curl -X POST \
  http://localhost:3000/api/platforms/weibo/${PLATFORM_ACCOUNT_ID}/publish \
  -H "Content-Type: application/json" \
  -d '{
    "contentId": "'${CONTENT_ID}'",
    "text": "这是一条测试微博 #SocialWiz",
    "images": ["https://example.com/image.jpg"]
  }'
```

### 测试场景 3: Token 过期处理

1. **模拟 Token 过期**:
   - 在数据库中修改 `PlatformAccount.tokenExpiry` 为过去的时间
   - 或等待 token 自然过期（测试应用1天，普通应用30天）

2. **尝试发布内容**:
   - 创建内容并尝试发布到微博

3. **验证结果**:
   - ✅ 系统检测到 token 过期
   - ✅ 标记账号为"需要重新授权"
   - ✅ 返回友好错误提示
   - ✅ 设置页面显示"需要重新连接"

**Token 验证 API**:
```bash
# 检查账号状态
curl http://localhost:3000/api/platforms/weibo/${PLATFORM_ACCOUNT_ID}/status

# 响应示例（token过期）
{
  "id": "...",
  "platform": "WEIBO",
  "platformUsername": "test_user",
  "isConnected": true,
  "tokenExpiry": "2025-01-12T00:00:00Z",
  "needsReauth": true
}
```

### 测试场景 4: 内容验证

1. **测试文字长度限制**:
   - 创建超过2000字的内容
   - 尝试发布到微博

2. **验证结果**:
   - ✅ 系统提前验证内容
   - ✅ 返回错误提示："文字内容超过2000字限制"
   - ✅ 不调用微博 API

3. **测试图片数量限制**:
   - 创建包含10张图片的内容
   - 尝试发布到微博

4. **验证结果**:
   - ✅ 返回错误提示："图片数量超过9张限制"
   - ✅ 不调用微博 API

### 测试场景 5: 错误处理和重试

1. **模拟网络错误**:
   - 断开网络连接
   - 尝试发布内容

2. **验证结果**:
   - ✅ 系统检测到网络错误
   - ✅ 自动重试（最多3次）
   - ✅ 如果仍然失败，返回错误信息

3. **模拟频率限制**:
   - 快速连续发布多条内容（超过每小时30次限制）

4. **验证结果**:
   - ✅ 系统检测到频率限制错误
   - ✅ 返回友好提示："发布频率过高，请稍后再试"
   - ✅ 记录错误日志

## API 端点测试

### 1. 获取授权URL

```bash
GET /api/platforms/weibo/auth

响应:
{
  "authUrl": "https://api.weibo.com/oauth2/authorize?...",
  "state": "random-state-12345"
}
```

### 2. OAuth 回调（浏览器自动跳转）

```
GET /api/platforms/weibo/auth/callback?code=xxx&state=xxx

响应: 重定向到 /dashboard/settings?platform=weibo&status=connected
```

### 3. 发布内容

```bash
POST /api/platforms/weibo/{platformAccountId}/publish
Content-Type: application/json

{
  "contentId": "uuid",
  "text": "微博内容",
  "images": ["https://example.com/image.jpg"]
}

响应:
{
  "success": true,
  "platformPostId": "1234567890",
  "publishedUrl": "https://weibo.com/1234567890/xxx"
}
```

### 4. 断开连接

```bash
POST /api/platforms/weibo/{platformAccountId}/disconnect

响应:
{
  "success": true
}
```

### 5. 获取账号状态

```bash
GET /api/platforms/weibo/{platformAccountId}/status

响应:
{
  "id": "uuid",
  "platform": "WEIBO",
  "platformUsername": "test_user",
  "isConnected": true,
  "tokenExpiry": "2025-02-13T00:00:00Z",
  "needsReauth": false
}
```

## 常见问题

### Q: 授权后没有跳转回应用？

**A**: 检查回调地址配置是否正确，确保与 `WEIBO_REDIRECT_URI` 一致。

### Q: 发布失败，提示"需要重新授权"？

**A**: Token 可能已过期。访问设置页面，点击"重新连接微博"完成授权。

### Q: 内容发布失败，错误码 21327？

**A**: 这是微博频率限制错误。等待一段时间后重试，或检查是否超出每小时30次限制。

### Q: 图片上传失败？

**A**: 检查图片格式（仅支持 JPEG/GIF/PNG）和大小（<5M）。确保图片 URL 可访问。

### Q: 如何查看详细的错误信息？

**A**: 查看服务器日志，或调用 `/api/platforms/weibo/{platformAccountId}/status` 接口查看账号状态。

## 下一步

完成功能测试后，可以：
1. 运行 `/speckit.tasks` 生成实施任务列表
2. 开始实现功能代码
3. 编写单元测试和集成测试
4. 实现其他平台（Twitter、Threads）的接入
