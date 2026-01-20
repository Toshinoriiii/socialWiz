# Quickstart Guide: AI Content Creation Workflow

**Date**: 2026-01-20  
**Purpose**: 快速开始指南,帮助开发者配置环境并测试 AI 内容创作工作流

## 前置条件

- Node.js 18+ 
- PostgreSQL 14+
- Redis 6+ (可选,用于缓存)
- Git

## 1. 环境配置

### 1.1 安装依赖

```bash
# 克隆项目 (如果还没有)
cd /Users/dengdeng/Documents/AI/socialWiz

# 安装 npm 依赖
npm install

# 安装 Mastra 相关依赖
npm install @mastra/core @mastra/memory @mastra/libsql @mastra/loggers

# 安装 Tavily SDK
npm install @tavily/core

# 安装其他工具
npm install zod
```

### 1.2 配置环境变量

创建或更新 `.env.local` 文件:

```bash
# 数据库
DATABASE_URL="postgresql://user:password@localhost:5432/socialwiz"

# Redis (可选)
REDIS_URL="redis://localhost:6379"

# Tavily API (Web 搜索)
TAVILY_API_KEY="tvly-xxxxxxxxxxxxxxxxxxxxxxxxxx"

# Stability AI API (图片生成)
STABILITY_API_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxxxx"

# AI 模型 (DeepSeek)
DEEPSEEK_API_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxxxx"

# Next.js
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

### 1.3 获取 API Keys

#### Tavily API Key
1. 访问 [https://tavily.com/](https://tavily.com/)
2. 注册账号并登录
3. 在 Dashboard 中获取 API Key
4. 新用户有免费额度

#### Stability AI API Key
1. 访问 [https://platform.stability.ai/](https://platform.stability.ai/)
2. 注册账号并登录
3. 在 Account 页面获取 API Key
4. 新用户有 25 free credits

### 1.4 数据库迁移

```bash
# 生成 Prisma Client
npx prisma generate

# 运行数据库迁移
npx prisma migrate dev --name add_content_generation_models

# (可选) 查看数据库
npx prisma studio
```

---

## 2. 开发与测试

### 2.1 项目结构

```
socialWiz/
├── mastra/
│   ├── agents/
│   │   ├── web-search-agent.ts         # Web 搜索 Agent
│   │   ├── content-creation-agent.ts   # 内容创作 Agent
│   │   └── image-prompt-agent.ts       # 图片提示词 Agent
│   ├── tools/
│   │   ├── web-search-tool.ts          # Web 搜索 Tool
│   │   └── image-generation-tool.ts    # 图片生成 Tool
│   ├── workflows/
│   │   └── content-creation-workflow.ts # 内容创作 Workflow
│   └── index.ts                        # Mastra 实例
├── lib/
│   ├── services/
│   │   ├── content-generation.service.ts
│   │   └── workflow-execution.service.ts
│   └── utils/
│       └── mcp-client.ts
├── app/api/
│   ├── content/
│   │   └── generate/
│   │       └── route.ts                # 内容生成 API
│   └── workflow/
│       └── status/
│           └── route.ts                # Workflow 状态 API
└── types/
    ├── content-generation.types.ts
    └── workflow.types.ts
```

### 2.2 测试单个 Tool

创建测试文件 `mastra/tools/__tests__/web-search-tool.test.ts`:

```typescript
import { webSearchTool } from '../web-search-tool'

async function testWebSearchTool() {
  try {
    const result = await webSearchTool.execute({
      context: {
        query: '春节营销活动创意',
        maxResults: 5
      }
    })
    
    console.log('Search Results:', JSON.stringify(result, null, 2))
  } catch (error) {
    console.error('Test failed:', error)
  }
}

testWebSearchTool()
```

运行测试:

```bash
npx tsx mastra/tools/__tests__/web-search-tool.test.ts
```

### 2.3 测试单个 Agent

创建测试文件 `mastra/agents/__tests__/content-creation-agent.test.ts`:

```typescript
import { mastra } from '../../index'

async function testContentCreationAgent() {
  const agent = mastra.getAgent('contentCreationAgent')
  
  if (!agent) {
    console.error('Agent not found')
    return
  }
  
  const response = await agent.stream([
    {
      role: 'user',
      content: `基于以下搜索结果,为微博平台创作一条春节营销活动文案:
      
      搜索结果:
      - 春节是中国最重要的传统节日
      - 2026年春节在2月1日
      - 春节营销活动应该结合传统文化和现代元素
      
      要求:
      - 字数在140字以内
      - 轻松幽默的风格
      - 包含2-3个话题标签`
    }
  ])
  
  console.log('Generated Content:')
  for await (const chunk of response.textStream) {
    process.stdout.write(chunk)
  }
  console.log('\n')
}

testContentCreationAgent()
```

运行测试:

```bash
npx tsx mastra/agents/__tests__/content-creation-agent.test.ts
```

### 2.4 测试完整 Workflow

创建测试文件 `mastra/workflows/__tests__/content-creation-workflow.test.ts`:

```typescript
import { mastra } from '../../index'

async function testContentCreationWorkflow() {
  const workflow = mastra.getWorkflow('content-creation-workflow')
  
  if (!workflow) {
    console.error('Workflow not found')
    return
  }
  
  console.log('Starting workflow...')
  
  const input = {
    prompt: '春节营销活动创意',
    platform: 'weibo' as const,
    style: '轻松幽默',
    requestId: 'test-request-001',
    userId: 'test-user-001'
  }
  
  try {
    const result = await workflow.execute(input)
    
    console.log('\nWorkflow Result:')
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error('Workflow failed:', error)
  }
}

testContentCreationWorkflow()
```

运行测试:

```bash
npx tsx mastra/workflows/__tests__/content-creation-workflow.test.ts
```

---

## 3. API 测试

### 3.1 启动开发服务器

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动

### 3.2 使用 cURL 测试 API

#### 创建内容生成任务

```bash
curl -X POST http://localhost:3000/api/content/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-session-cookie" \
  -d '{
    "prompt": "春节营销活动创意",
    "platform": "weibo",
    "style": "轻松幽默"
  }'
```

#### 查询任务状态

```bash
curl -X GET http://localhost:3000/api/content/generate/clx1234567890 \
  -H "Cookie: session=your-session-cookie"
```

#### 流式监听进度 (SSE)

```bash
curl -N http://localhost:3000/api/content/generate/clx1234567890/stream \
  -H "Cookie: session=your-session-cookie"
```

### 3.3 使用 Postman/Insomnia

1. 导入 API 端点:
   - POST `/api/content/generate`
   - GET `/api/content/generate/:requestId`
   - GET `/api/content/generate/:requestId/stream`

2. 设置认证 Cookie 或 Authorization header

3. 发送请求并查看响应

---

## 4. 前端集成

### 4.1 创建内容生成面板组件

```typescript
// components/dashboard/ContentGenerationPanel.tsx

'use client'

import { useState } from 'react'

export function ContentGenerationPanel() {
  const [prompt, setPrompt] = useState('')
  const [platform, setPlatform] = useState('generic')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  
  const handleGenerate = async () => {
    setLoading(true)
    
    try {
      const res = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, platform })
      })
      
      const data = await res.json()
      
      if (data.success) {
        // 开始轮询状态或使用 SSE
        pollStatus(data.data.requestId)
      }
    } catch (error) {
      console.error('Failed to generate content:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const pollStatus = async (requestId: string) => {
    // 轮询或使用 EventSource 监听 SSE
    const eventSource = new EventSource(`/api/content/generate/${requestId}/stream`)
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.event === 'completed') {
        setResult(data.data.content)
        eventSource.close()
      }
    }
  }
  
  return (
    <div>
      <textarea 
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="输入内容主题..."
      />
      
      <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
        <option value="generic">通用</option>
        <option value="weibo">微博</option>
        <option value="wechat">微信</option>
      </select>
      
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? '生成中...' : 'AI 生成'}
      </button>
      
      {result && (
        <div>
          <h3>生成结果:</h3>
          <p>{result.body}</p>
          {result.imageUrl && <img src={result.imageUrl} alt="Generated" />}
        </div>
      )}
    </div>
  )
}
```

---

## 5. 调试技巧

### 5.1 查看 Mastra 日志

Mastra 使用 Pino Logger,可以通过环境变量调整日志级别:

```bash
# .env.local
LOG_LEVEL=debug  # 可选: trace, debug, info, warn, error
```

### 5.2 查看 Workflow 执行记录

```bash
npx prisma studio
```

在 Prisma Studio 中查看:
- `WorkflowExecution` 表 - Workflow 执行记录
- `WorkflowStepExecution` 表 - Step 执行详情

### 5.3 使用 Mastra Observability

Mastra 内置了 observability 功能:

```typescript
// mastra/index.ts
export const mastra = new Mastra({
  // ...
  observability: {
    default: { enabled: true }
  }
})
```

这将记录所有 Agent 和 Tool 的调用,方便调试。

---

## 6. 常见问题

### Q1: Tavily API 报错 "Invalid API Key"
**A**: 检查 `.env.local` 中的 `TAVILY_API_KEY` 是否正确设置,确保没有多余的空格或引号。

### Q2: Stability AI API 返回 429 Too Many Requests
**A**: API 配额用完或请求过于频繁。检查账户余额或等待一段时间后重试。

### Q3: Workflow 一直卡在 "RUNNING" 状态
**A**: 检查:
1. 外部 API 是否正常响应
2. 是否有 Step 超时
3. 查看 `WorkflowStepExecution` 表找到卡住的 Step

### Q4: 生成的内容质量不佳
**A**: 优化 Agent 的 instructions:
1. 提供更详细的上下文
2. 增加示例 (few-shot learning)
3. 调整搜索结果的质量和数量

---

## 7. 下一步

- ✅ 实现所有 Agents 和 Tools
- ✅ 实现 Workflow
- ✅ 实现 API 端点
- ✅ 创建前端组件
- [ ] 添加单元测试
- [ ] 添加集成测试
- [ ] 性能优化
- [ ] 部署到生产环境

---

## 8. 参考资源

- [Mastra Documentation](https://mastra.ai/docs)
- [Tavily API Docs](https://docs.tavily.com)
- [Stability AI API Docs](https://platform.stability.ai/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Prisma Documentation](https://www.prisma.io/docs)

---

**快速开始指南完成日期**: 2026-01-20  
**下一步**: 运行 `/speckit.tasks` 生成详细任务清单
