import { prisma } from '@/lib/db/prisma'
import { PublishJobStatus } from '@prisma/client'
import { getPublishPlugin } from '@/lib/platforms/publish-plugins'
import { Platform } from '@/types/platform.types'
import {
  isWeiboBrowserSessionAccount,
  isWechatBrowserSessionAccount,
  isZhihuBrowserSessionAccount
} from '@/lib/platforms/connection-kind'
import type { PublishJobPayload } from '@/types/publish-job'
import { readWeiboPlaywrightProfile } from '@/lib/weibo-playwright/session-files'
import {
  isWeiboTtarticlePublishedUrl,
  normalizeWeiboSessionPublishMeta
} from '@/lib/weibo-playwright/weibo-profile-status-url'
import {
  fetchWeiboStatusInsightsWithSessionCookies,
  findFeedMidByWeiboArticleObjectIdWithRetry,
  isWeiboArticleNumericObjectId,
  type WeiboCookieStatusInsights
} from '@/lib/weibo-playwright/weibo-status-cookie'
import {
  extractTtarticleObjectIdFromUrl,
  weiboTtarticleShowUrl
} from '@/lib/weibo-playwright/weibo-ttarticle-insights'
import { appendWechatMpPublishSettingsHint } from '@/lib/utils/wechat-publish-user-hints'
import { effectivePublishContentTypeFromRecord } from '@/lib/utils/content-publish-type'
import type {
  WeiboPublishConfigData,
  ZhihuPublishConfigData
} from '@/types/platform-config.types'
import type { ImagePart } from '@/lib/weibo-playwright/weibo-web-pic-upload'

/**
 * 发布落库前：头条 object_id 与 time line mid 不一致时，从时间线反查 mid 并统一写入。
 */
export async function finalizeWeiboIdsForContentPlatform (
  userId: string,
  platformPostId: string | null,
  publishedUrl: string | null
): Promise<{
  platformPostId: string | null
  publishedUrl: string | null
  weiboTimelineMid: string | null
}> {
  const profile = readWeiboPlaywrightProfile(userId)
  const uid = profile?.weiboUid?.replace(/\D/g, '') ?? ''
  let pid = platformPostId?.trim() || null
  let url = publishedUrl?.trim() || null

  const oidFromUrl = extractTtarticleObjectIdFromUrl(url)
  const pidDigits = pid?.replace(/\D/g, '') ?? ''
  const articleOid =
    oidFromUrl ??
    (pidDigits && isWeiboArticleNumericObjectId(pidDigits) ? pidDigits : null)

  if (articleOid) {
    const mid = await findFeedMidByWeiboArticleObjectIdWithRetry(userId, articleOid)
    if (mid) {
      const articlePageUrl = isWeiboTtarticlePublishedUrl(url)
        ? url
        : weiboTtarticleShowUrl(articleOid)
      return {
        platformPostId: mid,
        publishedUrl: articlePageUrl,
        weiboTimelineMid: mid
      }
    }
  }

  let weiboTimelineMid: string | null = null
  if (pid && /^\d{5,40}$/.test(pid) && !isWeiboArticleNumericObjectId(pid)) {
    weiboTimelineMid = pid
  }

  return { platformPostId: pid, publishedUrl: url, weiboTimelineMid }
}

export type WeiboSessionPostInsights = WeiboCookieStatusInsights

export interface WeiboSessionPublishApiResult {
  success: boolean
  jobId?: string
  error?: string
  message?: string
  platformPostId?: string
  publishedUrl?: string
  /** m.weibo.cn 单帖详情里能拿到的阅读/互动数（可能缺 reads_count） */
  postInsights?: WeiboSessionPostInsights
}

export interface WeiboSessionPublishParams {
  userId: string
  platformAccountId: string
  text: string
  contentId?: string
  source: PublishJobPayload['source']
  imageUrls?: string[]
  /** 头条封面二进制（与 PublishService 统一发布 multipart 对齐） */
  coverImagePart?: ImagePart
  title?: string
  contentType?: string
  weiboPublishConfig?: WeiboPublishConfigData
  /**
   * 为 true 时不更新 Content.status（多账号「一次性发布」需全部成功后再由前端/API 统一标为 PUBLISHED）。
   */
  deferContentPublishedUpdate?: boolean
}

export interface WechatSessionPublishApiResult {
  success: boolean
  jobId?: string
  error?: string
  message?: string /** 成功时的提示或 hint */
  platformPostId?: string
  publishedUrl?: string
}

export interface ZhihuSessionPublishApiResult {
  success: boolean
  jobId?: string
  error?: string
  message?: string
  platformPostId?: string
  publishedUrl?: string
}

export interface ZhihuSessionPublishParams {
  userId: string
  platformAccountId: string
  title: string
  text: string
  contentId?: string
  source: PublishJobPayload['source']
  zhihuPublishConfig?: ZhihuPublishConfigData
  deferContentPublishedUpdate?: boolean
  /** 专栏封面，可选 */
  coverImage?: { buffer: Buffer; contentType?: string }
}

export interface WechatSessionPublishParams {
  userId: string
  platformAccountId: string
  plainText: string
  htmlBody: string
  title: string
  digest: string
  coverImageUrl: string
  contentSourceUrl?: string
  author?: string
  contentId?: string
  source: PublishJobPayload['source']
  coverFallback?: { buffer: Buffer; filename: string; contentType: string }
  /**
   * 为 true 时不更新 Content.status（与 deferContentPublishedUpdate on 微博侧语义一致）。
   */
  deferContentPublishedUpdate?: boolean
}

export class NonOfficialPublishService {
  /**
   * 微博会话型账号：创建 PublishJob、调用站内 HTTP 发博、更新任务状态。
   */
  static async publishWeiboBrowserSession(
    params: WeiboSessionPublishParams
  ): Promise<WeiboSessionPublishApiResult> {
    const {
      userId,
      platformAccountId,
      text,
      contentId,
      source,
      imageUrls,
      coverImagePart,
      title,
      contentType,
      weiboPublishConfig,
      deferContentPublishedUpdate
    } = params

    const account = await prisma.platformAccount.findUnique({
      where: { id: platformAccountId }
    })
    if (!account || account.userId !== userId) {
      return { success: false, error: '平台账号不存在或无权访问' }
    }
    if (!account.isConnected) {
      return { success: false, error: '账号未连接' }
    }
    if (!isWeiboBrowserSessionAccount(account)) {
      return { success: false, error: '非浏览器会话型微博账号' }
    }

    const plugin = getPublishPlugin(Platform.WEIBO)
    if (!plugin) {
      return { success: false, error: '未注册微博发布插件' }
    }

    const payload: PublishJobPayload = {
      text: text.trim(),
      source: source ?? 'unified_publish',
      title,
      contentType,
      imageUrls
    }

    const job = await prisma.publishJob.create({
      data: {
        userId,
        platformAccountId,
        contentId: contentId ?? null,
        payload: payload as object,
        status: PublishJobStatus.QUEUED
      }
    })

    await prisma.publishJob.update({
      where: { id: job.id },
      data: { status: PublishJobStatus.RUNNING }
    })

    const result = await plugin.publishText(
      { userId, platformAccountId, contentId },
      text,
      {
        imageUrls,
        coverImagePart,
        title,
        contentType,
        weiboPublishConfig
      }
    )

    if (!result.ok) {
      await prisma.publishJob.update({
        where: { id: job.id },
        data: {
          status: PublishJobStatus.FAILED,
          errorMessage: [result.error, result.detail].filter(Boolean).join(' — ').slice(0, 2000)
        }
      })
      return {
        success: false,
        jobId: job.id,
        error:
          [result.error, result.detail].filter(Boolean).join(' — ').slice(0, 2000) ||
          '发布失败',
        message: result.hint
      }
    }

    const profile = readWeiboPlaywrightProfile(userId)
    const normalized = normalizeWeiboSessionPublishMeta(
      profile?.weiboUid,
      result.platformPostId ?? null,
      result.publishedUrl ?? null
    )
    let platformPostId = normalized.platformPostId
    let publishedUrl = normalized.publishedUrl

    const weiboResolved = await finalizeWeiboIdsForContentPlatform(
      userId,
      platformPostId,
      publishedUrl
    )
    platformPostId = weiboResolved.platformPostId
    publishedUrl = weiboResolved.publishedUrl
    const weiboTimelineMid = weiboResolved.weiboTimelineMid

    let postInsights: WeiboCookieStatusInsights | undefined
    const insightId = weiboTimelineMid ?? platformPostId
    if (insightId && /^\d{5,40}$/.test(insightId)) {
      const ins = await fetchWeiboStatusInsightsWithSessionCookies(
        userId,
        insightId
      )
      if (ins.ok) postInsights = ins.data
    }

    await prisma.publishJob.update({
      where: { id: job.id },
      data: {
        status: PublishJobStatus.SUCCESS,
        errorMessage: null,
        platformPostId
      }
    })
    // publishedUrl 走原生 SQL，避免本地 Prisma Client 未 regenerate 时
    // 仍报 Unknown argument `publishedUrl`（与 schema / DB 已不同步）。
    await prisma.$executeRaw`
      UPDATE "publish_jobs"
      SET "publishedUrl" = ${publishedUrl}, "updatedAt" = ${new Date()}
      WHERE "id" = ${job.id}
    `

    /**
     * 发布已成功：必须写 ContentPlatform.SUCCESS（发布记录 API 只列 SUCCESS）。
     * Content 是否在此时标为 PUBLISHED：单平台发布默认标；多平台批次传 deferContentPublishedUpdate 后由调用方在全部成功后统一更新。
     */
    if (contentId && platformAccountId) {
      const existing = await prisma.contentPlatform.findFirst({
        where: { contentId, platformAccountId }
      })
      if (existing) {
        await prisma.contentPlatform.update({
          where: { id: existing.id },
          data: {
            platformContentId:
              platformPostId || existing.platformContentId || null,
            publishedUrl: publishedUrl || existing.publishedUrl || null,
            weiboTimelineMid: weiboTimelineMid ?? undefined,
            platformPublishedAt: new Date(),
            publishStatus: 'SUCCESS',
            errorMessage: null
          }
        })
      } else {
        await prisma.contentPlatform.create({
          data: {
            contentId,
            platformAccountId,
            platformContentId: platformPostId || null,
            publishedUrl: publishedUrl || null,
            weiboTimelineMid: weiboTimelineMid ?? undefined,
            platformPublishedAt: new Date(),
            publishStatus: 'SUCCESS'
          }
        })
      }
    }

    if (contentId && !deferContentPublishedUpdate) {
      await prisma.content.updateMany({
        where: { id: contentId, userId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          updatedAt: new Date()
        }
      })
    }

    return {
      success: true,
      jobId: job.id,
      platformPostId: platformPostId ?? undefined,
      publishedUrl: publishedUrl ?? undefined,
      postInsights,
      message: publishedUrl
        ? `发布已完成。链接：${publishedUrl}`
        : '发布流程已执行。若未见链接，请在微博时间线确认是否发出。'
    }
  }

  /**
   * 微信 mp 网页会话：创建 PublishJob、走 operate_appmsg + masssend HTTP 复现。
   */
  static async publishWechatBrowserSession (
    params: WechatSessionPublishParams
  ): Promise<WechatSessionPublishApiResult> {
    const {
      userId,
      platformAccountId,
      plainText,
      htmlBody,
      title,
      digest,
      coverImageUrl,
      contentSourceUrl,
      author,
      contentId,
      source,
      coverFallback,
      deferContentPublishedUpdate
    } = params

    const account = await prisma.platformAccount.findUnique({
      where: { id: platformAccountId }
    })
    if (!account || account.userId !== userId) {
      return { success: false, error: '平台账号不存在或无权访问' }
    }
    if (!account.isConnected) {
      return { success: false, error: '账号未连接' }
    }
    if (!isWechatBrowserSessionAccount(account)) {
      return { success: false, error: '非浏览器会话型微信公众号' }
    }

    const plugin = getPublishPlugin(Platform.WECHAT)
    if (!plugin) {
      return { success: false, error: '未注册微信公众号发布插件' }
    }

    const payload: PublishJobPayload = {
      text: plainText.trim(),
      source: source ?? 'unified_publish',
      title,
      coverImageUrl,
      htmlBody
    }

    const job = await prisma.publishJob.create({
      data: {
        userId,
        platformAccountId,
        contentId: contentId ?? null,
        payload: payload as object,
        status: PublishJobStatus.QUEUED
      }
    })

    await prisma.publishJob.update({
      where: { id: job.id },
      data: { status: PublishJobStatus.RUNNING }
    })

    const result = await plugin.publishText(
      { userId, platformAccountId, contentId },
      plainText,
      {
        title,
        htmlBody,
        digest,
        coverImageUrl,
        contentSourceUrl,
        author,
        coverFallback
      }
    )

    if (!result.ok) {
      const failMsgRaw = [
        result.error,
        result.detail,
        result.platformPostId ? `appMsgId=${result.platformPostId}` : null
      ]
        .filter(Boolean)
        .join(' — ')
      const rawCapped =
        failMsgRaw.length > 4000
          ? `${failMsgRaw.slice(0, 3999)}…`
          : failMsgRaw
      const failMsg = appendWechatMpPublishSettingsHint(
        rawCapped || '发布失败'
      )
      await prisma.publishJob.update({
        where: { id: job.id },
        data: {
          status: PublishJobStatus.FAILED,
          errorMessage: failMsg
        }
      })
      return {
        success: false,
        jobId: job.id,
        error: failMsg || appendWechatMpPublishSettingsHint('发布失败'),
        message: result.hint
      }
    }

    const platformPostId = result.platformPostId
    const publishedUrl = result.publishedUrl

    await prisma.publishJob.update({
      where: { id: job.id },
      data: {
        status: PublishJobStatus.SUCCESS,
        errorMessage: null,
        platformPostId
      }
    })
    await prisma.$executeRaw`
      UPDATE "publish_jobs"
      SET "publishedUrl" = ${publishedUrl}, "updatedAt" = ${new Date()}
      WHERE "id" = ${job.id}
    `

    if (contentId && platformAccountId) {
      const existing = await prisma.contentPlatform.findFirst({
        where: { contentId, platformAccountId }
      })
      if (existing) {
        await prisma.contentPlatform.update({
          where: { id: existing.id },
          data: {
            platformContentId: platformPostId || existing.platformContentId || null,
            publishedUrl: publishedUrl || existing.publishedUrl || null,
            platformPublishedAt: new Date(),
            publishStatus: 'SUCCESS',
            errorMessage: null
          }
        })
      } else {
        await prisma.contentPlatform.create({
          data: {
            contentId,
            platformAccountId,
            platformContentId: platformPostId || null,
            publishedUrl: publishedUrl || null,
            platformPublishedAt: new Date(),
            publishStatus: 'SUCCESS'
          }
        })
      }
    }

    if (contentId && !deferContentPublishedUpdate) {
      await prisma.content.updateMany({
        where: { id: contentId, userId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          updatedAt: new Date()
        }
      })
    }

    return {
      success: true,
      jobId: job.id,
      platformPostId: platformPostId ?? undefined,
      publishedUrl: publishedUrl ?? undefined,
      message: publishedUrl
        ? `群发已提交。文章链接：${publishedUrl}`
        : result.hint || '群发已提交，请在公众平台发表记录查看或稍后刷新本条记录以同步链接。'
    }
  }

  /**
   * 知乎浏览器会话：创建 PublishJob、走 zhuanlan 文章 drafts → draft → publish。
   */
  static async publishZhihuBrowserSession (
    params: ZhihuSessionPublishParams
  ): Promise<ZhihuSessionPublishApiResult> {
    const {
      userId,
      platformAccountId,
      title,
      text,
      contentId,
      source,
      zhihuPublishConfig,
      deferContentPublishedUpdate,
      coverImage
    } = params

    const account = await prisma.platformAccount.findUnique({
      where: { id: platformAccountId }
    })
    if (!account || account.userId !== userId) {
      return { success: false, error: '平台账号不存在或无权访问' }
    }
    if (!account.isConnected) {
      return { success: false, error: '账号未连接' }
    }
    if (!isZhihuBrowserSessionAccount(account)) {
      return { success: false, error: '非浏览器会话型知乎账号' }
    }

    if (contentId) {
      const c = await prisma.content.findFirst({
        where: { id: contentId, userId },
        select: { contentType: true, coverImage: true, images: true }
      })
      if (
        c &&
        effectivePublishContentTypeFromRecord(c) === 'image-text'
      ) {
        return {
          success: false,
          error: '知乎仅支持文章类型作品，请在文章编辑器中创建后再发布'
        }
      }
    }

    const plugin = getPublishPlugin(Platform.ZHIHU)
    if (!plugin) {
      return { success: false, error: '未注册知乎发布插件' }
    }

    const payload: PublishJobPayload = {
      text: text.trim(),
      source: source ?? 'unified_publish',
      title
    }

    const job = await prisma.publishJob.create({
      data: {
        userId,
        platformAccountId,
        contentId: contentId ?? null,
        payload: payload as object,
        status: PublishJobStatus.QUEUED
      }
    })

    await prisma.publishJob.update({
      where: { id: job.id },
      data: { status: PublishJobStatus.RUNNING }
    })

    const result = await plugin.publishText(
      { userId, platformAccountId, contentId },
      text,
      { title, zhihuPublishConfig, coverImage }
    )

    if (!result.ok) {
      await prisma.publishJob.update({
        where: { id: job.id },
        data: {
          status: PublishJobStatus.FAILED,
          errorMessage: [result.error, result.detail].filter(Boolean).join(' — ').slice(0, 2000)
        }
      })
      return {
        success: false,
        jobId: job.id,
        error:
          [result.error, result.detail].filter(Boolean).join(' — ').slice(0, 2000) ||
          '发布失败',
        message: result.hint
      }
    }

    const platformPostId = result.platformPostId ?? null
    const publishedUrl = result.publishedUrl ?? null

    await prisma.publishJob.update({
      where: { id: job.id },
      data: {
        status: PublishJobStatus.SUCCESS,
        errorMessage: null,
        platformPostId
      }
    })
    await prisma.$executeRaw`
      UPDATE "publish_jobs"
      SET "publishedUrl" = ${publishedUrl}, "updatedAt" = ${new Date()}
      WHERE "id" = ${job.id}
    `

    if (contentId && platformAccountId) {
      const existing = await prisma.contentPlatform.findFirst({
        where: { contentId, platformAccountId }
      })
      if (existing) {
        await prisma.contentPlatform.update({
          where: { id: existing.id },
          data: {
            platformContentId:
              platformPostId || existing.platformContentId || null,
            publishedUrl: publishedUrl || existing.publishedUrl || null,
            platformPublishedAt: new Date(),
            publishStatus: 'SUCCESS',
            errorMessage: null
          }
        })
      } else {
        await prisma.contentPlatform.create({
          data: {
            contentId,
            platformAccountId,
            platformContentId: platformPostId || null,
            publishedUrl: publishedUrl || null,
            platformPublishedAt: new Date(),
            publishStatus: 'SUCCESS'
          }
        })
      }
    }

    if (contentId && !deferContentPublishedUpdate) {
      await prisma.content.updateMany({
        where: { id: contentId, userId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          updatedAt: new Date()
        }
      })
    }

    return {
      success: true,
      jobId: job.id,
      platformPostId: platformPostId ?? undefined,
      publishedUrl: publishedUrl ?? undefined,
      message: publishedUrl
        ? `发布已完成。链接：${publishedUrl}`
        : '发布流程已执行，请在知乎专栏文章中确认。'
    }
  }

  static async getJobForUser(jobId: string, userId: string) {
    return prisma.publishJob.findFirst({
      where: { id: jobId, userId }
    })
  }
}
