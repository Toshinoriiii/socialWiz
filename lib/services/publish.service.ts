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
import type { WechatPublishConfigData } from '@/types/platform-config.types'

export interface UnifiedPublishInput {
  userId: string
  platform: Platform
  /** 账号ID：WECHAT=WechatAccountConfig.id, WEIBO=PlatformAccount.id */
  accountId: string
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
    const { userId, accountId, publishConfigId, content } = input

    // 1. 查找平台账号
    const platformAccount = await prisma.platformAccount.findUnique({
      where: { id: accountId },
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

    // 2. 从 PlatformPublishConfig 获取可见性等配置（可选，当前微博适配器仅用 text）
    // 后续可扩展 visibility、allowComment 等

    // 3. 调用微博适配器发布
    const adapter = new WeiboAdapter({
      appKey: process.env.WEIBO_APP_KEY || '',
      appSecret: process.env.WEIBO_APP_SECRET || '',
      redirectUri: process.env.WEIBO_REDIRECT_URI || '',
    })

    const publishText = content.trim()
    if (!publishText) {
      return { success: false, error: '内容不能为空' }
    }

    const result = await adapter.publish(platformAccount.accessToken, {
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
}
