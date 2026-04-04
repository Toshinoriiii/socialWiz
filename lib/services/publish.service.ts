/**
 * 统一发布服务
 * 将平台配置与各平台发布方法结合，提供统一的发布接口
 */

import { prisma } from '@/lib/db/prisma'
import { Platform } from '@/types/platform.types'
import { markdownToHtml, toPlainText } from '@/lib/utils/markdown-to-html'
import { WechatAdapter } from '@/lib/platforms/wechat/wechat-adapter'
import { WechatTokenService } from '@/lib/services/wechat-token.service'
import { WechatConfigService } from '@/lib/services/wechat-config.service'
import { PlatformConfigService } from '@/lib/services/platform-config.service'
import { WeiboAdapter } from '@/lib/platforms/weibo/weibo-adapter'
import { decrypt } from '@/lib/utils/encryption'
import { decryptWeiboToken } from '@/lib/utils/weibo-token-crypto'
import { isTokenExpired } from '@/lib/platforms/weibo/weibo-utils'
import type {
  WechatPublishConfigData,
  WeiboPublishConfigData
} from '@/types/platform-config.types'
import { isWeiboConfig } from '@/types/platform-config.types'
import { isWeiboBrowserSessionAccount } from '@/lib/platforms/connection-kind'
import {
  NonOfficialPublishService,
  type WeiboSessionPostInsights
} from '@/lib/services/non-official-publish.service'
import { absoluteUrlsForContent } from '@/lib/utils/content-image-urls'

export interface UnifiedPublishInput {
  userId: string
  platform: Platform
  /** 账号ID：WECHAT=WechatAccountConfig.id, WEIBO=PlatformAccount.id */
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
   * 微信公众号发布：配置项 + 微信发布逻辑
   */
  private static async publishWechat(input: UnifiedPublishInput): Promise<UnifiedPublishResult> {
    const { userId, accountId, publishConfigId, title, content, coverImage } = input

    if (!coverImage) {
      return { success: false, error: '封面图片不能为空' }
    }

    // 1. 验证微信配置（accountId = WechatAccountConfig id）
    const configService = new WechatConfigService()
    const config = await configService.getConfigById(accountId, userId)
    if (!config) {
      return { success: false, error: '配置不存在或无权访问' }
    }
    if (!config.isActive) {
      return { success: false, error: '配置已禁用，请先激活配置' }
    }
    if (config.subjectType === 'personal' || !config.canPublish) {
      return { success: false, error: '个人主体公众号不支持发布功能' }
    }

    // 2. 从 PlatformPublishConfig 获取作者、原文链接等配置项
    let author = ''
    let contentSourceUrl = ''
    if (publishConfigId) {
      const publishConfig = await PlatformConfigService.getConfigById(publishConfigId, userId)
      if (publishConfig && publishConfig.platform === Platform.WECHAT) {
        const data = publishConfig.configData as WechatPublishConfigData
        if (data.type === 'wechat') {
          author = data.author || ''
          contentSourceUrl = data.contentSourceUrl || ''
        }
      }
    }

    // 3. 获取 access_token
    const tokenService = new WechatTokenService()
    const accessToken = await tokenService.getOrRefreshToken(userId, accountId)
    if (!accessToken) {
      return { success: false, error: '获取 access_token 失败' }
    }

    // 4. 调用微信适配器发布
    const adapter = new WechatAdapter({
      appId: config.appId,
      appSecret: '',
      redirectUri: '',
    })

    const htmlContent = markdownToHtml(content.trim())
    const digest = toPlainText(htmlContent, 120)
    const result = await adapter.publish(accessToken, {
      text: htmlContent,
      title: title.trim(),
      author: author.trim(),
      digest,
      contentSourceUrl: contentSourceUrl.trim(),
      thumbImage: {
        buffer: coverImage.buffer,
        filename: coverImage.filename,
        contentType: coverImage.contentType,
      },
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
      message: '内容已成功发布到微信公众号',
    }
  }

  /**
   * 微博发布：配置项 + 微博发布逻辑
   */
  private static async publishWeibo(input: UnifiedPublishInput): Promise<UnifiedPublishResult> {
    const { userId, accountId, content, contentId, title, publishConfigId } = input

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
      if (contentId) {
        const c = await prisma.content.findUnique({ where: { id: contentId } })
        if (c) {
          if (!weiboTitle && c.title) weiboTitle = c.title
          contentType = c.contentType ?? undefined
          text = (c.content || text).trim()
          imageUrls = absoluteUrlsForContent(
            process.env.NEXT_PUBLIC_BASE_URL,
            c.coverImage,
            c.images
          )
        }
      }
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
        title: weiboTitle,
        contentType,
        weiboPublishConfig
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
