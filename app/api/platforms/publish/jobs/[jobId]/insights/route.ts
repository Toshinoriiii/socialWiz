import { NextRequest, NextResponse } from 'next/server'
import { verify } from 'jsonwebtoken'
import { prisma } from '@/lib/db/prisma'
import { Platform } from '@/types/platform.types'
import { fetchWeiboPostInsightsForAccount } from '@/lib/platforms/weibo/weibo-post-insights'
import { effectivePublishContentTypeFromRecord } from '@/lib/utils/content-publish-type'
import { NonOfficialPublishService } from '@/lib/services/non-official-publish.service'
import { PublishJobStatus } from '@prisma/client'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

function getUserIdFromRequest (request: NextRequest): string | null {
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
 * GET /api/platforms/publish/jobs/[jobId]/insights
 * 成功发布的微博任务：用 job.platformPostId 拉取转发/评论/赞等（会话 Cookie 或 OAuth）。
 */
export async function GET (
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
  if (job.status !== PublishJobStatus.SUCCESS) {
    return NextResponse.json(
      { error: '任务未完成或无平台帖 ID', status: job.status },
      { status: 400 }
    )
  }
  const postId = job.platformPostId?.trim()
  if (!postId) {
    return NextResponse.json(
      { error: '该任务未记录 platformPostId，无法查询' },
      { status: 400 }
    )
  }

  const account = await prisma.platformAccount.findUnique({
    where: { id: job.platformAccountId },
    include: { weiboAppConfig: true }
  })
  if (!account || account.userId !== userId) {
    return NextResponse.json({ error: '平台账号不存在' }, { status: 404 })
  }

  if (account.platform !== Platform.WEIBO) {
    return NextResponse.json(
      { error: '当前仅支持微博任务的帖文洞察' },
      { status: 400 }
    )
  }

  let contentPublishKind: 'article' | 'image-text' | undefined
  if (job.contentId) {
    const c = await prisma.content.findFirst({
      where: { id: job.contentId, userId },
      select: { contentType: true, coverImage: true, images: true }
    })
    if (c) {
      const k = effectivePublishContentTypeFromRecord(c)
      if (k === 'image-text') contentPublishKind = 'image-text'
    }
  }

  const r = await fetchWeiboPostInsightsForAccount(account, userId, postId, {
    contentPublishKind
  })
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    platformPostId: postId,
    publishedUrl: job.publishedUrl,
    transport: r.transport,
    data: r.data,
    note: r.note
  })
}
