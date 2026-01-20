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
