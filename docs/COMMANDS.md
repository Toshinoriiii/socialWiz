# 命令速查表

## 开发命令

### 启动开发服务器
```bash
pnpm dev
```
访问: http://localhost:3000

### 构建生产版本
```bash
pnpm build
```

### 启动生产服务器
```bash
pnpm start
```

### 代码检查
```bash
pnpm lint
```

## 数据库命令

### 生成 Prisma Client
```bash
pnpm db:generate
```

### 推送 Schema 到数据库 (开发环境)
```bash
pnpm db:push
```

### 创建迁移 (开发环境)
```bash
pnpm db:migrate
```

### 应用迁移 (生产环境)
```bash
pnpm db:migrate:deploy
```

### 打开 Prisma Studio
```bash
pnpm db:studio
```
访问: http://localhost:5555

### 填充种子数据
```bash
pnpm db:seed
```

## 部署命令

### 一键部署 (生产环境)
```bash
pnpm deploy
```

## Git 命令

### 初始化仓库
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/Toshinoriiii/socialWiz.git
git push -u origin main
```

### 提交代码
```bash
git add .
git commit -m "Your commit message"
git push
```

## 包管理命令

### 安装依赖
```bash
pnpm install
```

### 添加新依赖
```bash
pnpm add <package-name>
```

### 添加开发依赖
```bash
pnpm add -D <package-name>
```

### 更新依赖
```bash
pnpm update
```

### 删除依赖
```bash
pnpm remove <package-name>
```

## 测试命令 (待实现)

### 运行单元测试
```bash
# 待添加 Jest
pnpm test
```

### 运行 E2E 测试
```bash
# 待添加 Playwright
pnpm test:e2e
```

## 常用组合命令

### 完整重置数据库
```bash
# 删除数据库文件 (SQLite) 或手动清空 (PostgreSQL)
pnpm db:push --force-reset
pnpm db:seed
```

### 从零开始设置项目
```bash
pnpm install
cp .env.example .env.local
# 编辑 .env.local 配置数据库
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

### 准备生产部署
```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate:deploy
pnpm build
pnpm start
```

## API 测试命令

### 注册用户
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@123456",
    "name": "测试用户"
  }'
```

### 登录
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@123456"
  }'
```

### AI 文本生成
```bash
curl -X POST http://localhost:3000/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text",
    "prompt": "写一段关于AI的介绍",
    "model": "deepseek"
  }'
```

### 创建内容
```bash
curl -X POST http://localhost:3000/api/content \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "测试标题",
    "content": "测试内容",
    "userId": "USER_UUID"
  }'
```

## 环境变量

### 开发环境
```bash
# 使用 .env.local
cp .env.example .env.local
```

### 生产环境
```bash
# 设置环境变量或使用 .env.production
export DATABASE_URL="postgresql://..."
export REDIS_URL="redis://..."
export JWT_SECRET="..."
```

## 故障排查命令

### 检查 PostgreSQL 状态
```bash
# macOS
brew services list | grep postgresql

# Ubuntu
sudo systemctl status postgresql

# Windows
# 在服务管理器中查看
```

### 检查 Redis 状态
```bash
# macOS
brew services list | grep redis

# Ubuntu
sudo systemctl status redis

# Windows
# 在服务管理器中查看
```

### 检查端口占用
```bash
# Windows
netstat -ano | findstr :3000

# macOS/Linux
lsof -i :3000
```

### 清除 Next.js 缓存
```bash
rm -rf .next
pnpm dev
```

### 重新生成 node_modules
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## PM2 进程管理 (生产环境)

### 启动应用
```bash
pm2 start npm --name "socialwiz" -- start
```

### 查看状态
```bash
pm2 status
pm2 logs socialwiz
```

### 重启应用
```bash
pm2 restart socialwiz
```

### 停止应用
```bash
pm2 stop socialwiz
```

### 删除应用
```bash
pm2 delete socialwiz
```

### 开机自启动
```bash
pm2 startup
pm2 save
```

## Docker 命令 (待实现)

### 构建镜像
```bash
docker build -t socialwiz .
```

### 运行容器
```bash
docker run -p 3000:3000 socialwiz
```

### 使用 Docker Compose
```bash
docker-compose up -d
```
# 命令速查表

## 开发命令

### 启动开发服务器
```bash
pnpm dev
```
访问: http://localhost:3000

### 构建生产版本
```bash
pnpm build
```

### 启动生产服务器
```bash
pnpm start
```

### 代码检查
```bash
pnpm lint
```

## 数据库命令

### 生成 Prisma Client
```bash
pnpm db:generate
```

### 推送 Schema 到数据库 (开发环境)
```bash
pnpm db:push
```

### 创建迁移 (开发环境)
```bash
pnpm db:migrate
```

### 应用迁移 (生产环境)
```bash
pnpm db:migrate:deploy
```

### 打开 Prisma Studio
```bash
pnpm db:studio
```
访问: http://localhost:5555

### 填充种子数据
```bash
pnpm db:seed
```

## 部署命令

### 一键部署 (生产环境)
```bash
pnpm deploy
```

## Git 命令

### 初始化仓库
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/Toshinoriiii/socialWiz.git
git push -u origin main
```

### 提交代码
```bash
git add .
git commit -m "Your commit message"
git push
```

## 包管理命令

### 安装依赖
```bash
pnpm install
```

### 添加新依赖
```bash
pnpm add <package-name>
```

### 添加开发依赖
```bash
pnpm add -D <package-name>
```

### 更新依赖
```bash
pnpm update
```

### 删除依赖
```bash
pnpm remove <package-name>
```

## 测试命令 (待实现)

### 运行单元测试
```bash
# 待添加 Jest
pnpm test
```

### 运行 E2E 测试
```bash
# 待添加 Playwright
pnpm test:e2e
```

## 常用组合命令

### 完整重置数据库
```bash
# 删除数据库文件 (SQLite) 或手动清空 (PostgreSQL)
pnpm db:push --force-reset
pnpm db:seed
```

### 从零开始设置项目
```bash
pnpm install
cp .env.example .env.local
# 编辑 .env.local 配置数据库
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

### 准备生产部署
```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate:deploy
pnpm build
pnpm start
```

## API 测试命令

### 注册用户
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@123456",
    "name": "测试用户"
  }'
```

### 登录
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@123456"
  }'
```

### AI 文本生成
```bash
curl -X POST http://localhost:3000/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text",
    "prompt": "写一段关于AI的介绍",
    "model": "deepseek"
  }'
```

### 创建内容
```bash
curl -X POST http://localhost:3000/api/content \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "测试标题",
    "content": "测试内容",
    "userId": "USER_UUID"
  }'
```

## 环境变量

### 开发环境
```bash
# 使用 .env.local
cp .env.example .env.local
```

### 生产环境
```bash
# 设置环境变量或使用 .env.production
export DATABASE_URL="postgresql://..."
export REDIS_URL="redis://..."
export JWT_SECRET="..."
```

## 故障排查命令

### 检查 PostgreSQL 状态
```bash
# macOS
brew services list | grep postgresql

# Ubuntu
sudo systemctl status postgresql

# Windows
# 在服务管理器中查看
```

### 检查 Redis 状态
```bash
# macOS
brew services list | grep redis

# Ubuntu
sudo systemctl status redis

# Windows
# 在服务管理器中查看
```

### 检查端口占用
```bash
# Windows
netstat -ano | findstr :3000

# macOS/Linux
lsof -i :3000
```

### 清除 Next.js 缓存
```bash
rm -rf .next
pnpm dev
```

### 重新生成 node_modules
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## PM2 进程管理 (生产环境)

### 启动应用
```bash
pm2 start npm --name "socialwiz" -- start
```

### 查看状态
```bash
pm2 status
pm2 logs socialwiz
```

### 重启应用
```bash
pm2 restart socialwiz
```

### 停止应用
```bash
pm2 stop socialwiz
```

### 删除应用
```bash
pm2 delete socialwiz
```

### 开机自启动
```bash
pm2 startup
pm2 save
```

## Docker 命令 (待实现)

### 构建镜像
```bash
docker build -t socialwiz .
```

### 运行容器
```bash
docker run -p 3000:3000 socialwiz
```

### 使用 Docker Compose
```bash
docker-compose up -d
```
