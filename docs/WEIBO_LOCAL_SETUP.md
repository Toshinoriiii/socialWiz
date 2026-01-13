# 微博平台本地开发配置指南

## 问题说明

微博开放平台注册应用时，需要填写**网站地址**和**回调地址**。由于项目在本地运行（localhost），需要使用内网穿透工具将本地服务暴露到公网，以便微博 OAuth 回调能够正常工作。

## 解决方案

### 方案 1: 使用 ngrok（推荐）

ngrok 是最常用的内网穿透工具，提供稳定的 HTTPS 隧道。

#### 1. 安装 ngrok

**macOS:**
```bash
brew install ngrok
# 或
brew install ngrok/ngrok/ngrok
```

**Windows:**
- 访问 https://ngrok.com/download 下载
- 或使用 Chocolatey: `choco install ngrok`

**Linux:**
```bash
# 下载并解压
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar -xzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/
```

#### 2. 注册 ngrok 账号（免费）

1. 访问 https://dashboard.ngrok.com/signup 注册账号
2. 获取 authtoken（在 Dashboard → Getting Started）

#### 3. 配置 ngrok

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

#### 4. 启动本地开发服务器

```bash
pnpm dev
```

#### 5. 启动 ngrok 隧道

在另一个终端窗口运行：

```bash
ngrok http 3000
```

你会看到类似输出：
```
Forwarding  https://xxxx-xx-xx-xx-xx.ngrok-free.app -> http://localhost:3000
```

**重要**: 复制这个 HTTPS URL（例如：`https://xxxx-xx-xx-xx-xx.ngrok-free.app`）

#### 6. 配置微博开放平台

1. 访问 https://open.weibo.com/
2. 登录并进入"我的应用"
3. 创建新应用或编辑现有应用
4. 填写以下信息：
   - **网站地址**: `https://xxxx-xx-xx-xx-xx.ngrok-free.app`（你的 ngrok URL）
   - **回调地址**: `https://xxxx-xx-xx-xx-xx.ngrok-free.app/api/platforms/weibo/auth/callback`
   - **应用名称**: SocialWiz（或你喜欢的名称）
   - **应用描述**: 社交媒体统一管理平台

#### 7. 配置环境变量

在 `.env.local` 中添加：

```bash
# 微博配置
WEIBO_APP_KEY=你的App_Key
WEIBO_APP_SECRET=你的App_Secret
WEIBO_REDIRECT_URI=https://xxxx-xx-xx-xx-xx.ngrok-free.app/api/platforms/weibo/auth/callback

# Next.js 基础 URL（用于生成完整 URL）
NEXT_PUBLIC_BASE_URL=https://xxxx-xx-xx-xx-xx.ngrok-free.app
```

#### 8. 注意事项

- **免费版限制**: ngrok 免费版每次启动 URL 会变化，需要重新配置回调地址
- **付费版优势**: 付费版可以设置固定域名，避免每次更改配置
- **开发建议**: 开发阶段可以使用免费版，生产环境建议使用固定域名

---

### 方案 2: 使用 localtunnel（免费，无需注册）

localtunnel 是另一个免费的内网穿透工具，无需注册即可使用。

#### 1. 安装 localtunnel

```bash
npm install -g localtunnel
# 或
pnpm add -g localtunnel
```

#### 2. 启动本地开发服务器

```bash
pnpm dev
```

#### 3. 启动 localtunnel

在另一个终端窗口运行：

```bash
lt --port 3000
```

你会看到类似输出：
```
your url is: https://xxxx.loca.lt
```

#### 4. 配置微博开放平台

使用 `https://xxxx.loca.lt` 作为网站地址和回调地址基础。

**注意**: localtunnel 的 URL 每次也会变化，但比 ngrok 免费版更稳定。

---

### 方案 3: 使用 Cloudflare Tunnel（免费，固定域名）

Cloudflare Tunnel 提供免费的固定域名，适合长期开发。

#### 1. 安装 cloudflared

**macOS:**
```bash
brew install cloudflared
```

**其他平台**: 访问 https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

#### 2. 登录 Cloudflare

```bash
cloudflared tunnel login
```

#### 3. 创建隧道

```bash
cloudflared tunnel create socialwiz-dev
```

#### 4. 配置隧道

创建配置文件 `~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /Users/your-username/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: socialwiz-dev.your-domain.com
    service: http://localhost:3000
  - service: http_status:404
```

#### 5. 运行隧道

```bash
cloudflared tunnel run socialwiz-dev
```

---

### 方案 4: 使用临时占位符（仅用于注册）

如果只是注册应用，可以：

1. **网站地址**: 填写一个临时地址（如 `http://example.com`）
2. **回调地址**: 先填写 `http://localhost:3000/api/platforms/weibo/auth/callback`
3. 注册完成后，使用内网穿透工具，然后更新回调地址

**注意**: 这种方式在测试时仍需要使用内网穿透工具。

---

## 推荐配置流程

### 快速开始（使用 ngrok）

1. **安装 ngrok**:
   ```bash
   brew install ngrok  # macOS
   ```

2. **注册并配置**:
   ```bash
   ngrok config add-authtoken YOUR_TOKEN
   ```

3. **启动开发服务器**:
   ```bash
   pnpm dev
   ```

4. **启动 ngrok**（新终端）:
   ```bash
   ngrok http 3000
   ```

5. **复制 ngrok URL**（例如：`https://abc123.ngrok-free.app`）

6. **配置微博开放平台**:
   - 网站地址: `https://abc123.ngrok-free.app`
   - 回调地址: `https://abc123.ngrok-free.app/api/platforms/weibo/auth/callback`

7. **更新 `.env.local`**:
   ```bash
   WEIBO_APP_KEY=你的App_Key
   WEIBO_APP_SECRET=你的App_Secret
   WEIBO_REDIRECT_URI=https://abc123.ngrok-free.app/api/platforms/weibo/auth/callback
   NEXT_PUBLIC_BASE_URL=https://abc123.ngrok-free.app
   ```

8. **重启开发服务器**:
   ```bash
   pnpm dev
   ```

---

## 开发工作流

### 每次开发时

1. 启动开发服务器: `pnpm dev`
2. 启动 ngrok: `ngrok http 3000`
3. 如果 ngrok URL 变化，更新微博回调地址和 `.env.local`

### 使用固定域名（推荐）

如果经常开发，建议：

1. **购买 ngrok 付费版**（$8/月）获得固定域名
2. **或使用 Cloudflare Tunnel**（免费，需要域名）
3. **或使用其他内网穿透服务**（如 frp、nps 等）

---

## 常见问题

### Q: ngrok 免费版 URL 每次都会变化怎么办？

**A**: 每次变化后需要：
1. 更新微博开放平台的回调地址
2. 更新 `.env.local` 中的 `WEIBO_REDIRECT_URI` 和 `NEXT_PUBLIC_BASE_URL`
3. 重启开发服务器

### Q: 可以使用 localhost 吗？

**A**: 微博开放平台不支持 `localhost` 作为回调地址，必须使用公网可访问的 HTTPS 地址。

### Q: 开发完成后还需要 ngrok 吗？

**A**: 生产环境部署到服务器后，使用实际的域名和 HTTPS 证书，不再需要 ngrok。

### Q: 如何测试 OAuth 流程？

**A**: 
1. 确保 ngrok 正在运行
2. 访问测试页面: `http://localhost:3000/dashboard/test-weibo`
3. 点击"连接微博账号"
4. 完成授权后会自动回调

---

## 其他内网穿透工具

- **frp**: https://github.com/fatedier/frp（自建服务器）
- **nps**: https://github.com/ehang-io/nps（自建服务器）
- **serveo**: https://serveo.net/（SSH 隧道，无需安装）
- **localhost.run**: https://localhost.run/（SSH 隧道）

---

## 生产环境配置

生产环境部署后，使用实际域名：

```bash
WEIBO_REDIRECT_URI=https://yourdomain.com/api/platforms/weibo/auth/callback
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

并在微博开放平台更新回调地址为生产环境的地址。
