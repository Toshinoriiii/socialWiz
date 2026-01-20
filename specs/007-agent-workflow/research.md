# Research: AI Content Creation Workflow

**Date**: 2026-01-20  
**Purpose**: 研究 Web 搜索 API、生图服务、Mastra 框架最佳实践,为实现 AI 内容创作工作流提供技术决策支持

## 1. Web 搜索 API 选择

### 研究对象
- 阿里云百炼 MCP 搜索服务
- Tavily API
- Google Custom Search API
- Bing Search API

### Decision: 阿里云百炼 MCP 搜索服务

**Rationale**:
1. **已有服务资源**: 项目已有阿里云百炼 MCP 服务,无需额外采购
2. **MCP 协议标准**: 遵循 Model Context Protocol 标准,与 Mastra 框架兼容性好
3. **远程部署**: MCP 客户端已在远程部署,通过 HTTP API 调用即可,无需本地安装 SDK
4. **统一服务商**: 搜索和生图使用同一服务商,简化管理和认证
5. **成本优势**: 使用已有资源,降低额外成本

**集成方式**:
- 调用方式: HTTP API (远程调用已部署的 MCP 客户端)
- 认证方式: API Key (通过环境变量 `ALIYUN_BAILIAN_MCP_API_KEY`)
- 端点配置: 通过环境变量 `ALIYUN_BAILIAN_MCP_SEARCH_URL` 配置

**使用示例**:
```typescript
// lib/utils/aliyun-bailian-mcp-client.ts
const searchResult = await fetch(process.env.ALIYUN_BAILIAN_MCP_SEARCH_URL!, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.ALIYUN_BAILIAN_MCP_API_KEY}`
  },
  body: JSON.stringify({
    query: "春节营销活动创意",
    maxResults: 5
  })
})

const data = await searchResult.json()
```

**Alternatives Considered**:
- **Tavily API**: 专为 AI Agent 设计,但需要额外付费,且增加外部依赖
- **Google Custom Search API**: 更成熟,但需要额外配置搜索引擎 ID,定价较高 (每 1000 次查询 $5)
- **Bing Search API**: Microsoft Azure 服务,需要 Azure 账号,定价复杂

---

## 2. 生图服务选择

### 研究对象
- 阿里云百炼 MCP 生图服务
- Stability AI API (Stable Diffusion)
- OpenAI DALL-E API
- Replicate API

### Decision: 阿里云百炼 MCP 生图服务

**Rationale**:
1. **已有服务资源**: 项目已有阿里云百炼 MCP 服务,无需额外采购
2. **统一服务商**: 与搜索服务使用同一平台,简化集成、认证和运维
3. **MCP 协议标准**: 遵循 Model Context Protocol 标准,与 Mastra 框架兼容
4. **远程部署**: MCP 客户端已在远程部署,通过 HTTP API 调用即可
5. **减少外部依赖**: 不需要集成多个第三方服务,降低系统复杂度和故障点

**集成方式**:
- 调用方式: HTTP API (远程调用已部署的 MCP 客户端)
- 认证方式: API Key (通过环境变量 `ALIYUN_BAILIAN_MCP_API_KEY`)
- 端点配置: 通过环境变量 `ALIYUN_BAILIAN_MCP_IMAGE_URL` 配置

**使用示例**:
```typescript
// lib/utils/aliyun-bailian-mcp-client.ts
const imageResult = await fetch(process.env.ALIYUN_BAILIAN_MCP_IMAGE_URL!, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.ALIYUN_BAILIAN_MCP_API_KEY}`
  },
  body: JSON.stringify({
    prompt: imagePrompt,
    aspect_ratio: '1:1', // 或 '16:9', '9:16'
    output_format: 'png'
  })
})

const data = await imageResult.json()
const imageUrl = data.url
```

**MCP 架构优势**:
- MCP 客户端已在远程部署,负责与底层模型服务通信
- 应用层只需通过标准 HTTP API 调用,无需关心底层实现细节
- 便于后续切换或升级底层模型,不影响应用代码

**图片存储方案**:
- **Phase 1 (MVP)**: 直接返回阿里云百炼 MCP 服务的图片 URL,由前端展示
- **Phase 2**: 将生成的图片下载并存储到阿里云 OSS 或其他云存储
- 数据库存储图片 URL 和元数据

**Alternatives Considered**:
- **Stability AI API**: 性价比高,但需要额外付费,且增加外部依赖
- **OpenAI DALL-E**: 质量好但价格较高 ($0.016-0.020/图),且需要 OpenAI API key
- **Replicate**: 支持多种模型,但 API 调用较复杂,价格不透明
- **本地 Stable Diffusion**: 免费但需要 GPU 资源,部署复杂

---

## 3. Mastra Workflow 最佳实践

### 3.1 Workflow 架构

**推荐架构**: 使用 Mastra 的 `createWorkflow` 和 `createStep` 构建流水线

```typescript
const contentCreationWorkflow = createWorkflow({
  id: 'content-creation-workflow',
  inputSchema: z.object({
    prompt: z.string(),
    platform: z.enum(['weibo', 'wechat']).optional(),
  }),
  outputSchema: z.object({
    content: z.string(),
    imageUrl: z.string(),
  }),
})
  .then(webSearchStep)           // Step 1: Web 搜索
  .then(contentCreationStep)      // Step 2: 内容创作
  .then(imagePromptStep)          // Step 3: 图片提示词生成
  .then(imageGenerationStep)      // Step 4: 图片生成
  .then(contentMixStep)           // Step 5: 混合输出
```

**Key Points**:
- 每个 Step 都有明确的 input/output schema (使用 Zod)
- Steps 之间通过 `inputData` 传递数据
- 可以通过 `mastra` 参数访问其他 Agents

### 3.2 错误处理机制

**基于 Mastra 官方文档的最佳实践**:

1. **Step-level Retry 配置**:
```typescript
const searchStep = createStep({
  id: 'web-search',
  retries: 3,          // 失败后重试 3 次
  retryDelay: 2000,    // 每次重试间隔 2 秒
  execute: async ({ inputData }) => {
    // 实现逻辑
  }
})
```

2. **Workflow-level Retry 配置**:
```typescript
const workflow = createWorkflow({
  id: 'content-creation',
  retryConfig: {
    attempts: 5,
    delay: 2000
  }
})
```

3. **条件分支处理错误**:
```typescript
const handleSearchError = createStep({
  id: 'handle-search-error',
  execute: async ({ getStepResult }) => {
    const searchResult = getStepResult('web-search')
    if (!searchResult || searchResult.error) {
      // 返回默认内容或使用缓存
      return { results: [] }
    }
    return searchResult
  }
})
```

4. **Try-Catch 内部错误处理**:
```typescript
execute: async ({ inputData }) => {
  try {
    const result = await externalAPICall()
    return result
  } catch (error) {
    console.error('API call failed:', error)
    // 返回 fallback 数据
    return { success: false, data: null }
  }
}
```

5. **使用 `bail()` 提前退出**:
```typescript
if (conditionMet) {
  return bail({ reason: 'Condition already satisfied' })
}
```

6. **监控 Workflow 错误**:
```typescript
const execution = await workflow.execute(input)
if (execution.status === 'failed') {
  console.error('Workflow failed:', execution.error)
}
```

### 3.3 流式输出实现

**基于 Mastra 的 Streaming 功能**:

1. **Agent 流式输出**:
```typescript
const agent = mastra.getAgent('contentCreationAgent')
const response = await agent.stream([
  { role: 'user', content: prompt }
])

for await (const chunk of response.textStream) {
  process.stdout.write(chunk) // 实时输出
}
```

2. **Workflow Step 中使用 writer**:
```typescript
const streamingStep = createStep({
  id: 'streaming-content',
  execute: async ({ inputData, writer }) => {
    const agent = mastra.getAgent('contentCreationAgent')
    const stream = await agent.stream([...])
    
    // 将 Agent 输出通过 writer 传递
    for await (const chunk of stream.textStream) {
      await writer.write({
        type: 'content-chunk',
        data: chunk
      })
    }
    
    return { content: fullContent }
  }
})
```

3. **前端接收流式数据 (Next.js Route Handler)**:
```typescript
// app/api/content/generate/route.ts
export async function POST(req: Request) {
  const { prompt } = await req.json()
  
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const execution = await workflow.execute({ prompt })
      
      // 监听 workflow 事件
      for await (const event of execution.stream) {
        const data = JSON.stringify(event)
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }
      
      controller.close()
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    }
  })
}
```

### 3.4 Workflow 状态持久化

**使用 Mastra 的 Storage**:
```typescript
const mastra = new Mastra({
  storage: new LibSQLStore({
    url: 'file:./mastra.db' // 持久化到本地数据库
  })
})
```

**在 Prisma 中存储 Workflow 执行记录**:
```prisma
model WorkflowExecution {
  id          String   @id @default(cuid())
  workflowId  String
  userId      String
  status      WorkflowStatus
  input       Json
  output      Json?
  error       String?
  startedAt   DateTime @default(now())
  completedAt DateTime?
  
  user User @relation(fields: [userId], references: [id])
  
  @@index([userId])
  @@index([workflowId])
}

enum WorkflowStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}
```

### 3.5 并发和性能优化

**Mastra 并发处理**:
- Mastra 本身支持并发执行多个 Workflow
- 每个 Workflow 执行是独立的,不会互相阻塞
- 对于 10+ 并发请求,Mastra + Next.js 应该足够

**队列机制 (如果需要)**:
- **Phase 1 (MVP)**: 不需要队列,直接执行 Workflow
- **Phase 2 (如果遇到并发瓶颈)**: 考虑使用 Bull/BullMQ + Redis 实现队列
  - 将内容生成请求放入队列
  - Worker 进程从队列中取任务并执行 Workflow
  - 前端轮询或使用 WebSocket 获取状态更新

**性能优化建议**:
1. **缓存搜索结果**: 对相同的搜索查询使用 Redis 缓存 (TTL: 1 小时)
2. **并行执行独立 Steps**: 如果未来有多个独立的任务,可以使用 `Promise.all()`
3. **Lazy Loading Agents**: 只在需要时加载 Agent,避免启动时加载所有 Agents
4. **图片异步处理**: 图片生成可以异步进行,先返回文案内容

---

## 4. 技术栈总结

### 核心依赖

| 技术 | 版本 | 用途 |
|------|------|------|
| Mastra Core | latest | Agent/Workflow 框架 |
| 阿里云百炼 MCP | - | Web 搜索 + 图片生成服务 |
| Zod | latest | Schema 验证 |
| LibSQLStore | latest | Mastra Memory 存储 |

### 环境变量配置

```bash
# .env.local
# 阿里云百炼 MCP 服务配置
ALIYUN_BAILIAN_MCP_API_KEY=your-api-key-here
ALIYUN_BAILIAN_MCP_SEARCH_URL=https://your-mcp-endpoint/search
ALIYUN_BAILIAN_MCP_IMAGE_URL=https://your-mcp-endpoint/image-generation

# MCP 服务超时设置 (可选)
ALIYUN_BAILIAN_MCP_TIMEOUT=30000
```

---

## 5. 实现路线图

### Phase 1: MVP (P1 - 核心功能)
- ✅ Web Search Tool + Agent
- ✅ Content Creation Agent
- ✅ Image Prompt Agent
- ✅ Image Generation Tool
- ✅ Content Creation Workflow
- ✅ 基本错误处理 (retry 机制)
- ✅ API 端点实现

### Phase 2: 增强功能 (P2)
- 多平台适配 (微博、微信)
- 流式输出到前端
- Workflow 状态查询 API
- 内容历史记录存储

### Phase 3: 优化 (P3)
- 搜索结果缓存
- 图片存储到云端
- 内容迭代优化功能
- 队列机制 (如果需要)

---

## 6. 风险与缓解措施

### 风险 1: 阿里云百炼 MCP 服务失败或超时
**缓解措施**:
- 使用 Mastra 的 retry 机制 (3-5 次重试)
- 设置合理的超时时间 (30-60s)
- 实现降级策略:搜索失败时使用缓存或默认内容
- 提供清晰的错误提示给用户
- 监控 MCP 服务的可用性和响应时间

### 风险 2: 生成内容质量不佳
**缓解措施**:
- 优化 Agent 的 instructions 和 prompts
- 使用高质量的搜索结果作为上下文
- 提供内容重新生成功能

### 风险 3: 阿里云百炼 MCP 服务配额限制
**缓解措施**:
- 监控 MCP API 使用量
- 实现简单的 rate limiting
- 在配额接近上限时提前告警
- 与阿里云团队沟通扩容方案

### 风险 4: 并发性能瓶颈
**缓解措施**:
- 从小规模开始,逐步扩展
- 监控服务器资源使用情况
- 必要时引入队列机制

---

## 7. 下一步行动

1. ✅ 创建 `data-model.md` - 定义数据模型
2. ✅ 创建 `contracts/` - 定义 API 契约
3. ✅ 创建 `quickstart.md` - 快速开始指南
4. 开始实现 Agents 和 Tools
5. 实现 Workflow
6. 实现 API 端点
7. 前端集成
8. 测试与优化

---

**研究完成日期**: 2026-01-20  
**下一阶段**: Phase 1 - Design & Contracts
