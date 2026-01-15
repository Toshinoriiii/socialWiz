# 微信公众号配置获取指南

## 获取 AppID 和 AppSecret

### 步骤 1: 访问微信公众平台

**网站地址**: https://mp.weixin.qq.com/

### 步骤 2: 注册/登录账号

1. 如果没有账号，点击"立即注册"
2. 选择账号类型：
   - **订阅号**：个人和企业都可以注册，功能相对受限
   - **服务号**：仅企业可以注册，需要企业认证，功能更强大
   - **企业号**：企业微信相关
3. 完成注册流程（需要邮箱、手机号验证等）

### 步骤 3: 登录并进入开发设置

1. 登录微信公众平台后台
2. 在左侧菜单中找到 **"开发"** → **"基本配置"**
3. 或者直接访问：https://mp.weixin.qq.com/cgi-bin/callback?name=homepage&token=&lang=zh_CN

### 步骤 4: 获取 AppID 和 AppSecret

1. **AppID (应用ID)**:
   - 在"基本配置"页面中，可以看到 **"AppID(应用ID)"**
   - 直接复制即可

2. **AppSecret (应用密钥)**:
   - 在"基本配置"页面中，找到 **"AppSecret(应用密钥)"**
   - 如果未设置，点击"生成"按钮生成新的密钥
   - **重要**: 生成后立即复制保存，页面关闭后将无法再次查看
   - 如果忘记，需要重置（重置后旧的密钥将失效）

### 步骤 5: 配置服务器和 OAuth 回调地址

1. **服务器配置**（如果需要）:
   - 在"基本配置"页面中，找到"服务器配置"
   - 配置服务器 URL 和 Token（用于接收微信消息）

2. **OAuth 回调地址配置**:
   - 在"基本配置"页面中，找到 **"授权回调页面域名"** 或 **"网页授权域名"**
   - 添加你的域名（例如：`your-domain.com`）
   - **注意**: 
     - 本地开发可以使用内网穿透工具（如 ngrok）获取公网地址
     - 回调地址格式：`http://your-domain.com/api/platforms/wechat/auth/callback`
     - 微信不支持 `localhost`，必须使用域名

### 步骤 6: 配置环境变量

在项目的 `.env.local` 文件中添加以下配置：

```bash
# 微信公众号配置
WECHAT_APP_ID=你的AppID
WECHAT_APP_SECRET=你的AppSecret
WECHAT_REDIRECT_URI=http://your-domain.com/api/platforms/wechat/auth/callback
```

**本地开发示例**（使用 ngrok）:
```bash
# 启动 ngrok
ngrok http 3000

# 使用 ngrok 提供的公网地址（例如：https://abc123.ngrok-free.app）
WECHAT_APP_ID=wx1234567890abcdef
WECHAT_APP_SECRET=your_secret_key_here
WECHAT_REDIRECT_URI=https://abc123.ngrok-free.app/api/platforms/wechat/auth/callback
```

## 重要注意事项

### 1. 账号类型限制

- **订阅号**: 
  - 个人订阅号功能受限，不支持高级接口
  - 企业订阅号需要认证后才能使用更多功能
  
- **服务号**:
  - 需要企业认证（需要营业执照等）
  - 认证后可以使用更多高级接口
  - 支持 OAuth 2.0 网页授权

### 2. 开发者认证

- 某些高级接口需要完成开发者认证
- 认证可能需要提交相关资质文件
- 认证通过后才能使用完整的 API 功能

### 3. 测试账号（推荐用于开发测试）

如果不想使用正式账号，可以使用**微信公众平台测试账号**：

1. 访问：https://mp.weixin.qq.com/debug/cgi-bin/sandbox?t=jsapisign
2. 使用微信扫码登录
3. 获取测试账号的 AppID 和 AppSecret
4. 测试账号功能完整，适合开发测试

### 4. 内网穿透工具（本地开发）

由于微信不支持 `localhost`，本地开发需要使用内网穿透：

**推荐工具**:
- **ngrok**: https://ngrok.com/ （免费版可用）
- **localtunnel**: https://localtunnel.github.io/www/ （免费开源）
- **serveo**: https://serveo.net/ （免费，无需安装）

**ngrok 使用示例**:
```bash
# 安装 ngrok
brew install ngrok  # macOS
# 或下载：https://ngrok.com/download

# 启动本地服务器
pnpm dev  # 在 3000 端口

# 在另一个终端启动 ngrok
ngrok http 3000

# 会显示类似：
# Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
# 使用这个 https://abc123.ngrok-free.app 作为回调地址
```

## 配置检查清单

- [ ] 已注册微信公众平台账号
- [ ] 已获取 AppID
- [ ] 已生成并保存 AppSecret
- [ ] 已配置授权回调页面域名
- [ ] 已在 `.env.local` 中添加配置
- [ ] 本地开发已配置内网穿透（如需要）
- [ ] 已测试 OAuth 授权流程

## 相关链接

- **微信公众平台**: https://mp.weixin.qq.com/
- **微信公众平台文档**: https://developers.weixin.qq.com/doc/offiaccount/en/Getting_Started/Getting_Started_Guide.html
- **OAuth 2.0 网页授权文档**: https://developers.weixin.qq.com/doc/offiaccount/en/OA_Web_Apps/Wechat_webpage_authorization.html
- **测试账号申请**: https://mp.weixin.qq.com/debug/cgi-bin/sandbox?t=jsapisign
- **ngrok**: https://ngrok.com/

## 常见问题

### Q: 订阅号可以使用 OAuth 2.0 吗？
A: 订阅号支持 OAuth 2.0 网页授权，但功能可能受限。建议使用服务号或测试账号。

### Q: 本地开发如何测试？
A: 使用 ngrok 等内网穿透工具，将本地地址映射到公网域名，然后在微信公众平台配置该域名。

### Q: AppSecret 忘记了怎么办？
A: 在"基本配置"页面点击"重置"，生成新的 AppSecret。注意：重置后旧的密钥将失效。

### Q: 需要企业认证吗？
A: 订阅号个人可以注册，但功能受限。服务号需要企业认证。开发测试建议使用测试账号。

### Q: 测试账号和正式账号有什么区别？
A: 测试账号功能完整，适合开发测试，但只能用于测试环境。正式账号可以用于生产环境。
