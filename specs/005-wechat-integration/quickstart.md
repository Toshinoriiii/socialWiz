# Quick Start: 微信公众号平台接入功能

**Feature**: 005-wechat-integration  
**Date**: 2026-01-15

## 功能概述

实现微信公众号平台的完整接入功能，包括：
- OAuth 2.0 授权流程（连接微信公众号账号）
- 内容发布到微信公众号（支持文字、图片、视频）
- Token 过期检测和重新授权
- 错误处理和重试机制
- 测试页面验证功能

## 前置条件

### 1. 环境配置

1. **微信公众号平台账号**:
   - **获取 AppID 和 AppSecret**:
     - 访问 **微信公众平台**: https://mp.weixin.qq.com/
     - 注册/登录账号（订阅号或服务号）
     - 进入 **"开发"** → **"基本配置"**
     - 复制 **AppID (应用ID)**
     - 点击"生成"获取 **AppSecret (应用密钥)**，立即复制保存（页面关闭后无法再次查看）
   - **配置 OAuth 回调地址**:
     - 在"基本配置"页面，找到 **"授权回调页面域名"** 或 **"网页授权域名"**
     - 添加你的域名（本地开发需要使用内网穿透工具，见下方说明）
   - **本地开发配置**:
     - 微信不支持 `localhost`，需要使用内网穿透工具
     - 推荐使用 **ngrok**: https://ngrok.com/
     - 启动命令：`ngrok http 3000`
     - 使用 ngrok 提供的公网地址作为回调地址
   - **详细配置指南**: 请参考 `WECHAT_CONFIG_GUIDE.md` 文件

2. **环境变量配置**:
   在 `.env.local` 中添加：
   ```bash
   WECHAT_APP_ID=your_app_id
   WECHAT_APP_SECRET=your_app_secret
   WECHAT_REDIRECT_URI=http://localhost:3000/api/platforms/wechat/auth/callback
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

### 测试场景 1: 连接微信公众号账号

1. **登录 SocialWiz**:
   - 访问 `http://localhost:3000/login`
   - 使用有效账号登录

2. **进入设置页面**:
   - 访问 `http://localhost:3000/dashboard/settings`
   - 找到"连接微信公众号"按钮

3. **发起授权**:
   - 点击"连接微信公众号"按钮
   - 系统跳转到微信授权页面
   - 在微信页面完成授权

4. **验证结果**:
   - ✅ 自动跳转回设置页面
   - ✅ 显示"微信公众号已连接"状态
   - ✅ 显示微信公众号名称
   - ✅ 数据库 `PlatformAccount` 表中有新记录

**API 测试**:
```bash
# 获取授权URL
curl http://localhost:3000/api/platforms/wechat/auth

# 响应示例
{
  "authUrl": "https://open.weixin.qq.com/connect/oauth2/authorize?appid=xxx&...",
  "state": "random-state-12345"
}
```

### 测试场景 2: 发布内容到微信公众号

1. **创建内容**:
   - 访问 `http://localhost:3000/dashboard/publish`
   - 创建新内容（文字+图片）

2. **发布到微信公众号**:
   - 选择"微信公众号"平台
   - 点击"发布"按钮

3. **验证结果**:
   - ✅ 发布成功提示
   - ✅ 显示微信公众号消息ID或链接
   - ✅ 数据库 `ContentPlatform` 表中有发布记录
   - ✅ 实际微信公众号中可以看到发布的内容

**API 测试**:
```bash
# 发布内容
curl -X POST http://localhost:3000/api/platforms/wechat/{platformAccountId}/publish \
  -H "Content-Type: application/json" \
  -d '{
    "text": "这是一条测试消息",
    "images": ["https://example.com/image.jpg"]
  }'

# 响应示例
{
  "success": true,
  "platformPostId": "1234567890",
  "publishedUrl": "https://mp.weixin.qq.com/s/xxx"
}
```

### 测试场景 3: 测试页面验证

1. **访问测试页面**:
   - 访问 `http://localhost:3000/test/wechat`
   - 查看测试页面界面

2. **测试授权连接**:
   - 点击"连接微信公众号"按钮
   - 完成授权流程
   - 验证连接状态显示

3. **测试内容发布**:
   - 输入测试内容
   - 选择发布选项
   - 点击"发布"按钮
   - 查看发布结果和日志

4. **测试错误场景**:
   - 测试 Token 过期场景
   - 测试内容验证失败场景
   - 测试频率限制场景
   - 查看错误提示和日志

**测试页面功能**:
- ✅ OAuth 授权连接测试
- ✅ 内容发布测试
- ✅ Token 状态查看
- ✅ 账号信息查看
- ✅ 错误场景测试
- ✅ API 调用日志查看

## 开发指南

### 1. 代码结构

```
lib/platforms/wechat/
├── wechat-adapter.ts      # 微信公众号适配器实现
├── wechat-client.ts       # 微信公众号 API 客户端
├── wechat-types.ts        # 微信公众号类型定义
└── wechat-utils.ts        # 微信公众号工具函数

app/api/platforms/wechat/
├── auth/
│   ├── route.ts           # 获取授权 URL
│   └── callback/
│       └── route.ts        # OAuth 回调处理
└── [platformAccountId]/
    ├── publish/
    │   └── route.ts        # 发布接口
    ├── disconnect/
    │   └── route.ts        # 断开连接
    └── status/
        └── route.ts        # 获取状态

app/test/wechat/
└── page.tsx                # 测试页面
```

### 2. 实现步骤

#### Step 1: 创建类型定义

创建 `lib/platforms/wechat/wechat-types.ts`:
```typescript
export interface WechatTokenInfo {
  access_token: string
  expires_in: number
  refresh_token?: string
  openid: string
  scope?: string
}

export interface WechatUserInfo {
  openid: string
  nickname: string
  headimgurl?: string
  // ...
}
```

#### Step 2: 创建 API 客户端

创建 `lib/platforms/wechat/wechat-client.ts`:
```typescript
export class WechatClient {
  private appId: string
  private appSecret: string
  
  async getAccessToken(code: string): Promise<WechatTokenInfo> {
    // 实现获取 Token 逻辑
  }
  
  async getUserInfo(accessToken: string, openid: string): Promise<WechatUserInfo> {
    // 实现获取用户信息逻辑
  }
  
  async publish(accessToken: string, content: PublishContent): Promise<PublishResult> {
    // 实现发布内容逻辑
  }
}
```

#### Step 3: 实现适配器

创建 `lib/platforms/wechat/wechat-adapter.ts`:
```typescript
export class WechatAdapter implements PlatformAdapter {
  readonly platform = Platform.WECHAT
  
  async getAuthUrl(config: AuthConfig): Promise<string> {
    // 实现生成授权 URL
  }
  
  async exchangeToken(code: string, config: AuthConfig): Promise<TokenInfo> {
    // 实现交换 Token
  }
  
  async publish(token: string, content: PublishContent): Promise<PublishResult> {
    // 实现发布内容
  }
  
  // ... 其他方法
}
```

#### Step 4: 创建 API 路由

创建 `app/api/platforms/wechat/auth/route.ts`:
```typescript
export async function GET(request: NextRequest) {
  // 生成授权 URL 和 state
  // 返回授权 URL
}
```

创建 `app/api/platforms/wechat/auth/callback/route.ts`:
```typescript
export async function GET(request: NextRequest) {
  // 验证 state
  // 交换 code 获取 token
  // 获取用户信息
  // 保存到数据库
  // 重定向到设置页面
}
```

#### Step 5: 创建测试页面

创建 `app/test/wechat/page.tsx`:
```typescript
export default function WechatTestPage() {
  // 实现测试页面 UI
  // 包含授权连接、内容发布、状态查看等功能
}
```

### 3. 集成到现有服务

#### 更新 PublishService

在 `lib/services/publish.service.ts` 中添加微信公众号支持：
```typescript
import { WechatAdapter } from '@/lib/platforms/wechat/wechat-adapter'

// 在发布方法中添加微信公众号适配器
const adapter = platformAdapters[Platform.WECHAT]
if (adapter) {
  // 调用适配器发布内容
}
```

#### 更新平台适配器导出

在 `lib/platforms/index.ts` 中导出微信公众号适配器：
```typescript
export { WechatAdapter } from './wechat/wechat-adapter'
export * from './wechat/wechat-types'
```

## 常见问题

### Q1: 微信公众号 OAuth 回调地址如何配置？

A: 在微信公众平台后台配置 OAuth 回调地址，本地开发需要使用内网穿透工具（如 ngrok）获取公网地址。

### Q2: Token 过期如何处理？

A: 需要调研微信是否支持 refresh_token。如果支持，实现自动刷新；如果不支持，检测到过期后引导用户重新授权。

### Q3: 内容发布接口是什么？

A: 需要根据微信 API 文档确认具体的发布接口。可能是群发消息接口或素材管理接口。

### Q4: 测试页面在哪里？

A: 测试页面位于 `app/test/wechat/page.tsx`，访问 `http://localhost:3000/test/wechat` 即可使用。

### Q5: 如何查看 API 调用日志？

A: 测试页面提供日志查看功能，可以查看所有 API 调用和错误信息。

## 下一步

1. **完成调研**: 确认微信公众号 API 的具体接口和参数
2. **实现适配器**: 实现 WechatAdapter 和 WechatClient
3. **创建 API 路由**: 实现 OAuth 和发布接口
4. **创建测试页面**: 实现测试页面用于功能验证
5. **编写测试**: 编写单元测试和集成测试
6. **文档更新**: 更新 API 文档和用户文档

## 参考资料

- 微信公众平台文档: https://developers.weixin.qq.com/doc/
- OAuth 2.0 规范: https://oauth.net/2/
- 微博集成参考: `specs/003-weibo-integration/`
- 技术架构文档: `docs/platform-integration/technical-plan/integration-architecture.md`
