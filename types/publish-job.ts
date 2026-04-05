import { z } from 'zod'

export const publishJobStatusSchema = z.enum(['QUEUED', 'RUNNING', 'SUCCESS', 'FAILED'])

export type PublishJobStatusValue = z.infer<typeof publishJobStatusSchema>

export const publishJobPayloadSchema = z.object({
  text: z.string(),
  title: z.string().optional(),
  contentType: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
  source: z.enum(['unified_publish', 'weibo_account_publish']).optional(),
  coverImageUrl: z.string().optional(),
  htmlBody: z.string().optional()
})

export type PublishJobPayload = z.infer<typeof publishJobPayloadSchema>

export const publishJobPublicSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  platformAccountId: z.string(),
  contentId: z.string().nullable().optional(),
  status: publishJobStatusSchema,
  errorMessage: z.string().nullable().optional(),
  platformPostId: z.string().nullable().optional(),
  publishedUrl: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export type PublishJobPublic = z.infer<typeof publishJobPublicSchema>
