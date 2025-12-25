# 快速开始指南

## 环境准备

### 1. 系统要求

- Node.js 18+ 
- PostgreSQL 14+
- Redis 6+
- pnpm (推荐) 或 npm/yarn

### 2. 安装数据库

#### PostgreSQL

**Windows (使用 Chocolatey):**
```bash
choco install postgresql
```

**macOS (使用 Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

#### Redis

**Windows (使用 Chocolatey):**
```bash
choco install redis-64
```

**macOS (使用 Homebrew):**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt install redis-server
sudo systemctl start redis
```

## 项目设置

### 1. 克隆项目

```bash
git clone https://github.com/Toshinoriiii/socialWiz.git
cd socialWiz
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

复制环境变量模板:

```bash
cp .env.example .env.local
```

编辑 `.env.local` 文件,配置以下必需项:

```env
# 数据库连接 (必需)
DATABASE_URL="postgresql://用户名:密码@localhost:5432/socialwiz"

# Redis连接 (必需)
REDIS_URL="redis://localhost:6379"

# JWT密钥 (必需,请修改为随机字符串)
JWT_SECRET="your-random-secret-key-here"
ENCRYPTION_KEY="your-random-encryption-key-here"

# AI API密钥 (可选,根据需要配置)
DEEPSEEK_API_KEY="sk-xxx"
QWEN_API_KEY="sk-xxx"
OPENAI_API_KEY="sk-xxx"
```

**生成随机密钥的方法:**

```bash
# 使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 或使用 OpenSSL
openssl rand -hex 32
```

### 4. 初始化数据库

生成 Prisma Client:

```bash
pnpm db:generate
```

推送数据库 Schema:

```bash
pnpm db:push
```

填充种子数据 (可选):

```bash
pnpm db:seed
```

**种子数据包含:**
- 测试用户账号: `test@socialwiz.com` / `Test@123456`
- 4个示例平台账号
- 3条示例内容

### 5. 启动开发服务器

```bash
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000)

## 功能测试

### 1. 用户注册/登录

访问 `/login` 或 `/register` 页面进行用户注册。

如果运行了种子脚本,可以使用测试账号:
- 邮箱: `test@socialwiz.com`
- 密码: `Test@123456`

### 2. API测试

#### 注册用户

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123",
    "name": "测试用户"
  }'
```

#### 登录

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123"
  }'
```

#### AI文本生成

```bash
curl -X POST http://localhost:3000/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text",
    "prompt": "写一篇关于AI的文章",
    "model": "deepseek"
  }'
```

### 3. 数据库管理

使用 Prisma Studio 可视化管理数据库:

```bash
pnpm db:studio
```

访问 [http://localhost:5555](http://localhost:5555)

## 常见问题

### 数据库连接失败

**错误**: `Can't reach database server`

**解决方案**:
1. 检查 PostgreSQL 服务是否运行
2. 验证 `DATABASE_URL` 配置是否正确
3. 确认数据库已创建:
   ```sql
   CREATE DATABASE socialwiz;
   ```

### Redis连接失败

**错误**: `Error connecting to Redis`

**解决方案**:
1. 检查 Redis 服务是否运行
2. 验证 `REDIS_URL` 配置是否正确
3. Windows用户确保 Redis 已安装并启动

### Prisma Client未生成

**错误**: `@prisma/client did not initialize yet`

**解决方案**:
```bash
pnpm db:generate
```

### 端口被占用

**错误**: `Port 3000 is already in use`

**解决方案**:
1. 停止占用端口的程序
2. 或使用其他端口:
   ```bash
   PORT=3001 pnpm dev
   ```

## 下一步

- 📖 阅读完整 [API文档](../README.md#api文档)
- 🔧 配置 [AI模型密钥](../config/ai.config.ts)
- 🚀 查看 [部署指南](#生产环境部署)

## 生产环境部署

### 快速部署

项目提供了一键部署脚本:

```bash
# 确保已配置 .env.local
pnpm deploy
```

### 手动部署步骤

1. **安装依赖**
   ```bash
   pnpm install --frozen-lockfile
   ```

2. **生成 Prisma Client**
   ```bash
   pnpm db:generate
   ```

3. **数据库迁移**
   ```bash
   pnpm db:migrate:deploy
   ```

4. **构建项目**
   ```bash
   pnpm build
   ```

5. **启动服务**
   ```bash
   pnpm start
   ```

### 使用 PM2 管理进程

安装 PM2:
```bash
npm install -g pm2
```

启动应用:
```bash
pm2 start npm --name "socialwiz" -- start
pm2 save
pm2 startup
```

### Nginx 反向代理配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 技术支持

遇到问题? 

- 📧 提交 [GitHub Issue](https://github.com/Toshinoriiii/socialWiz/issues)
- 📖 查看完整文档: [README.md](../README.md)
# 快速开始指南

## 环境准备

### 1. 系统要求

- Node.js 18+ 
- PostgreSQL 14+
- Redis 6+
- pnpm (推荐) 或 npm/yarn

### 2. 安装数据库

#### PostgreSQL

**Windows (使用 Chocolatey):**
```bash
choco install postgresql
```

**macOS (使用 Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

#### Redis

**Windows (使用 Chocolatey):**
```bash
choco install redis-64
```

**macOS (使用 Homebrew):**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt install redis-server
sudo systemctl start redis
```

## 项目设置

### 1. 克隆项目

```bash
git clone https://github.com/Toshinoriiii/socialWiz.git
cd socialWiz
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

复制环境变量模板:

```bash
cp .env.example .env.local
```

编辑 `.env.local` 文件,配置以下必需项:

```env
# 数据库连接 (必需)
DATABASE_URL="postgresql://用户名:密码@localhost:5432/socialwiz"

# Redis连接 (必需)
REDIS_URL="redis://localhost:6379"

# JWT密钥 (必需,请修改为随机字符串)
JWT_SECRET="your-random-secret-key-here"
ENCRYPTION_KEY="your-random-encryption-key-here"

# AI API密钥 (可选,根据需要配置)
DEEPSEEK_API_KEY="sk-xxx"
QWEN_API_KEY="sk-xxx"
OPENAI_API_KEY="sk-xxx"
```

**生成随机密钥的方法:**

```bash
# 使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 或使用 OpenSSL
openssl rand -hex 32
```

### 4. 初始化数据库

生成 Prisma Client:

```bash
pnpm db:generate
```

推送数据库 Schema:

```bash
pnpm db:push
```

填充种子数据 (可选):

```bash
pnpm db:seed
```

**种子数据包含:**
- 测试用户账号: `test@socialwiz.com` / `Test@123456`
- 4个示例平台账号
- 3条示例内容

### 5. 启动开发服务器

```bash
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000)

## 功能测试

### 1. 用户注册/登录

访问 `/login` 或 `/register` 页面进行用户注册。

如果运行了种子脚本,可以使用测试账号:
- 邮箱: `test@socialwiz.com`
- 密码: `Test@123456`

### 2. API测试

#### 注册用户

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123",
    "name": "测试用户"
  }'
```

#### 登录

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123"
  }'
```

#### AI文本生成

```bash
curl -X POST http://localhost:3000/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text",
    "prompt": "写一篇关于AI的文章",
    "model": "deepseek"
  }'
```

### 3. 数据库管理

使用 Prisma Studio 可视化管理数据库:

```bash
pnpm db:studio
```

访问 [http://localhost:5555](http://localhost:5555)

## 常见问题

### 数据库连接失败

**错误**: `Can't reach database server`

**解决方案**:
1. 检查 PostgreSQL 服务是否运行
2. 验证 `DATABASE_URL` 配置是否正确
3. 确认数据库已创建:
   ```sql
   CREATE DATABASE socialwiz;
   ```

### Redis连接失败

**错误**: `Error connecting to Redis`

**解决方案**:
1. 检查 Redis 服务是否运行
2. 验证 `REDIS_URL` 配置是否正确
3. Windows用户确保 Redis 已安装并启动

### Prisma Client未生成

**错误**: `@prisma/client did not initialize yet`

**解决方案**:
```bash
pnpm db:generate
```

### 端口被占用

**错误**: `Port 3000 is already in use`

**解决方案**:
1. 停止占用端口的程序
2. 或使用其他端口:
   ```bash
   PORT=3001 pnpm dev
   ```

## 下一步

- 📖 阅读完整 [API文档](../README.md#api文档)
- 🔧 配置 [AI模型密钥](../config/ai.config.ts)
- 🚀 查看 [部署指南](#生产环境部署)

## 生产环境部署

### 快速部署

项目提供了一键部署脚本:

```bash
# 确保已配置 .env.local
pnpm deploy
```

### 手动部署步骤

1. **安装依赖**
   ```bash
   pnpm install --frozen-lockfile
   ```

2. **生成 Prisma Client**
   ```bash
   pnpm db:generate
   ```

3. **数据库迁移**
   ```bash
   pnpm db:migrate:deploy
   ```

4. **构建项目**
   ```bash
   pnpm build
   ```

5. **启动服务**
   ```bash
   pnpm start
   ```

### 使用 PM2 管理进程

安装 PM2:
```bash
npm install -g pm2
```

启动应用:
```bash
pm2 start npm --name "socialwiz" -- start
pm2 save
pm2 startup
```

### Nginx 反向代理配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 技术支持

遇到问题? 

- 📧 提交 [GitHub Issue](https://github.com/Toshinoriiii/socialWiz/issues)
- 📖 查看完整文档: [README.md](../README.md)
