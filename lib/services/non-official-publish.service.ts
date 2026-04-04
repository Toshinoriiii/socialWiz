import { prisma } from '@/lib/db/prisma'
import { PublishJobStatus } from '@prisma/client'
import { getPublishPlugin } from '@/lib/platforms/publish-plugins'
import { Platform } from '@/types/platform.types'
import { isWeiboBrowserSessionAccount } from '@/lib/platforms/connection-kind'
import type { PublishJobPayload } from '@/types/publish-job'
import { readWeiboPlaywrightProfile } from '@/lib/weibo-playwright/session-files'
import { normalizeWeiboSessionPublishMeta } from '@/lib/weibo-playwright/weibo-profile-status-url'
import {
  fetchWeiboStatusInsightsWithSessionCookies,
  type WeiboCookieStatusInsights
} from '@/lib/weibo-playwright/weibo-status-cookie'
import type { WeiboPublishConfigData } from '@/types/platform-config.types'

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
  title?: string
  contentType?: string
  weiboPublishConfig?: WeiboPublishConfigData
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
      title,
      contentType,
      weiboPublishConfig
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
      { imageUrls, title, contentType, weiboPublishConfig }
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

    let postInsights: WeiboCookieStatusInsights | undefined
    if (platformPostId && /^\d{5,25}$/.test(platformPostId)) {
      const ins = await fetchWeiboStatusInsightsWithSessionCookies(
        userId,
        platformPostId
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
     * 发布已成功：必须写 ContentPlatform.SUCCESS（发布记录 API 只列 SUCCESS），
     * 并把 Content 标为 PUBLISHED（草稿列表不含已发布）。
     * 即使暂时未解析到 mid/链接也落库成功，避免一直停留在 PENDING、草稿不消失。
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
            publishStatus: 'SUCCESS'
          }
        })
      }
    }

    if (contentId) {
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

  static async getJobForUser(jobId: string, userId: string) {
    return prisma.publishJob.findFirst({
      where: { id: jobId, userId }
    })
  }
}
