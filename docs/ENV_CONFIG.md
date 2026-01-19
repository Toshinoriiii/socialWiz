# 环境变量配置说明

## 统一使用 .env.local

本项目已配置为统一使用 `.env.local` 文件来管理环境变量，这样 Prisma 和 Next.js 都可以从同一个文件读取配置。

## 配置方式

### 1. 创建环境变量文件

在项目根目录创建 `.env.local` 文件：

```bash
cp .env.example .env.local
```

### 2. 配置必需的环境变量

编辑 `.env.local` 文件，配置以下必需项：

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

## 工作原理

### Next.js
Next.js 默认会加载 `.env.local` 文件，无需额外配置。

### Prisma
Prisma 默认只读取 `.env` 文件，本项目通过以下方式统一使用 `.env.local`：

1. **Prisma CLI 命令**：使用 `dotenv-cli` 包装所有 Prisma 命令，指定从 `.env.local` 加载环境变量
   ```json
   "db:generate": "dotenv -e .env.local -- prisma generate"
   ```

2. **脚本文件**：所有 TypeScript 脚本在开头导入 `lib/utils/env-loader.ts`，自动加载 `.env.local`

### 向后兼容

如果 `.env.local` 不存在，系统会自动尝试加载 `.env` 文件作为备用方案。

## 可用的 npm 脚本

所有数据库相关的命令都已配置为使用 `.env.local`：

```bash
# 生成 Prisma Client
pnpm db:generate

# 推送数据库 Schema
pnpm db:push

# 数据库迁移（开发环境）
pnpm db:migrate

# 数据库迁移（生产环境）
pnpm db:migrate:deploy

# 打开 Prisma Studio
pnpm db:studio

# 填充种子数据
pnpm db:seed

# 查看数据库数据
pnpm db:view
```

## 注意事项

1. **`.env.local` 文件不应提交到 Git**：已在 `.gitignore` 中配置
2. **生产环境**：建议使用环境变量注入（如 Vercel、Docker 等）而不是文件
3. **团队协作**：可以提交 `.env.example` 作为模板，团队成员复制后创建自己的 `.env.local`

## 故障排查

如果遇到环境变量加载问题：

1. 确认 `.env.local` 文件存在于项目根目录
2. 检查环境变量名称是否正确（注意大小写）
3. 确认 `dotenv` 和 `dotenv-cli` 已安装：
   ```bash
   npm install --save-dev dotenv dotenv-cli
   ```
