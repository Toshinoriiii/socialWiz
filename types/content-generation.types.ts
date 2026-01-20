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

/**
 * 平台内容限制
 */
export interface PlatformContentLimits {
  maxLength: number
  aspectRatio: '1:1' | '16:9' | '9:16'
  style: string
}

export const PLATFORM_LIMITS: Record<string, PlatformContentLimits> = {
  weibo: {
    maxLength: 140,
    aspectRatio: '1:1',
    style: '简洁、幽默、热点',
  },
  wechat: {
    maxLength: 5000,
    aspectRatio: '16:9',
    style: '正式、详细、专业',
  },
  generic: {
    maxLength: 1000,
    aspectRatio: '1:1',
    style: '通用、平衡',
  },
}
