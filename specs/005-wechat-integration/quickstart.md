# Quickstart Guide: 微信公众号平台接入

**Feature**: 005-wechat-integration  
**Date**: 2026-01-17  
**Target**: 开发者快速启动和测试微信公众号接入功能

## 前提条件

### 1. 系统要求

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- pnpm包管理器

### 2. 微信测试账号

您需要一个微信公众号测试账号或正式公众号：

- **测试账号**（推荐用于开发）：[申请地址](https://mp.weixin.qq.com/debug/cgi-bin/sandbox?t=sandbox/login)
- **正式公众号**：需要在微信公众平台注册

⚠️ **注意**：个人主体公众号不支持发布功能，仅企业主体支持。

## 快速启动（5分钟）

### Step 1: 启动依赖服务

确保 PostgreSQL 和 Redis 正在运行：

```bash
# 检查PostgreSQL
psql -U postgres -c "SELECT version();"

# 检查Redis
redis-cli ping
# 应返回: PONG
```

如果没有安装，请参考[环境配置文档](../../docs/GETTING_STARTED.md)。

### Step 2: 数据库迁移

```bash
# 进入项目根目录
cd c:\CodeField\socialwiz

# 生成Prisma客户端
pnpm db:generate

# 推送Schema到数据库（开发环境）
pnpm db:push

# 或使用迁移（生产环境）
# pnpm db:migrate
```

### Step 3: 配置环境变量

复制并编辑`.env`文件：

```bash
# 复制示例文件
cp .env.example .env
```

**必需配置**：

```env
# 数据库连接
DATABASE_URL="postgresql://user:password@localhost:5432/socialwiz?schema=public"

# Redis连接
REDIS_URL="redis://localhost:6379"

# JWT密钥
JWT_SECRET="your-jwt-secret-key"

# 加密密钥（用于加密AppSecret）
ENCRYPTION_KEY="your-32-character-hex-key-here"
```

**生成加密密钥**：

```bash
# 使用Node.js生成32字节随机密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 4: 启动开发服务器

```bash
# 安装依赖（如果还没有安装）
pnpm install

# 启动开发服务器
pnpm dev
```

服务器将在 `http://localhost:3000` 启动。

### Step 5: 访问测试页面

打开浏览器访问：

```
http://localhost:3000/test-wechat
```

## 配置微信公众号（10分钟）

### Step 1: 获取AppID和AppSecret

1. 登录[微信公众平台](https://mp.weixin.qq.com/)或[测试账号页面](https://mp.weixin.qq.com/debug/cgi-bin/sandbox?t=sandbox/login)
2. 进入"开发" → "基本配置"
3. 记录以下信息：
   - **AppID**（开发者ID）
   - **AppSecret**（开发者密码）

### Step 2: 配置IP白名单

⚠️ **重要**：必须配置服务器IP白名单，否则无法调用微信API

**获取本机公网IP**：

```bash
# Windows PowerShell
(Invoke-WebRequest -Uri "https://api.ipify.org").Content

# Linux/Mac
curl https://api.ipify.org
```

**配置步骤**：

1. 在微信公众平台，进入"开发" → "基本配置"
2. 找到"IP白名单"，点击"修改"
3. 添加您的公网IP地址（例如：123.456.789.012）
4. 保存并生效

### Step 3: 配置安全域名（可选）

如果使用非localhost域名，需要配置安全域名：

1. 在微信公众平台，进入"设置与开发" → "公众号设置" → "功能设置"
2. 找到"JS接口安全域名"，点击"设置"
3. 添加您的域名（例如：`your-domain.com`）
4. 下载验证文件并上传到网站根目录

## 测试流程（5分钟）

### 1. 添加公众号配置

在测试页面（http://localhost:3000/test-wechat）：

1. 点击"添加微信公众号"按钮
2. 填写表单：
   - **AppID**: `wx1234567890abcdef`
   - **AppSecret**: `a1b2c3d4e5f6...`
   - **公众号名称**（可选）: `测试公众号`
3. 点击"验证并保存"
4. 等待验证结果（约1-2秒）

**成功响应**：
```json
{
  "config": {
    "id": "a1b2c3d4-...",
    "appId": "wx1234****cdef",
    "accountName": "测试公众号",
    "canPublish": true,
    "isActive": true
  },
  "message": "配置验证成功并已保存"
}
```

### 2. 查看配置列表

```bash
# 使用curl测试
curl -X GET http://localhost:3000/api/wechat/config \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. 测试Token获取

Token由系统自动管理，您可以在Redis中查看：

```bash
# 连接Redis
redis-cli

# 查看所有微信token
KEYS wechat:token:*

# 查看特定token
GET wechat:token:user123:config456
```

### 4. 测试内容发布（需要media_id）

⚠️ **注意**：本次迭代仅支持纯文字，图片上传功能后续实现。

```bash
# 发布内容（需要先获取thumb_media_id）
curl -X POST http://localhost:3000/api/wechat/publish \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "configId": "a1b2c3d4-...",
    "title": "测试文章",
    "author": "测试作者",
    "content": "<p>这是测试内容</p>",
    "thumbMediaId": "your_media_id_here"
  }'
```

## 常见问题

### Q1: 配置验证失败，提示"40164: invalid ip"

**原因**: IP白名单未配置或配置错误

**解决**:
1. 确认您的公网IP地址
2. 在微信公众平台配置IP白名单
3. 注意：必须配置**公网IP**，不能使用域名

### Q2: 提示"40001: invalid credential"

**原因**: AppID或AppSecret错误

**解决**:
1. 检查AppID和AppSecret是否复制正确
2. 确认没有多余的空格或换行
3. 如果修改过AppSecret，需要重新配置

### Q3: Token获取成功，但发布失败"48001: api unauthorized"

**原因**: 个人主体公众号不支持发布功能

**解决**:
- 使用企业主体公众号
- 或使用测试账号（测试账号支持所有接口）

### Q4: 如何查看详细的错误日志？

开发模式下，错误日志会输出到控制台：

```bash
# 查看Next.js服务器日志
# 在运行pnpm dev的终端查看
```

生产模式下，配置日志系统（如Winston）。

### Q5: 如何测试Token自动刷新？

**方法1：修改Redis TTL**

```bash
# 连接Redis
redis-cli

# 设置token为即将过期（剩余10秒）
EXPIRE wechat:token:user123:config456 10

# 等待10秒后调用API，系统会自动刷新token
```

**方法2：修改刷新阈值**

在`lib/services/wechat-token.service.ts`中临时修改阈值：

```typescript
// 将300秒改为6000秒（测试用）
const REFRESH_THRESHOLD = 6000 * 1000
```

## API测试集合

### Postman/Thunder Client配置

导入以下环境变量：

```json
{
  "baseUrl": "http://localhost:3000/api",
  "authToken": "your_jwt_token",
  "userId": "your_user_id",
  "configId": "your_config_id"
}
```

### 测试场景

**1. 创建配置**:
- Method: `POST`
- URL: `{{baseUrl}}/wechat/config`
- Headers: `Authorization: Bearer {{authToken}}`
- Body:
  ```json
  {
    "appId": "wx1234567890abcdef",
    "appSecret": "a1b2c3d4e5f67890...",
    "accountName": "测试公众号"
  }
  ```

**2. 获取配置列表**:
- Method: `GET`
- URL: `{{baseUrl}}/wechat/config`
- Headers: `Authorization: Bearer {{authToken}}`

**3. 更新配置**:
- Method: `PUT`
- URL: `{{baseUrl}}/wechat/config/{{configId}}`
- Headers: `Authorization: Bearer {{authToken}}`
- Body:
  ```json
  {
    "accountName": "更新后的名称"
  }
  ```

**4. 删除配置**:
- Method: `DELETE`
- URL: `{{baseUrl}}/wechat/config/{{configId}}`
- Headers: `Authorization: Bearer {{authToken}}`

## 调试技巧

### 1. 启用详细日志

在`lib/services/wechat-token.service.ts`中添加：

```typescript
console.log('[Token Service] Getting token for:', { userId, configId })
console.log('[Token Service] Cache hit:', cacheHit)
console.log('[Token Service] Token expires at:', expiresAt)
```

### 2. 监控Redis

实时监控Redis命令：

```bash
# 开启Redis监控
redis-cli MONITOR
```

### 3. 检查数据库

使用Prisma Studio查看数据：

```bash
# 启动Prisma Studio
pnpm db:studio

# 打开浏览器访问 http://localhost:5555
```

## 下一步

- ✅ 完成基本配置和测试
- ⏭️ 实现图片上传功能（获取media_id）
- ⏭️ 实现完整的内容发布流程
- ⏭️ 添加前端配置页面
- ⏭️ 编写单元测试和集成测试

## 参考文档

- [微信公众号API文档](https://developers.weixin.qq.com/doc/offiaccount/Getting_Started/Overview.html)
- [Feature规范](./spec.md)
- [技术调研](./research.md)
- [数据模型](./data-model.md)
- [API契约](./contracts/wechat-api.yaml)
- [配置指引](./WECHAT_CONFIG_GUIDE.md)

## 需要帮助？

如果遇到问题：

1. 检查[常见问题](#常见问题)部分
2. 查看控制台错误日志
3. 参考[配置指引](./WECHAT_CONFIG_GUIDE.md)
4. 联系开发团队

---

**Happy Coding! 🚀**
