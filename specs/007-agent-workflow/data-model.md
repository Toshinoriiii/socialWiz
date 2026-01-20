# Data Model: AI Content Creation Workflow

**Date**: 2026-01-20  
**Purpose**: 定义 AI 内容创作工作流相关的数据库模型和类型定义

## 1. Database Schema (Prisma)

### 1.1 ContentGenerationRequest

存储用户的内容生成请求

```prisma
model ContentGenerationRequest {
  id          String   @id @default(cuid())
  userId      String
  prompt      String   @db.Text
  platform    Platform?
  style       String?  @db.Text
  status      ContentGenerationStatus @default(PENDING)
  
  // 关联生成的内容
  content     GeneratedContent?
  
  // 关联 Workflow 执行记录
  workflowExecution WorkflowExecution?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([status])
  @@index([createdAt])
}

enum ContentGenerationStatus {
  PENDING      // 等待执行
  SEARCHING    // 正在搜索
  CREATING     // 正在生成文案
  GENERATING_IMAGE // 正在生成图片
  COMPLETED    // 完成
  FAILED       // 失败
}

enum Platform {
  WEIBO
  WECHAT
  GENERIC  // 通用内容,不针对特定平台
}
```

### 1.2 GeneratedContent

存储生成的内容(文案 + 图片)

```prisma
model GeneratedContent {
  id          String   @id @default(cuid())
  requestId   String   @unique
  
  // 文案内容
  title       String?  @db.Text
  body        String   @db.Text
  tags        String[] // 标签数组
  
  // 图片信息
  imageUrl    String?
  imagePrompt String?  @db.Text
  
  // 元数据
  platform    Platform?
  searchResults Json?  // 存储搜索结果摘要
  
  // 用户反馈
  rating      Int?     // 1-5 星评分
  feedback    String?  @db.Text
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  request ContentGenerationRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  
  @@index([requestId])
  @@index([createdAt])
}
```

### 1.3 WorkflowExecution

存储 Workflow 执行记录,用于监控和调试

```prisma
model WorkflowExecution {
  id            String   @id @default(cuid())
  requestId     String   @unique
  workflowId    String   // 'content-creation-workflow'
  
  // 执行状态
  status        WorkflowExecutionStatus @default(RUNNING)
  currentStep   String?  // 当前执行到哪一步
  
  // 输入输出
  input         Json
  output        Json?
  
  // 错误信息
  error         String?  @db.Text
  errorStep     String?  // 哪一步出错
  
  // 性能指标
  startedAt     DateTime @default(now())
  completedAt   DateTime?
  duration      Int?     // 执行时长(毫秒)
  
  // 步骤执行记录
  steps         WorkflowStepExecution[]
  
  request ContentGenerationRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  
  @@index([requestId])
  @@index([status])
  @@index([workflowId])
}

enum WorkflowExecutionStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}
```

### 1.4 WorkflowStepExecution

存储每个 Workflow Step 的执行详情

```prisma
model WorkflowStepExecution {
  id              String   @id @default(cuid())
  executionId     String
  stepId          String   // 'web-search', 'content-creation', etc.
  stepName        String
  
  // 执行状态
  status          StepExecutionStatus @default(RUNNING)
  retryCount      Int      @default(0)
  
  // 输入输出
  input           Json?
  output          Json?
  
  // 错误信息
  error           String?  @db.Text
  
  // 性能指标
  startedAt       DateTime @default(now())
  completedAt     DateTime?
  duration        Int?     // 执行时长(毫秒)
  
  execution WorkflowExecution @relation(fields: [executionId], references: [id], onDelete: Cascade)
  
  @@index([executionId])
  @@index([stepId])
}

enum StepExecutionStatus {
  RUNNING
  COMPLETED
  FAILED
  SKIPPED
  RETRYING
}
```

### 1.5 更新 User Model

在现有的 User 模型中添加关联

```prisma
model User {
  // ... 现有字段
  
  // 新增关联
  contentRequests ContentGenerationRequest[]
  
  // ... 其他字段
}
```

---

## 2. TypeScript Types

### 2.1 Content Generation Types

```typescript
// types/content-generation.types.ts

import { z } from 'zod'

/**
 * 内容生成请求输入
 */
export const ContentGenerationInputSchema = z.object({
  prompt: z.string().min(1).max(500).describe('用户输入的主题或提示词'),
  platform: z.enum(['weibo', 'wechat', 'generic']).optional().describe('目标平台'),
  style: z.string().optional().describe('内容风格偏好(如:正式、幽默、专业等)'),
  userId: z.string().describe('用户 ID'),
})

export type ContentGenerationInput = z.infer<typeof ContentGenerationInputSchema>

/**
 * 搜索结果
 */
export const SearchResultSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  content: z.string(),
  score: z.number().optional(),
})

export type SearchResult = z.infer<typeof SearchResultSchema>

export const SearchResultsSchema = z.object({
  query: z.string(),
  results: z.array(SearchResultSchema),
  totalResults: z.number(),
})

export type SearchResults = z.infer<typeof SearchResultsSchema>

/**
 * 生成的文案内容
 */
export const GeneratedTextContentSchema = z.object({
  title: z.string().optional(),
  body: z.string(),
  tags: z.array(z.string()).optional(),
  platform: z.enum(['weibo', 'wechat', 'generic']).optional(),
})

export type GeneratedTextContent = z.infer<typeof GeneratedTextContentSchema>

/**
 * 图片提示词
 */
export const ImagePromptSchema = z.object({
  prompt: z.string().describe('图片生成提示词'),
  style: z.string().optional().describe('图片风格'),
  aspectRatio: z.enum(['1:1', '16:9', '9:16']).optional().default('1:1'),
})

export type ImagePrompt = z.infer<typeof ImagePromptSchema>

/**
 * 生成的图片
 */
export const GeneratedImageSchema = z.object({
  url: z.string().url().describe('图片 URL'),
  prompt: z.string().describe('使用的提示词'),
  width: z.number().optional(),
  height: z.number().optional(),
})

export type GeneratedImage = z.infer<typeof GeneratedImageSchema>

/**
 * 完整的内容输出
 */
export const ContentOutputSchema = z.object({
  content: GeneratedTextContentSchema,
  image: GeneratedImageSchema.optional(),
  requestId: z.string(),
})

export type ContentOutput = z.infer<typeof ContentOutputSchema>
```

### 2.2 Workflow Types

```typescript
// types/workflow.types.ts

import { z } from 'zod'

/**
 * Workflow 输入
 */
export const WorkflowInputSchema = z.object({
  prompt: z.string(),
  platform: z.enum(['weibo', 'wechat', 'generic']).optional(),
  style: z.string().optional(),
  requestId: z.string(),
  userId: z.string(),
})

export type WorkflowInput = z.infer<typeof WorkflowInputSchema>

/**
 * Workflow 输出
 */
export const WorkflowOutputSchema = z.object({
  success: z.boolean(),
  content: z.string().optional(),
  imageUrl: z.string().optional(),
  error: z.string().optional(),
})

export type WorkflowOutput = z.infer<typeof WorkflowOutputSchema>

/**
 * Workflow Step 结果
 */
export interface StepResult<T = any> {
  success: boolean
  data?: T
  error?: string
  duration?: number
}

/**
 * Workflow 状态事件
 */
export type WorkflowStatusEvent = 
  | { type: 'step_started'; stepId: string; stepName: string }
  | { type: 'step_completed'; stepId: string; stepName: string; duration: number }
  | { type: 'step_failed'; stepId: string; stepName: string; error: string }
  | { type: 'workflow_completed'; duration: number }
  | { type: 'workflow_failed'; error: string }
  | { type: 'content_chunk'; data: string } // 流式输出

/**
 * Workflow 执行上下文
 */
export interface WorkflowContext {
  requestId: string
  userId: string
  startTime: number
  searchResults?: any
  textContent?: any
  imagePrompt?: any
}
```

---

## 3. Entity Relationships

```
User
  ├── ContentGenerationRequest (1:N)
  
ContentGenerationRequest
  ├── GeneratedContent (1:1)
  └── WorkflowExecution (1:1)
  
WorkflowExecution
  └── WorkflowStepExecution (1:N)
```

---

## 4. Data Flow

### 4.1 创建内容生成请求

```
用户输入
  ↓
ContentGenerationRequest (PENDING)
  ↓
WorkflowExecution (RUNNING)
  ↓
[Workflow Steps 执行]
  ↓
GeneratedContent
  ↓
ContentGenerationRequest (COMPLETED)
WorkflowExecution (COMPLETED)
```

### 4.2 Step 执行追踪

```
WorkflowExecution
  ↓
WorkflowStepExecution[0] (web-search)      → COMPLETED
  ↓
WorkflowStepExecution[1] (content-creation) → COMPLETED
  ↓
WorkflowStepExecution[2] (image-prompt)     → COMPLETED
  ↓
WorkflowStepExecution[3] (image-generation) → COMPLETED
  ↓
WorkflowStepExecution[4] (content-mix)      → COMPLETED
```

---

## 5. Indexing Strategy

**重点索引**:
- `ContentGenerationRequest.userId` - 快速查询用户的请求历史
- `ContentGenerationRequest.status` - 快速查询特定状态的请求
- `ContentGenerationRequest.createdAt` - 按时间排序
- `WorkflowExecution.status` - 监控运行中的 Workflows
- `WorkflowStepExecution.executionId` - 快速查询某个 Workflow 的所有 Steps

---

## 6. Migration Script

```typescript
// prisma/migrations/XXX_add_content_generation/migration.sql

-- CreateEnum for ContentGenerationStatus
CREATE TYPE "ContentGenerationStatus" AS ENUM ('PENDING', 'SEARCHING', 'CREATING', 'GENERATING_IMAGE', 'COMPLETED', 'FAILED');

-- CreateEnum for Platform
CREATE TYPE "Platform" AS ENUM ('WEIBO', 'WECHAT', 'GENERIC');

-- CreateEnum for WorkflowExecutionStatus
CREATE TYPE "WorkflowExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum for StepExecutionStatus
CREATE TYPE "StepExecutionStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED', 'RETRYING');

-- CreateTable ContentGenerationRequest
CREATE TABLE "ContentGenerationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "platform" "Platform",
    "style" TEXT,
    "status" "ContentGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContentGenerationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- CreateIndex
CREATE INDEX "ContentGenerationRequest_userId_idx" ON "ContentGenerationRequest"("userId");
CREATE INDEX "ContentGenerationRequest_status_idx" ON "ContentGenerationRequest"("status");
CREATE INDEX "ContentGenerationRequest_createdAt_idx" ON "ContentGenerationRequest"("createdAt");

-- ... (其他表和索引)
```

---

## 7. Data Validation Rules

### Business Rules
1. `prompt` 必须在 1-500 字符之间
2. `platform` 如果不指定,默认为 `GENERIC`
3. `status` 转换必须遵循状态机:
   - PENDING → SEARCHING → CREATING → GENERATING_IMAGE → COMPLETED
   - 任何状态 → FAILED (出错时)
4. `WorkflowExecution.duration` 应该等于 `completedAt - startedAt`
5. `GeneratedContent.rating` 必须在 1-5 之间

### Data Integrity
- 所有关联使用 `onDelete: Cascade` 确保数据一致性
- `requestId` 使用 unique 约束确保一对一关系
- 使用 enum 约束状态字段的合法值

---

**数据模型设计完成日期**: 2026-01-20  
**下一步**: 创建 API Contracts
