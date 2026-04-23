import { NextRequest, NextResponse } from 'next/server'
import { verify } from 'jsonwebtoken'
import { prisma } from '@/lib/db/prisma'
import { Platform } from '@/types/platform.types'
import { fetchWeiboPostInsightsForAccount } from '@/lib/platforms/weibo/weibo-post-insights'
import { effectivePublishContentTypeFromRecord } from '@/lib/utils/content-publish-type'
import { NonOfficialPublishService } from '@/lib/services/non-official-publish.service'
import { PublishJobStatus } from '@prisma/client'
import { fetchWechatArticleEngagementMetrics } from '@/lib/platforms/wechat/wechat-article-engagement'
import type { PublishJobPayload } from '@/types/publish-job'

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
 * 成功发布任务：微博用 platformPostId 拉时间线/图文互动；微信用标题+已发布链从后台「发表记录」拉单篇数据。
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
  const account = await prisma.platformAccount.findUnique({
    where: { id: job.platformAccountId },
    include: { weiboAppConfig: true }
  })
  if (!account || account.userId !== userId) {
    return NextResponse.json({ error: '平台账号不存在' }, { status: 404 })
  }

  if (account.platform === Platform.WECHAT) {
    const payload = (job.payload ?? {}) as Partial<PublishJobPayload>
    let title = (payload.title ?? '').trim()
    let wechatCfgId: string | null = account.wechatAccountConfigId
    if (job.contentId) {
      const content = await prisma.content.findFirst({
        where: { id: job.contentId, userId },
        select: { title: true }
      })
      if (content?.title?.trim()) title = content.title.trim()
      const cp = await prisma.contentPlatform.findFirst({
        where: { contentId: job.contentId, platformAccountId: job.platformAccountId }
      })
      if (cp?.wechatConfigId) {
        wechatCfgId = cp.wechatConfigId
      }
    }
    if (!title) {
      return NextResponse.json(
        { error: '无法解析任务标题，请保证任务关联了含标题的内容' },
        { status: 400 }
      )
    }
    const w = await fetchWechatArticleEngagementMetrics({
      userId,
      wechatConfigId: wechatCfgId,
      publishedUrl: job.publishedUrl,
      title,
      platformContentId: job.platformPostId
    })
    if (!w.ok) {
      return NextResponse.json(
        { error: w.warn || '拉取微信阅读数据失败' },
        { status: 400 }
      )
    }
    return NextResponse.json({
      ok: true,
      jobId: job.id,
      platform: 'WECHAT',
      publishedUrl: job.publishedUrl,
      platformPostId: job.platformPostId,
      data: w.data
    })
  }

  const postId = job.platformPostId?.trim()
  if (!postId) {
    return NextResponse.json(
      { error: '该任务未记录 platformPostId，无法查询' },
      { status: 400 }
    )
  }

  if (account.platform !== Platform.WEIBO) {
    return NextResponse.json(
      { error: '当前仅支持微博、微信公众号任务的发布洞察' },
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
