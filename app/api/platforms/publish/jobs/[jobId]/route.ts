import { NextRequest, NextResponse } from 'next/server'
import { verify } from 'jsonwebtoken'
import { NonOfficialPublishService } from '@/lib/services/non-official-publish.service'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

function getUserIdFromRequest(request: NextRequest): string | null {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null
    const token = authHeader.substring(7)
    const decoded = verify(token, JWT_SECRET) as { userId: string }
    return decoded.userId
  } catch {
    return null
  }
}

/**
 * GET /api/platforms/publish/jobs/[jobId]
 * 查询非官方发布任务状态（当前用户自有任务）。
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const userId = getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { jobId } = await context.params
  if (!jobId) {
    return NextResponse.json({ error: 'jobId 无效' }, { status: 400 })
  }

  const job = await NonOfficialPublishService.getJobForUser(jobId, userId)
  if (!job) {
    return NextResponse.json({ error: '任务不存在' }, { status: 404 })
  }

  const missingPostRef =
    job.status === 'SUCCESS' && !job.platformPostId?.trim() && !job.publishedUrl?.trim()

  return NextResponse.json({
    id: job.id,
    userId: job.userId,
    platformAccountId: job.platformAccountId,
    contentId: job.contentId,
    status: job.status,
    errorMessage: job.errorMessage,
    platformPostId: job.platformPostId,
    publishedUrl: job.publishedUrl,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    ...(missingPostRef
      ? {
          hint:
            '任务已成功但未写入帖 ID/链接（多为站内接口未返回详情）。请拉最新代码后再发一条，或在时间线打开该微博从地址栏复制 id 后使用「按帖查询」洞察接口。'
        }
      : {})
  })
}
