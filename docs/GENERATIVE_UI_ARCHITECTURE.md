# SocialWiz 生成式 UI 架构设计

> 本文档详细描述 SocialWiz 项目的生成式 UI（Generative UI）方案设计与实现

## 目录

1. [概述](#概述)
2. [核心理念](#核心理念)
3. [技术栈](#技术栈)
4. [架构设计](#架构设计)
5. [实现细节](#实现细节)
6. [AI Elements 组件库](#ai-elements-组件库)
7. [流式协议规范](#流式协议规范)
8. [使用示例](#使用示例)
9. [最佳实践](#最佳实践)

---

## 概述

### 什么是生成式 UI？

生成式 UI 是一种由 AI 驱动的用户界面范式，它能够：

- **动态生成 UI 组件**：根据 AI 的响应内容实时渲染不同的 UI 组件
- **流式渲染**：AI 生成内容的同时，UI 以流式方式逐步呈现
- **交互式反馈**：支持用户在 AI 生成过程中进行交互和确认
- **结构化展示**：将非结构化的 AI 输出转换为结构化的 UI 组件

### 应用场景

在 SocialWiz 中，生成式 UI 主要应用于：

1. **AI 内容创作工作流**
   - 意图识别展示
   - 工作流步骤可视化
   - 实时进度反馈
   - 最终结果卡片

2. **Human-in-the-Loop 交互**
   - 工作流暂停与用户确认
   - 动态决策按钮
   - 分支流程选择

3. **多模态内容展示**
   - 文本 + 图片混合渲染
   - Markdown 内容美化
   - 代码块语法高亮

---

## 核心理念

### 1. 流式优先（Streaming-First）

所有 AI 生成内容均采用流式输出，避免长时间等待：

```typescript
// 后端使用 createUIMessageStream 创建流
const stream = createUIMessageStream({
  originalMessages: messages,
  execute: async ({ writer }) => {
    writer.write({ type: 'text-start', id: textId })
    
    for await (const chunk of aiStream) {
      writer.write({ type: 'text-delta', id: textId, delta: chunk })
    }
    
    writer.write({ type: 'text-end', id: textId })
  }
})
```

### 2. 结构化标记（Structured Markers）

使用 HTML 注释标记来标识特殊内容区域，前端解析后渲染为对应组件：

```markdown
<!--STEP:web-search:START:running-->
步骤 1/2: 联网搜索
<!--STEP:web-search:INPUT-->
```json
{ "query": "AI技术发展" }
```
<!--STEP:web-search:INPUT:END-->
<!--STEP:web-search:OUTPUT:STREAMING-->
搜索结果...
<!--STEP:web-search:OUTPUT:STREAMING:END-->
<!--STEP:web-search:END:completed-->
```

### 3. 渐进式增强（Progressive Enhancement）

- 基础层：普通 Markdown 渲染
- 增强层：识别标记后渲染专用组件
- 交互层：支持用户操作和工作流控制

---

## 技术栈

### 前端技术

| 技术 | 用途 | 版本 |
|------|------|------|
| React | UI 框架 | 18.x |
| Next.js | 全栈框架 | 14.x |
| Vercel AI SDK | AI 流式处理 | 最新 |
| ReactMarkdown | Markdown 渲染 | 9.x |
| shadcn/ui | UI 组件库 | 最新 |
| Tailwind CSS | 样式方案 | 3.x |

### 后端技术

| 技术 | 用途 |
|------|------|
| Vercel AI SDK | 流式响应协议 |
| Mastra | Agent 框架 |
| Next.js API Routes | 后端 API |

---

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (Frontend)                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          AI Chat Page (ai-chat/page.tsx)            │   │
│  │                                                       │   │
│  │  • useChat() hook                                    │   │
│  │  • 消息状态管理                                        │   │
│  │  • 工作流 Resume 处理                                  │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                         │
│                     │ 消息内容检测                             │
│                     ↓                                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │      WorkflowMessageRenderer.tsx (内容解析器)         │   │
│  │                                                       │   │
│  │  • 解析特殊标记 (STEP, INTENT, FINAL_RESULT)         │   │
│  │  • 提取工作流状态 (runId, stepId)                     │   │
│  │  • 渲染对应组件                                        │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                         │
│         ┌───────────┴───────────┬─────────────┐              │
│         ↓                       ↓             ↓              │
│  ┌──────────┐          ┌──────────────┐  ┌──────────┐       │
│  │WorkflowStep│         │FinalResultCard│ │Confirmation│     │
│  │  .tsx     │          │    .tsx      │  │  Button   │     │
│  │           │          │              │  │           │     │
│  │• 可折叠   │          │• 复制按钮    │  │• 配图选择  │     │
│  │• 输入输出 │          │• 字数统计    │  │           │     │
│  └──────────┘          └──────────────┘  └──────────┘       │
│                                                               │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        │ HTTP Request (streaming)
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                     后端 API (Backend)                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           POST /api/chat (route.ts)                  │   │
│  │                                                       │   │
│  │  • 处理流式请求                                        │   │
│  │  • 意图识别                                            │   │
│  │  • 工作流路由                                          │   │
│  │  • Resume 处理                                        │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                         │
│         ┌───────────┴───────────┬─────────────┐              │
│         ↓                       ↓             ↓              │
│  ┌─────────────┐      ┌──────────────┐  ┌──────────┐        │
│  │executeContent│     │executeSocial │  │executeImage│       │
│  │CreationWorkflow│   │MediaPost     │  │Generation  │       │
│  │InStream       │    │InStream      │  │InStream    │       │
│  └───────┬───────┘    └──────┬───────┘  └─────┬──────┘       │
│          │                   │                │              │
│          └───────────────────┴────────────────┘              │
│                              │                                │
│                              ↓                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         createUIMessageStream (流式输出)             │   │
│  │                                                       │   │
│  │  writer.write({ type: 'text-delta', ... })          │   │
│  │  • 生成特殊标记                                       │   │
│  │  • 控制流式节奏                                       │   │
│  │  • 插入暂停点                                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 数据流

```
用户输入
   ↓
意图识别 (Intent Recognition)
   ↓
工作流选择
   ↓
┌─────────────────┐
│  步骤 1: 搜索   │ ← 流式输出 + WorkflowStep 组件
├─────────────────┤
│  步骤 2: 生成   │ ← 流式输出 + WorkflowStep 组件
├─────────────────┤
│  暂停等待确认   │ ← Confirmation Button
└─────────────────┘
   ↓ (用户确认)
┌─────────────────┐
│  步骤 3: 配图   │ ← 流式输出 + WorkflowStep 组件
├─────────────────┤
│  步骤 4: 混合   │ ← 流式输出 + WorkflowStep 组件
├─────────────────┤
│  最终结果       │ ← FinalResultCard 组件
└─────────────────┘
```

---

## 实现细节

### 1. 流式消息协议

#### 后端发送（Vercel AI SDK 格式）

```typescript
// 1. 开始文本块
writer.write({ type: 'text-start', id: textId })

// 2. 流式发送内容片段
writer.write({ 
  type: 'text-delta', 
  id: textId, 
  delta: '这是一段文本'
})

// 3. 结束文本块
writer.write({ type: 'text-end', id: textId })
```

#### 前端接收（useChat hook）

```typescript
const { messages, sendMessage, status } = useChat({
  api: '/api/chat',
  onFinish: (message) => {
    console.log('消息完成:', message)
  }
})

// messages 结构
// message.parts: [{ type: 'text', text: '...' }]
```

### 2. 特殊标记系统

#### 意图识别标记

```markdown
<!--INTENT_RECOGNITION_START-->
**意图**: `article-creation-workflow`
**置信度**: 95%
**原因**: 用户请求撰写文章
<!--INTENT_RECOGNITION_END-->
```

#### 工作流步骤标记

```markdown
<!--STEP:{stepId}:START:{status}-->
步骤标题
<!--STEP:{stepId}:INPUT-->
输入参数 (JSON)
<!--STEP:{stepId}:INPUT:END-->
<!--STEP:{stepId}:OUTPUT:STREAMING-->
流式输出内容...
<!--STEP:{stepId}:OUTPUT:STREAMING:END-->
<!--STEP:{stepId}:END:{status}-->
```

**状态类型**：
- `pending`: 等待执行
- `running`: 正在执行
- `completed`: 执行完成
- `error`: 执行失败

#### 工作流暂停标记

```markdown
<!--WORKFLOW_SUSPENDED:{runId}:{stepId}-->
```

#### 最终结果标记

```markdown
<!--FINAL_RESULT_START-->
最终生成的内容...
<!--FINAL_RESULT_END-->
```

### 3. 前端解析器

#### WorkflowMessageRenderer 核心逻辑

```typescript
export function WorkflowMessageRenderer({ content, onResumeWorkflow }) {
  // 1. 提取意图识别
  const intentMatch = content.match(
    /<!--INTENT_RECOGNITION_START-->(.*?)<!--INTENT_RECOGNITION_END-->/s
  )
  
  // 2. 解析工作流步骤
  const stepRegex = /<!--STEP:([^:]+):START:([^>]+)-->(.*?)(?:<!--STEP:\1:END:([^>]+)-->|$)/gs
  const steps = Array.from(content.matchAll(stepRegex))
  
  // 3. 提取 workflow suspended 信息
  const suspendedMatch = content.match(/<!--WORKFLOW_SUSPENDED:([^:]+):([^>]+)-->/)
  
  // 4. 提取最终结果
  const finalResultMatch = content.match(
    /<!--FINAL_RESULT_START-->(.*?)<!--FINAL_RESULT_END-->/s
  )
  
  // 5. 渲染组件
  return (
    <div>
      {intentRecognition && <IntentBadge />}
      {steps.map(step => <WorkflowStep {...step} />)}
      {needsConfirmation && <ConfirmationButtons />}
      {finalResult && <FinalResultCard content={finalResult} />}
    </div>
  )
}
```

### 4. 工作流暂停与恢复

#### 后端暂停工作流

```typescript
// 1. 生成唯一 runId
const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

// 2. 保存工作流状态到内存
global.workflowRunData[runId] = {
  workflowType: 'content-creation',
  prompt,
  searchResults,
  fullContent,
  stepId: 'human-confirmation'
}

// 3. 发送暂停标记
writer.write({
  type: 'text-delta',
  id: textId,
  delta: `<!--WORKFLOW_SUSPENDED:${runId}:${stepId}-->`
})

// 4. 结束流
writer.write({ type: 'text-end', id: textId })
```

#### 前端恢复工作流

```typescript
const handleResumeWorkflow = async (runId, stepId, resumeData) => {
  // 发送 resume 请求
  sendMessage(
    { text: '需要配图' },
    {
      body: {
        resumeWorkflow: {
          runId,
          stepId,
          resumeData
        }
      }
    }
  )
}
```

#### 后端处理 Resume

```typescript
async function handleWorkflowResume(resumeInfo, messages) {
  // 1. 从内存中恢复工作流数据
  const runData = global.workflowRunData[resumeInfo.runId]
  
  // 2. 根据用户选择继续执行
  if (resumeData.needImages) {
    // 执行配图流程
    await executeImageGeneration(...)
  } else {
    // 跳过配图，直接输出
    await outputFinalResult(...)
  }
  
  // 3. 清理已使用的数据
  delete global.workflowRunData[resumeInfo.runId]
}
```

---

## AI Elements 组件库

本项目包含一套完整的 AI 交互组件库，位于 `components/ai-elements/`：

### 核心组件列表

| 组件 | 用途 | 特性 |
|------|------|------|
| **artifact.tsx** | AI 生成的独立内容单元 | 版本管理、独立展示 |
| **chain-of-thought.tsx** | 思维链展示 | 可折叠、逐步推理 |
| **code-block.tsx** | 代码块展示 | 语法高亮、复制功能 |
| **confirmation.tsx** | 用户确认组件 | 按钮组、加载状态 |
| **image.tsx** | AI 生成图片展示 | 懒加载、占位符 |
| **loader.tsx** | 加载动画 | 多种样式 |
| **message.tsx** | 聊天消息容器 | 角色区分、附件支持 |
| **plan.tsx** | 计划/步骤展示 | 可折叠、进度追踪 |
| **prompt-input.tsx** | 提示词输入框 | 附件上传、快捷操作 |
| **reasoning.tsx** | 推理过程展示 | 实时流式、时长统计 |
| **task.tsx** | 任务项展示 | 状态管理、文件引用 |
| **tool.tsx** | 工具调用展示 | 参数展示、结果显示 |
| **sources.tsx** | 信息来源展示 | 引用列表、跳转链接 |
| **suggestion.tsx** | 快捷建议按钮 | 一键填充 |

### WorkflowStep 组件详解

**位置**: `components/dashboard/WorkflowStep.tsx`

**功能**：
- 展示工作流单个步骤
- 支持展开/收起
- 显示输入参数和输出结果
- 状态图标和徽章

**Props**:
```typescript
interface WorkflowStepProps {
  title: string              // 步骤标题
  status: StepStatus         // 'pending' | 'running' | 'completed' | 'error'
  input?: React.ReactNode    // 输入参数
  output?: React.ReactNode   // 输出结果
  error?: string             // 错误信息
  defaultOpen?: boolean      // 是否默认展开
}
```

**自动行为**：
- `running` 状态自动展开
- `completed` 状态自动收起
- `error` 状态保持展开

### FinalResultCard 组件详解

**位置**: `components/dashboard/FinalResultCard.tsx`

**功能**：
- 展示最终生成内容
- 一键复制功能
- 字数统计
- Markdown 完整渲染

**特性**：
- 使用 shadcn/ui Card 组件
- 自定义 Markdown 样式
- 响应式布局

---

## 流式协议规范

### 协议格式

使用 Vercel AI SDK 的 `createUIMessageStream` API：

```typescript
type StreamEvent = 
  | { type: 'text-start', id: string }
  | { type: 'text-delta', id: string, delta: string }
  | { type: 'text-end', id: string }
```

### 工作流步骤输出规范

```markdown
<!--STEP:{stepId}:START:{status}-->
{步骤标题}
<!--STEP:{stepId}:INPUT-->
```json
{输入参数的JSON}
```
<!--STEP:{stepId}:INPUT:END-->

<!--STEP:{stepId}:OUTPUT:STREAMING-->
{流式输出的内容...}
<!--STEP:{stepId}:OUTPUT:STREAMING:END-->

<!--STEP:{stepId}:OUTPUT-->
{最终输出结果}
<!--STEP:{stepId}:OUTPUT:END-->

<!--STEP:{stepId}:END:{status}-->
```

### 意图识别输出规范

```markdown
<!--INTENT_RECOGNITION_START-->
**意图**: `{intent-type}`  
**置信度**: {confidence}%  
**原因**: {reasoning}
<!--INTENT_RECOGNITION_END-->
```

### 最终结果输出规范

```markdown
<!--FINAL_RESULT_START-->
# 标题

正文内容...

![图片](url)

<!--FINAL_RESULT_END-->
```

---

## 使用示例

### 示例 1: 创建简单的流式工作流

**后端代码**:
```typescript
async function executeMyWorkflow(writer, textId, prompt) {
  // 步骤 1
  const step1Id = 'search'
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step1Id}:START:running-->步骤 1: 搜索\n`
  })
  
  // 调用 Agent 流式输出
  const stream = await myAgent.stream([{ role: 'user', content: prompt }])
  
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step1Id}:OUTPUT:STREAMING-->`
  })
  
  for await (const chunk of stream.textStream) {
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: chunk
    })
  }
  
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step1Id}:OUTPUT:STREAMING:END-->\n<!--STEP:${step1Id}:END:completed-->\n\n`
  })
  
  // 最终结果
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: '<!--FINAL_RESULT_START-->\n结果内容\n<!--FINAL_RESULT_END-->'
  })
  
  writer.write({ type: 'text-end', id: textId })
}
```

**前端代码**:
```typescript
// ai-chat/page.tsx
const { messages } = useChat({ api: '/api/chat' })

messages.map(message => {
  const content = getMessageContent(message)
  const hasWorkflowMarker = content.includes('<!--STEP:')
  
  return hasWorkflowMarker ? (
    <WorkflowMessageRenderer content={content} />
  ) : (
    <ReactMarkdown>{content}</ReactMarkdown>
  )
})
```

### 示例 2: 添加 Human-in-the-Loop

**后端暂停工作流**:
```typescript
// 生成 runId
const runId = `run_${Date.now()}`

// 保存状态
global.workflowRunData[runId] = { prompt, intermediateResults }

// 发送暂停标记
writer.write({
  type: 'text-delta',
  id: textId,
  delta: `<!--WORKFLOW_SUSPENDED:${runId}:confirmation-->\n\n是否继续？`
})

writer.write({ type: 'text-end', id: textId })
```

**前端处理用户确认**:
```typescript
const handleResumeWorkflow = async (runId, stepId, resumeData) => {
  sendMessage(
    { text: '确认继续' },
    {
      body: {
        resumeWorkflow: { runId, stepId, resumeData }
      }
    }
  )
}

<WorkflowMessageRenderer 
  content={content}
  onResumeWorkflow={handleResumeWorkflow}
/>
```

**后端恢复工作流**:
```typescript
if (resumeWorkflow) {
  const runData = global.workflowRunData[resumeWorkflow.runId]
  
  // 继续执行后续步骤
  await continueWorkflow(writer, textId, runData, resumeWorkflow.resumeData)
  
  // 清理
  delete global.workflowRunData[resumeWorkflow.runId]
}
```

---

## 最佳实践

### 1. 流式输出优化

**✅ 推荐**:
```typescript
// 逐字符或逐词流式输出
for await (const chunk of aiStream.textStream) {
  writer.write({ type: 'text-delta', id: textId, delta: chunk })
}
```

**❌ 避免**:
```typescript
// 一次性输出大块内容
const result = await aiAgent.generate(prompt)
writer.write({ type: 'text-delta', id: textId, delta: result })
```

### 2. 标记使用规范

**✅ 推荐**:
```markdown
<!--STEP:web-search:START:running-->
步骤 1: 联网搜索
<!--STEP:web-search:OUTPUT:STREAMING-->
搜索中...
<!--STEP:web-search:OUTPUT:STREAMING:END-->
<!--STEP:web-search:END:completed-->
```

**❌ 避免**:
```markdown
// 标记不匹配或格式错误
<!--STEP:web-search:START:running-->
<!--STEP:different-id:END:completed-->
```

### 3. 错误处理

```typescript
try {
  // 执行工作流
  await executeWorkflow(...)
} catch (error) {
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${stepId}:END:error-->\n\n❌ 错误: ${error.message}`
  })
}
```

### 4. 用户体验优化

- **自动展开**: `running` 状态的步骤自动展开
- **自动收起**: `completed` 状态的步骤自动收起
- **进度提示**: 显示 "步骤 X/Y"
- **流式节奏**: 控制每个 chunk 的大小，避免过快或过慢
- **错误友好**: 错误信息清晰明了，避免技术术语

### 5. 性能考虑

- **标记解析**: 使用正则表达式一次性解析所有标记
- **组件记忆化**: 使用 `React.memo` 避免不必要的重渲染
- **懒加载**: 图片等大文件使用懒加载
- **虚拟滚动**: 消息列表超过 100 条时考虑虚拟滚动

### 6. 调试技巧

```typescript
// 添加详细日志
console.log('[WorkflowMessageRenderer] Parsing content:', {
  contentLength: content.length,
  hasStepMarker: content.includes('<!--STEP:'),
  hasIntentMarker: content.includes('<!--INTENT_RECOGNITION_START-->'),
})

// 输出解析结果
console.log('[WorkflowMessageRenderer] Parsed steps:', steps.length)
console.log('[WorkflowMessageRenderer] Remaining content:', remainingContent.substring(0, 200))
```

---

## 总结

SocialWiz 的生成式 UI 方案实现了：

1. **流式优先**: 所有 AI 生成内容都以流式方式呈现
2. **结构化展示**: 通过标记系统将非结构化内容转换为结构化 UI
3. **交互式体验**: 支持 Human-in-the-Loop 交互
4. **可扩展性**: 组件化设计，易于添加新的 AI Elements
5. **用户友好**: 自动展开/收起、进度提示、错误处理

这套方案结合了 Vercel AI SDK 的流式能力和 React 的组件化优势，为 AI 应用提供了优秀的用户体验。

---

## 相关文档

- [Human-in-the-Loop 实现文档](./HUMAN_IN_THE_LOOP_IMPLEMENTATION.md)
- [Agent 工作流文档](../specs/007-agent-workflow/)
- [项目状态文档](./PROJECT_STATUS.md)
