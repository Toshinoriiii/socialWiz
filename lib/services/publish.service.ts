/**
 * 统一发布服务
 * 将平台配置与各平台发布方法结合，提供统一的发布接口
 */

import { prisma } from '@/lib/db/prisma'
import { Platform } from '@/types/platform.types'
import { markdownToWechatMpHtml, toPlainText } from '@/lib/utils/markdown-to-html'
import { PlatformConfigService } from '@/lib/services/platform-config.service'
import { WeiboAdapter } from '@/lib/platforms/weibo/weibo-adapter'
import { WechatAdapter } from '@/lib/platforms/wechat/wechat-adapter'
import { wechatTokenService } from '@/lib/services/wechat-token.service'
import { decrypt } from '@/lib/utils/encryption'
import { decryptWeiboToken } from '@/lib/utils/weibo-token-crypto'
import { isTokenExpired } from '@/lib/platforms/weibo/weibo-utils'
import type {
  WechatPublishConfigData,
  WeiboPublishConfigData
} from '@/types/platform-config.types'
import { isWeiboConfig } from '@/types/platform-config.types'
import {
  isWeiboBrowserSessionAccount,
  isWechatBrowserSessionAccount
} from '@/lib/platforms/connection-kind'
import {
  NonOfficialPublishService,
  type WeiboSessionPostInsights
} from '@/lib/services/non-official-publish.service'
import { absoluteUrlsForContent } from '@/lib/utils/content-image-urls'
import type { ImagePart } from '@/lib/weibo-playwright/weibo-web-pic-upload'
import {
  effectiveWeiboContentTypeFromRecord,
  weiboPublishBodyTextFallback
} from '@/lib/utils/weibo-publish-content'
import { stripMarkdownFromTitle } from '@/lib/utils/strip-markdown-title'

export interface UnifiedPublishInput {
  userId: string
  platform: Platform
  /** 账号ID：均为 PlatformAccount.id */
  accountId: string
  /** 作品/草稿 ID，写入 PublishJob 与发布记录 */
  contentId?: string
  /** 平台发布配置ID (PlatformPublishConfig) - 提供作者、原文链接等 */
  publishConfigId?: string
  title: string
  content: string
  /** 封面图 Buffer，微信公众号必填 */
  coverImage?: {
    buffer: Buffer
    filename: string
    contentType: string
  }
  /**
   * 会话型发布成功时是否跳过将 Content 标为 PUBLISHED（多平台同批发布用，结束后由前端统一 PATCH）。
   */
  deferContentPublishedUpdate?: boolean
}

export interface UnifiedPublishResult {
  success: boolean
  platformPostId?: string
  publishedUrl?: string
  message?: string
  error?: string
  /** 非官方引擎异步任务 */
  jobId?: string
  /** 前端可轮询 GET /api/platforms/publish/jobs/:jobId */
  requiresJobPolling?: boolean
  /** 微博会话发博成功后，m.weibo.cn 单帖洞察（若有） */
  postInsights?: WeiboSessionPostInsights
}

export class PublishService {
  /**
   * 微信公众号发布配置（作者、阅读原文等），官方接口与浏览器发文共用。
   */
  private static async resolveWechatPublishExtras (
    userId: string,
    publishConfigId: string | undefined
  ): Promise<{ author: string; contentSourceUrl: string }> {
    let author = ''
    let contentSourceUrl = ''
    if (publishConfigId) {
      const publishConfig = await PlatformConfigService.getConfigById(
        publishConfigId,
        userId
      )
      if (publishConfig?.platform === Platform.WECHAT) {
        const data = publishConfig.configData as WechatPublishConfigData
        if (data.type === 'wechat') {
          author = data.author || ''
          contentSourceUrl = data.contentSourceUrl || ''
        }
      }
    }
    return { author: author.trim(), contentSourceUrl: contentSourceUrl.trim() }
  }

  /**
   * 统一发布入口：根据平台路由到对应的发布实现
   */
  static async publish(input: UnifiedPublishInput): Promise<UnifiedPublishResult> {
    switch (input.platform) {
      case Platform.WECHAT:
        return this.publishWechat(input)
      case Platform.WEIBO:
        return this.publishWeibo(input)
      default:
        return {
          success: false,
          error: `暂不支持 ${input.platform} 平台发布`,
        }
    }
  }

  /**
   * 微信公众号发布（双轨，编排步骤一致）：
   * 1）上传封面素材；2）写入图文（草稿/operate_appmsg）；3）发布/群发。
   * - **浏览器会话**：逆向 mp 网页 cgi（operate_appmsg + masssend），走异步 PublishJob。
   * - **开发者凭证**：官方 draft/add + freepublish/submit（WechatAdapter 内已轮询结果），同步完成。
   */
  private static async publishWechat(input: UnifiedPublishInput): Promise<UnifiedPublishResult> {
    const {
      userId,
      accountId,
      publishConfigId,
      title,
      content,
      coverImage,
      contentId,
      deferContentPublishedUpdate
    } = input

    const platformAccount = await prisma.platformAccount.findUnique({
      where: { id: accountId }
    })
    if (!platformAccount || platformAccount.userId !== userId) {
      return { success: false, error: '平台账号不存在或无权访问' }
    }
    if (platformAccount.platform !== Platform.WECHAT) {
      return { success: false, error: '账号类型错误' }
    }
    if (!platformAccount.isConnected) {
      return { success: false, error: '账号未连接' }
    }

    const htmlContent = markdownToWechatMpHtml(content.trim())
    const digest = toPlainText(htmlContent, 120)
    const { author, contentSourceUrl } = await this.resolveWechatPublishExtras(
      userId,
      publishConfigId
    )

    /** --- 轨道 A：本机浏览器登录 mp（逆向网页接口）--- */
    if (isWechatBrowserSessionAccount(platformAccount)) {
      let coverUrl: string | undefined
      if (contentId) {
        const c = await prisma.content.findUnique({ where: { id: contentId } })
        if (c) {
          const urls = absoluteUrlsForContent(
            process.env.NEXT_PUBLIC_BASE_URL,
            c.coverImage,
            c.images
          )
          coverUrl = urls?.[0]
        }
      }
      if (!coverUrl) {
        return {
          success: false,
          error:
            '浏览器发文需要草稿带封面，且封面地址需可被微信服务器访问（配置 NEXT_PUBLIC_BASE_URL / INTERNAL_MEDIA_BASE_URL）'
        }
      }

      const r = await NonOfficialPublishService.publishWechatBrowserSession({
        userId,
        platformAccountId: accountId,
        plainText: content.trim(),
        htmlBody: htmlContent,
        title: title.trim() || '未命名',
        digest,
        coverImageUrl: coverUrl,
        contentSourceUrl,
        author,
        contentId,
        source: 'unified_publish',
        deferContentPublishedUpdate,
        coverFallback:
          coverImage != null
            ? {
                buffer: coverImage.buffer,
                filename: coverImage.filename,
                contentType: coverImage.contentType
              }
            : undefined
      })

      if (!r.success) {
        return {
          success: false,
          error: r.error,
          message: r.message,
          jobId: r.jobId,
          requiresJobPolling: !!r.jobId
        }
      }

      return {
        success: true,
        jobId: r.jobId,
        requiresJobPolling: true,
        message: r.message,
        platformPostId: r.platformPostId,
        publishedUrl: r.publishedUrl
      }
    }

    /** --- 轨道 B：AppID + AppSecret（开放平台图文接口）--- */
    const cfgId =
      (platformAccount as typeof platformAccount & {
        wechatAccountConfigId?: string | null
      }).wechatAccountConfigId ?? null
    const cfg =
      cfgId != null
        ? await prisma.wechatAccountConfig.findFirst({
            where: { id: cfgId, userId }
          })
        : null
    if (!cfg || !cfgId) {
      return {
        success: false,
        error:
          '请使用「本机浏览器」在账号管理中绑定微信公众平台，或配置有效的 AppID / AppSecret 开发者凭证'
      }
    }
    if (!cfg.isActive) {
      return { success: false, error: '微信开发者配置已停用，请在后台重新启用' }
    }
    if (!cfg.canPublish) {
      return {
        success: false,
        error:
          '当前凭证对应公众号为个人主体或未标记为可发布，官方接口无法 submit。可改用「本机浏览器」绑定后走网页发文'
      }
    }
    if (!coverImage?.buffer?.length) {
      return {
        success: false,
        error: '官方接口发布须上传封面图（multipart 中的 image）'
      }
    }

    let accessToken: string
    try {
      accessToken = await wechatTokenService.getOrRefreshToken(userId, cfg.id)
    } catch (e) {
      return {
        success: false,
        error: `获取微信公众平台 access_token 失败：${e instanceof Error ? e.message : String(e)}`
      }
    }

    const adapter = new WechatAdapter({
      appId: cfg.appId,
      appSecret: '',
      redirectUri: ''
    })

    const publishResult = await adapter.publish(accessToken, {
      title: title.trim() || '未命名',
      text: htmlContent,
      author: author || undefined,
      digest: digest || undefined,
      contentSourceUrl: contentSourceUrl || undefined,
      thumbImage: {
        buffer: coverImage.buffer,
        filename: coverImage.filename || 'cover.jpg',
        contentType: coverImage.contentType || 'image/jpeg'
      }
    })

    if (!publishResult.success) {
      return {
        success: false,
        error: publishResult.error || '微信官方接口发布失败',
        message: publishResult.errorCode
      }
    }

    return {
      success: true,
      requiresJobPolling: false,
      platformPostId: publishResult.platformPostId,
      publishedUrl: publishResult.publishedUrl,
      message: publishResult.publishedUrl
        ? `已通过官方接口发布：${publishResult.publishedUrl}`
        : '已通过官方接口提交发布'
    }
  }

  /**
   * 微博发布：配置项 + 微博发布逻辑
   */
  private static async publishWeibo(input: UnifiedPublishInput): Promise<UnifiedPublishResult> {
    const {
      userId,
      accountId,
      content,
      contentId,
      title,
      publishConfigId,
      coverImage,
      deferContentPublishedUpdate
    } = input

    let weiboPublishConfig: WeiboPublishConfigData | undefined
    if (publishConfigId) {
      const pc = await PlatformConfigService.getConfigById(
        publishConfigId,
        userId
      )
      if (pc?.platform === Platform.WEIBO && isWeiboConfig(pc.configData)) {
        weiboPublishConfig = pc.configData
      }
    }

    // 1. 查找平台账号（含微博应用配置）
    const platformAccount = await prisma.platformAccount.findUnique({
      where: { id: accountId },
      include: { weiboAppConfig: true }
    })
    if (!platformAccount) {
      return { success: false, error: '平台账号不存在' }
    }
    if (platformAccount.userId !== userId) {
      return { success: false, error: '无权访问此账号' }
    }
    if (!platformAccount.isConnected) {
      return { success: false, error: '账号未连接，请先连接账号' }
    }
    if (isWeiboBrowserSessionAccount(platformAccount)) {
      let text = content.trim()
      let imageUrls: string[] | undefined
      let contentType: string | undefined
      let weiboTitle: string | undefined = title.trim() || undefined
      let coverImagePart: ImagePart | undefined
      if (coverImage?.buffer?.length) {
        coverImagePart = {
          buffer: coverImage.buffer,
          mime: coverImage.contentType || 'image/jpeg'
        }
      }
      if (contentId) {
        const c = await prisma.content.findUnique({ where: { id: contentId } })
        if (c) {
          if (!weiboTitle && c.title) weiboTitle = c.title
          contentType = effectiveWeiboContentTypeFromRecord(c)
          text = (c.content || text).trim()
          imageUrls = absoluteUrlsForContent(
            process.env.NEXT_PUBLIC_BASE_URL,
            c.coverImage,
            c.images
          )
        }
      }
      if (weiboTitle) {
        const plain = stripMarkdownFromTitle(weiboTitle)
        weiboTitle = plain.length > 0 ? plain : undefined
      }
      text = weiboPublishBodyTextFallback({
        text,
        imageUrls,
        title: weiboTitle
      })
      if (!text) {
        return { success: false, error: '内容不能为空' }
      }
      const r = await NonOfficialPublishService.publishWeiboBrowserSession({
        userId,
        platformAccountId: accountId,
        text,
        contentId,
        source: 'unified_publish',
        imageUrls,
        coverImagePart,
        title: weiboTitle,
        contentType,
        weiboPublishConfig,
        deferContentPublishedUpdate
      })
      if (!r.success) {
        return {
          success: false,
          error: r.error,
          message: r.message,
          jobId: r.jobId,
          requiresJobPolling: !!r.jobId
        }
      }
      return {
        success: true,
        jobId: r.jobId,
        requiresJobPolling: true,
        message: r.message,
        platformPostId: r.platformPostId,
        publishedUrl: r.publishedUrl,
        postInsights: r.postInsights
      }
    }
    if (isTokenExpired(platformAccount.tokenExpiry ?? undefined)) {
      return {
        success: false,
        error: '微博授权已过期，请在账号管理重新绑定微博'
      }
    }

    let appKey = process.env.WEIBO_APP_KEY || ''
    let appSecret = process.env.WEIBO_APP_SECRET || ''
    let redirectUri = process.env.WEIBO_REDIRECT_URI || ''
    if (platformAccount.weiboAppConfig) {
      appKey = platformAccount.weiboAppConfig.appId
      try {
        appSecret = decrypt(platformAccount.weiboAppConfig.appSecret)
      } catch {
        return { success: false, error: '微博应用配置解密失败，请重新保存应用凭证' }
      }
      redirectUri = platformAccount.weiboAppConfig.callbackUrl
    }

    const accessToken = decryptWeiboToken(platformAccount.accessToken)
    if (!accessToken) {
      return { success: false, error: '无法读取微博访问令牌，请重新绑定' }
    }

    const adapter = new WeiboAdapter({
      appKey,
      appSecret,
      redirectUri
    })

    const publishText = content.trim()
    if (!publishText) {
      return { success: false, error: '内容不能为空' }
    }

    const result = await adapter.publish(accessToken, {
      text: publishText,
    })

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      }
    }

    return {
      success: true,
      platformPostId: result.platformPostId,
      publishedUrl: result.publishedUrl,
      message: '内容已成功发布到微博',
    }
  }

  /** 旧版 POST /api/publish（contentId + platformIds）占位，避免调用方与类型断裂 */
  static async publishContent(_body: Record<string, unknown>): Promise<{
    results: UnifiedPublishResult[]
  }> {
    return {
      results: [
        {
          success: false,
          error:
            '聚合发布尚未实现：请使用 /api/platforms/wechat 或 /api/platforms/weibo 下的发布接口',
        },
      ],
    }
  }
}
