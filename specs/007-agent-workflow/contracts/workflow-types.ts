/**
 * Workflow Types Definition
 * 
 * 定义 Content Creation Workflow 的所有类型和接口
 * 
 * @date 2026-01-20
 */

import { z } from 'zod'

// ============================================================================
// Workflow Input/Output Schemas
// ============================================================================

/**
 * Content Creation Workflow 输入 Schema
 */
export const ContentCreationWorkflowInputSchema = z.object({
  prompt: z.string().min(1).max(500).describe('用户输入的提示词'),
  platform: z.enum(['weibo', 'wechat', 'generic']).optional().default('generic'),
  style: z.string().optional().describe('内容风格偏好'),
  requestId: z.string().describe('内容生成请求 ID'),
  userId: z.string().describe('用户 ID'),
})

export type ContentCreationWorkflowInput = z.infer<typeof ContentCreationWorkflowInputSchema>

/**
 * Content Creation Workflow 输出 Schema
 */
export const ContentCreationWorkflowOutputSchema = z.object({
  success: z.boolean(),
  content: z.object({
    title: z.string().optional(),
    body: z.string(),
    tags: z.array(z.string()).optional(),
    imageUrl: z.string().optional(),
    imagePrompt: z.string().optional(),
  }).optional(),
  error: z.string().optional(),
})

export type ContentCreationWorkflowOutput = z.infer<typeof ContentCreationWorkflowOutputSchema>

// ============================================================================
// Step Schemas
// ============================================================================

/**
 * Step 1: Web Search
 */
export const WebSearchStepInputSchema = z.object({
  prompt: z.string(),
  maxResults: z.number().optional().default(5),
})

export const WebSearchStepOutputSchema = z.object({
  query: z.string(),
  results: z.array(z.object({
    title: z.string(),
    url: z.string().url(),
    content: z.string(),
    score: z.number().optional(),
  })),
  totalResults: z.number(),
})

export type WebSearchStepInput = z.infer<typeof WebSearchStepInputSchema>
export type WebSearchStepOutput = z.infer<typeof WebSearchStepOutputSchema>

/**
 * Step 2: Content Creation
 */
export const ContentCreationStepInputSchema = z.object({
  prompt: z.string(),
  searchResults: WebSearchStepOutputSchema,
  platform: z.enum(['weibo', 'wechat', 'generic']).optional(),
  style: z.string().optional(),
})

export const ContentCreationStepOutputSchema = z.object({
  title: z.string().optional(),
  body: z.string(),
  tags: z.array(z.string()).optional(),
  platform: z.enum(['weibo', 'wechat', 'generic']).optional(),
})

export type ContentCreationStepInput = z.infer<typeof ContentCreationStepInputSchema>
export type ContentCreationStepOutput = z.infer<typeof ContentCreationStepOutputSchema>

/**
 * Step 3: Image Prompt Generation
 */
export const ImagePromptStepInputSchema = z.object({
  content: ContentCreationStepOutputSchema,
  style: z.string().optional(),
})

export const ImagePromptStepOutputSchema = z.object({
  prompt: z.string(),
  style: z.string().optional(),
  aspectRatio: z.enum(['1:1', '16:9', '9:16']).optional().default('1:1'),
})

export type ImagePromptStepInput = z.infer<typeof ImagePromptStepInputSchema>
export type ImagePromptStepOutput = z.infer<typeof ImagePromptStepOutputSchema>

/**
 * Step 4: Image Generation
 */
export const ImageGenerationStepInputSchema = z.object({
  prompt: z.string(),
  aspectRatio: z.enum(['1:1', '16:9', '9:16']).optional().default('1:1'),
})

export const ImageGenerationStepOutputSchema = z.object({
  url: z.string().url(),
  prompt: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
})

export type ImageGenerationStepInput = z.infer<typeof ImageGenerationStepInputSchema>
export type ImageGenerationStepOutput = z.infer<typeof ImageGenerationStepOutputSchema>

/**
 * Step 5: Content Mix (最终输出组合)
 */
export const ContentMixStepInputSchema = z.object({
  textContent: ContentCreationStepOutputSchema,
  image: ImageGenerationStepOutputSchema.optional(),
})

export const ContentMixStepOutputSchema = z.object({
  content: ContentCreationStepOutputSchema,
  image: ImageGenerationStepOutputSchema.optional(),
})

export type ContentMixStepInput = z.infer<typeof ContentMixStepInputSchema>
export type ContentMixStepOutput = z.infer<typeof ContentMixStepOutputSchema>

// ============================================================================
// Workflow Execution Types
// ============================================================================

/**
 * Workflow 执行状态
 */
export enum WorkflowExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * Step 执行状态
 */
export enum StepExecutionStatus {
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  RETRYING = 'RETRYING',
}

/**
 * Workflow Step 定义
 */
export interface WorkflowStepDefinition {
  id: string
  name: string
  description: string
  retries?: number
  retryDelay?: number
}

/**
 * Workflow 定义
 */
export interface WorkflowDefinition {
  id: string
  name: string
  description: string
  steps: WorkflowStepDefinition[]
}

/**
 * Step 执行结果
 */
export interface StepExecutionResult<T = any> {
  success: boolean
  data?: T
  error?: string
  duration?: number
  retryCount?: number
}

/**
 * Workflow 执行上下文
 */
export interface WorkflowExecutionContext {
  requestId: string
  userId: string
  workflowId: string
  startTime: number
  
  // Step 之间传递的数据
  searchResults?: WebSearchStepOutput
  textContent?: ContentCreationStepOutput
  imagePrompt?: ImagePromptStepOutput
  generatedImage?: ImageGenerationStepOutput
}

/**
 * Workflow 状态事件 (用于流式更新)
 */
export type WorkflowStatusEvent = 
  | {
      type: 'workflow_started'
      workflowId: string
      requestId: string
    }
  | {
      type: 'step_started'
      stepId: string
      stepName: string
      timestamp: number
    }
  | {
      type: 'step_progress'
      stepId: string
      stepName: string
      progress: number
      message?: string
    }
  | {
      type: 'step_completed'
      stepId: string
      stepName: string
      duration: number
      timestamp: number
    }
  | {
      type: 'step_failed'
      stepId: string
      stepName: string
      error: string
      retryCount?: number
      timestamp: number
    }
  | {
      type: 'step_retrying'
      stepId: string
      stepName: string
      retryCount: number
      maxRetries: number
    }
  | {
      type: 'content_chunk'
      stepId: string
      chunk: string
    }
  | {
      type: 'workflow_completed'
      duration: number
      output: ContentCreationWorkflowOutput
      timestamp: number
    }
  | {
      type: 'workflow_failed'
      error: string
      failedStep?: string
      timestamp: number
    }

/**
 * Workflow 监听器接口
 */
export interface WorkflowEventListener {
  onWorkflowStarted?: (event: Extract<WorkflowStatusEvent, { type: 'workflow_started' }>) => void
  onStepStarted?: (event: Extract<WorkflowStatusEvent, { type: 'step_started' }>) => void
  onStepProgress?: (event: Extract<WorkflowStatusEvent, { type: 'step_progress' }>) => void
  onStepCompleted?: (event: Extract<WorkflowStatusEvent, { type: 'step_completed' }>) => void
  onStepFailed?: (event: Extract<WorkflowStatusEvent, { type: 'step_failed' }>) => void
  onStepRetrying?: (event: Extract<WorkflowStatusEvent, { type: 'step_retrying' }>) => void
  onContentChunk?: (event: Extract<WorkflowStatusEvent, { type: 'content_chunk' }>) => void
  onWorkflowCompleted?: (event: Extract<WorkflowStatusEvent, { type: 'workflow_completed' }>) => void
  onWorkflowFailed?: (event: Extract<WorkflowStatusEvent, { type: 'workflow_failed' }>) => void
}

// ============================================================================
// Platform-Specific Types
// ============================================================================

/**
 * 平台特定的内容限制
 */
export interface PlatformContentLimits {
  maxTitleLength?: number
  maxBodyLength?: number
  maxTags?: number
  preferredAspectRatio?: '1:1' | '16:9' | '9:16'
}

/**
 * 平台配置
 */
export const PLATFORM_CONFIGS: Record<'weibo' | 'wechat' | 'generic', PlatformContentLimits> = {
  weibo: {
    maxTitleLength: 50,
    maxBodyLength: 140,
    maxTags: 5,
    preferredAspectRatio: '1:1',
  },
  wechat: {
    maxTitleLength: 64,
    maxBodyLength: 5000,
    maxTags: 10,
    preferredAspectRatio: '16:9',
  },
  generic: {
    maxTitleLength: 100,
    maxBodyLength: 2000,
    maxTags: 10,
    preferredAspectRatio: '1:1',
  },
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Workflow 错误类型
 */
export enum WorkflowErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  STEP_FAILED = 'STEP_FAILED',
  TIMEOUT = 'TIMEOUT',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  RETRY_EXHAUSTED = 'RETRY_EXHAUSTED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Workflow 错误
 */
export class WorkflowError extends Error {
  constructor(
    public code: WorkflowErrorCode,
    public message: string,
    public stepId?: string,
    public cause?: Error
  ) {
    super(message)
    this.name = 'WorkflowError'
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * 检查是否为 Step 执行成功结果
 */
export function isStepSuccess<T>(result: StepExecutionResult<T>): result is StepExecutionResult<T> & { success: true, data: T } {
  return result.success === true && result.data !== undefined
}

/**
 * 检查是否为 Step 执行失败结果
 */
export function isStepFailure(result: StepExecutionResult): result is StepExecutionResult & { success: false, error: string } {
  return result.success === false && result.error !== undefined
}

/**
 * 检查是否为 Workflow 完成事件
 */
export function isWorkflowCompletedEvent(event: WorkflowStatusEvent): event is Extract<WorkflowStatusEvent, { type: 'workflow_completed' }> {
  return event.type === 'workflow_completed'
}

/**
 * 检查是否为 Workflow 失败事件
 */
export function isWorkflowFailedEvent(event: WorkflowStatusEvent): event is Extract<WorkflowStatusEvent, { type: 'workflow_failed' }> {
  return event.type === 'workflow_failed'
}
