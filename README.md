# SocialWiz - 多智能体社交媒体统一管理平台

> 集成多种国产AI大模型的社交媒体统一管理平台

## 📋 项目概述

SocialWiz 是一个功能强大的社交媒体统一管理平台，支持多平台账号管理、AI智能内容生成、一键多平台发布和全方位数据分析。

### 核心功能

- ✅ **用户管理**: 用户注册、登录，多平台账号绑定管理
- ✅ **AI内容生成**: 集成DeepSeek、Qwen等多种 AI模型，智能生成文本和图片
- 🎉 **AI工作流** (新): 基于 Mastra 的多 Agent 内容创作工作流
  - 自动联网搜索 + 文案生成 + 配图生成 + 图文混合
  - 实时流式输出，工作流步骤可视化
  - 集成阿里云百炼 MCP 服务 (搜索 + 生图)
- ✅ **内容发布**: 支持立即发布和定时发布，一键多平台分发
- ✅ **数据分析**: 多维度数据统计，AI智能分析，可视化图表展示
- ✅ **日程管理**: 可视化日历，发布计划管理

### 支持平台

- 微信公众号
- 微博
- 抖音
- 小红书

## 🛠️ 技术栈

### 前端

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **UI**: Tailwind CSS + Stylus
- **状态管理**: Zustand
- **表单处理**: React Hook Form + Zod
- **图标**: Ant Design Icons
- **图表**: ECharts
- **轮播**: Swiper

### 后端

- **框架**: Next.js API Routes / Server Actions
- **数据库**: PostgreSQL (Prisma ORM)
- **缓存**: Redis
- **任务队列**: Bull
- **认证**: JWT (jsonwebtoken + bcryptjs)

### AI集成

- **文本生成**:
  - DeepSeek V3
  - Qwen (通义千问)
- **图片生成**:
  - DALL-E 3 / Stable Diffusion
  - 阿里云百炼 MCP (通义万相)
- **AI 工作流**:
  - Mastra Framework (Agent + Workflow)
  - 阿里云百炼 MCP (搜索 + 生图)

## 🚀 快速开始

### 环境要求

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- pnpm (推荐)

### 快速安装

```bash
# 1. 克隆项目
git clone https://github.com/Toshinoriiii/socialWiz.git
cd socialWiz

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填写数据库和Redis连接信息

# 4. 初始化数据库
pnpm db:generate
pnpm db:push
pnpm db:seed  # 可选:填充测试数据

# 5. 启动开发服务器
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000)

**详细指南**: 查看 [快速开始文档](docs/GETTING_STARTED.md)

**微博平台接入**: 查看 [微博本地开发配置指南](docs/WEIBO_LOCAL_SETUP.md)（包含内网穿透配置）

## 📁 项目结构

```
socialwiz/
├── app/                    # Next.js App Router
│   ├── (auth)/            # 认证路由
│   ├── (dashboard)/       # 主应用路由
│   ├── api/               # API Routes
│   └── globals.css        # 全局样式
├── components/            # React组件
├── config/                # 配置文件
├── lib/                   # 核心逻辑库
│   ├── db/               # 数据库连接
│   ├── services/         # 业务服务
│   ├── integrations/     # 第三方集成
│   ├── ai/               # AI集成
│   └── utils/            # 工具函数
├── mastra/                # Mastra AI 工作流 (新)
│   ├── agents/           # AI Agents
│   ├── mcp/              # MCP 客户端
│   └── workflows/        # 工作流定义
├── prisma/                # Prisma数据库
├── stores/                # Zustand状态管理
├── types/                 # TypeScript类型
└── public/                # 静态资源
```

## 🔑 环境变量说明

| 变量名 | 说明 | 必需 |
|--------|------|------|
| DATABASE_URL | PostgreSQL连接字符串 | 是 |
| REDIS_URL | Redis连接字符串 | 是 |
| JWT_SECRET | JWT密钥 | 是 |
| ENCRYPTION_KEY | 加密密钥 | 是 |
| DEEPSEEK_API_KEY | DeepSeek API密钥 | 否 |
| QWEN_API_KEY | Qwen API密钥 | 否 |
| OPENAI_API_KEY | OpenAI API密钥 | 否 |
| **ALIYUN_BAILIAN_MCP_API_KEY** | 阿里云百炼 MCP API密钥 | AI工作流 |
| **ALIYUN_BAILIAN_MCP_SEARCH_URL** | 百炼 MCP 搜索服务 URL | AI工作流 |
| **ALIYUN_BAILIAN_MCP_IMAGE_URL** | 百炼 MCP 生图服务 URL | AI工作流 |

## 📝 开发进度

### ✅ 已完成 (阶段1-8核心功能)

- [x] **阶段1**: 项目初始化和基础配置
- [x] **阶段2**: 类型定义和配置文件
- [x] **阶段3**: 核心工具库和服务层
- [x] **阶段4**: 通用UI组件库 (Button, Input, Modal, Card等)
- [x] **阶段5**: 用户认证模块 (登录/注册页面和API)
- [x] **阶段6**: 主应用布局和首页 (Dashboard布局)
- [x] **阶段7**: AI模型集成层 (DeepSeek, Qwen, 图片生成)
- [x] **阶段8**: 内容发布模块 (服务层和API完成)
- [x] **阶段15**: 文档和部署准备 (优先完成)
- [x] **🎉 AI工作流** (新): Mastra 多 Agent 内容创作工作流 (MVP 初步完成)
  - ✅ 5步骤工作流: 搜索 → 文案 → 提示词 → 生图 → 混合
  - ✅ 流式输出实时显示
  - ✅ 工作流步骤可视化
  - ✅ MCP 服务集成 (阿里云百炼)

### 🚧 待开发 (阶段9-14)

- [ ] **阶段9**: 社交平台集成 (微信、微博、抖音、小红书)
- [ ] **阶段10**: 定时发布和任务队列
- [ ] **阶段11**: 数据分析模块
- [ ] **阶段12**: 日程管理模块
- [ ] **阶段13**: 账户设置模块
- [ ] **阶段14**: 测试和优化

**详细进度**: 查看 [项目状态文档](docs/PROJECT_STATUS.md)

### 📌 核心功能说明

当前已实现的功能可满足基础使用:
- ✅ 用户注册、登录、JWT认证
- ✅ 内容创建、编辑、删除（API层）
- ✅ AI文本生成（DeepSeek/Qwen/OpenAI）
- ✅ AI图片生成（DALL-E 3/Stable Diffusion）
- ✅ 内容发布服务（多平台、定时发布、重试机制）
- ⚠️ 社交平台集成需要自行实现OAuth和发布接口

### 🎉 AI工作流特性 (新)

基于 **Mastra Framework** 的多 Agent 内容创作工作流，实现一键生成图文内容：

**工作流步骤**:
1. 🔍 **联网搜索**: 自动搜索相关背景信息 (阿里云百炼 MCP)
2. ✍️ **文案生成**: AI生成专业文案 (1500-2500字)
3. 🎨 **图片提示词**: 智能生成配图提示词
4. 🖼️ **图片生成**: 自动调用生图服务 (阿里云百炼 MCP)
5. 🎉 **图文混合**: 整合文案和图片，输出完整内容

**特色功能**:
- ✅ 实时流式输出，看到生成过程
- ✅ 工作流步骤可视化，点击查看详情
- ✅ 完成后自动收起，界面简洁
- ✅ 图片代理服务，支持图片预览
- ✅ Markdown 渲染，格式优美

**使用方式**:
- 访问 `/ai-chat` 页面
- 输入内容主题（如：“写一篇关于AI技术的文章”）
- 系统自动执行 5 步工作流
- 实时查看生成过程
- 获得完整的图文内容，可直接发布

## 📸 功能截图

### AI 工作流界面

- 实时流式输出
- 工作流步骤可视化
- 最终结果展示

(截图待添加)

## 📚 相关文档

- [AI 工作流详细设计](/specs/007-agent-workflow/spec.md)
- [快速开始指南](docs/GETTING_STARTED.md)
- [项目状态文档](docs/PROJECT_STATUS.md)
- [微博平台配置](docs/WEIBO_LOCAL_SETUP.md)

## 📝 环境配置说明

### AI 工作流配置

需要在 `.env.local` 中配置阿里云百炼 MCP 相关变量：

```bash
# 阿里云百炼 MCP 配置
ALIYUN_BAILIAN_MCP_API_KEY=your_api_key_here
ALIYUN_BAILIAN_MCP_SEARCH_URL=https://your-search-url
ALIYUN_BAILIAN_MCP_IMAGE_URL=https://your-image-url

# Mastra AI 模型配置
DEEPSEEK_API_KEY=your_deepseek_key  # 用于文案生成
```

**获取 API Key**:
1. 访问 [阿里云百炼控制台](https://bailian.console.aliyun.com/)
2. 创建 MCP 应用
3. 获取 API Key 和服务 URL
4. 配置到 `.env.local`

## 📖 API文档

### 认证API

#### POST /api/auth/register
用户注册

```json
// Request Body
{
  "email": "user@example.com",
  "password": "password123",
  "name": "用户名"
}

// Response
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "用户名",
    "avatar": null
  },
  "token": "jwt-token"
}
```

#### POST /api/auth/login
用户登录

```json
// Request Body
{
  "email": "user@example.com",
  "password": "password123"
}

// Response
{
  "user": { ... },
  "token": "jwt-token"
}
```

### 内容管理API

#### GET /api/content
获取内容列表

```
Query Parameters:
- userId: 用户ID (必需)
- status: 内容状态 (DRAFT|PUBLISHED|SCHEDULED)
- skip: 跳过数量 (分页)
- take: 获取数量 (分页)

Response:
{
  "data": [
    {
      "id": "uuid",
      "title": "标题",
      "content": "内容",
      "status": "DRAFT",
      "createdAt": "2024-01-01T00:00:00Z",
      "contentPlatforms": [...]
    }
  ],
  "total": 100
}
```

#### POST /api/content
创建内容

```json
{
  "title": "标题",
  "content": "内容正文",
  "coverImage": "https://...",
  "userId": "user-uuid",
  "platformIds": ["platform-uuid-1", "platform-uuid-2"],
  "scheduledAt": "2024-12-31T12:00:00Z"  // 可选,定时发布
}
```

### 发布API

#### POST /api/publish
发布内容到平台

```json
{
  "contentId": "content-uuid",
  "platformIds": ["platform-uuid-1", "platform-uuid-2"],
  "scheduledAt": "2024-12-31T12:00:00Z"  // 可选,定时发布
}
```

### AI生成API

#### POST /api/ai/generate
生成AI内容

```json
// 文本生成
{
  "type": "text",
  "prompt": "写一篇关于AI的文章",
  "model": "deepseek",  // deepseek | qwen | openai
  "stream": true  // 是否流式响应
}

// 图片生成
{
  "type": "image",
  "prompt": "一只可爱的猫",
  "size": "1024x1024",
  "model": "dall-e-3"  // dall-e-3 | stable-diffusion
}
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

ISC License

## 👥 作者

由设计文档驱动开发

---

**注意**: 本项目正在积极开发中，部分功能尚未完成。
