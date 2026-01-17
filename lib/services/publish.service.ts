import { prisma } from '@/lib/db/prisma'
import type { PublishStatus } from '@prisma/client'
import { Platform } from '@/types/platform.types'
import { WeiboAdapter } from '@/lib/platforms/weibo/weibo-adapter'
import { WechatAdapter } from '@/lib/platforms/wechat/wechat-adapter'
import type { PublishContent, PublishResult } from '@/lib/platforms/base/types'
import { isTokenExpired as isWeiboTokenExpired, calculateTokenExpiry as calculateWeiboTokenExpiry } from '@/lib/platforms/weibo/weibo-utils'
import { isTokenExpired as isWechatTokenExpired, calculateTokenExpiry as calculateWechatTokenExpiry } from '@/lib/platforms/wechat/wechat-utils'
import { getPlatformConfig } from '@/config/platform.config'

export interface PublishContentInput {
  contentId: string
  platformIds: string[]
  scheduledAt?: Date
}

/**
 * 发布服务
 */
export class PublishService {
  /**
   * 发布内容到指定平台
   */
  static async publishContent(input: PublishContentInput) {
    const { contentId, platformIds, scheduledAt } = input

    // 获取内容
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: {
        user: true
      }
    })

    if (!content) {
      throw new Error('内容不存在')
    }

    // 创建或更新平台发布记录
    const results = []
    for (const platformId of platformIds) {
      // 检查平台账号是否存在
      const platformAccount = await prisma.platformAccount.findUnique({
        where: { id: platformId }
      })

      if (!platformAccount) {
        throw new Error(`平台账号 ${platformId} 不存在`)
      }

      // 检查是否已有发布记录
      let contentPlatform = await prisma.contentPlatform.findFirst({
        where: {
          contentId,
          platformAccountId: platformId
        }
      })

      if (contentPlatform) {
        // 更新现有记录
        contentPlatform = await prisma.contentPlatform.update({
          where: { id: contentPlatform.id },
          data: {
            publishStatus: 'PENDING'
          }
        })
      } else {
        // 创建新记录
        contentPlatform = await prisma.contentPlatform.create({
          data: {
            contentId,
            platformAccountId: platformId,
            publishStatus: 'PENDING'
          }
        })
      }

      // 如果不是定时发布，立即执行发布
      if (!scheduledAt && contentPlatform) {
        try {
          await this.executePublish(contentPlatform.id, content, platformAccount)
          results.push({ platformId, status: 'SUCCESS' })
        } catch (error) {
          console.error(`发布到 ${platformAccount.platform} 失败:`, error)
          results.push({ platformId, status: 'FAILED', error: (error as Error).message })
        }
      } else {
        results.push({ platformId, status: 'SCHEDULED' })
      }
    }

    // 更新内容状态
    const newStatus = scheduledAt ? 'SCHEDULED' : 'PUBLISHED'
    await prisma.content.update({
      where: { id: contentId },
      data: {
        status: newStatus,
        publishedAt: scheduledAt || new Date()
      }
    })

    return results
  }

  /**
   * 执行发布操作
   */
  private static async executePublish(
    contentPlatformId: string,
    content: any,
    platformAccount: any
  ) {
    // 检查 Token 是否过期（根据平台类型选择不同的检查函数）
    const isExpired = platformAccount.platform === Platform.WECHAT
      ? isWechatTokenExpired(platformAccount.tokenExpiry)
      : isWeiboTokenExpired(platformAccount.tokenExpiry)

    if (isExpired) {
      // 如果有 refresh_token，尝试刷新（微博 Web 应用不支持，但保留逻辑）
      if (platformAccount.refreshToken) {
        try {
          let newTokenInfo: any
          let tokenExpiry: Date

          if (platformAccount.platform === Platform.WECHAT) {
            const adapter = new WechatAdapter({
              appId: process.env.WECHAT_APP_ID || '',
              appSecret: process.env.WECHAT_APP_SECRET || '',
              redirectUri: process.env.WECHAT_REDIRECT_URI || ''
            })

            newTokenInfo = await adapter.refreshToken(platformAccount.refreshToken)
            tokenExpiry = calculateWechatTokenExpiry(newTokenInfo.expiresIn)
          } else {
            const adapter = new WeiboAdapter({
              appKey: process.env.WEIBO_APP_KEY || '',
              appSecret: process.env.WEIBO_APP_SECRET || '',
              redirectUri: process.env.WEIBO_REDIRECT_URI || ''
            })

            newTokenInfo = await adapter.refreshToken(platformAccount.refreshToken)
            tokenExpiry = calculateWeiboTokenExpiry(newTokenInfo.expiresIn)
          }

          // 更新 token
          await prisma.platformAccount.update({
            where: { id: platformAccount.id },
            data: {
              accessToken: newTokenInfo.accessToken,
              refreshToken: newTokenInfo.refreshToken || platformAccount.refreshToken,
              tokenExpiry,
              isConnected: true
            }
          })

          // 更新 platformAccount 对象
          platformAccount.accessToken = newTokenInfo.accessToken
          platformAccount.tokenExpiry = tokenExpiry
        } catch (refreshError) {
          // 刷新失败，标记账号需要重新授权
          await prisma.platformAccount.update({
            where: { id: platformAccount.id },
            data: { isConnected: false }
          })

          await prisma.contentPlatform.update({
            where: { id: contentPlatformId },
            data: {
              publishStatus: 'FAILED',
              errorMessage: '授权已过期，请重新连接账号'
            }
          })

          throw new Error('授权已过期，请重新连接账号')
        }
      } else {
        // 没有 refresh_token，标记账号需要重新授权
        await prisma.platformAccount.update({
          where: { id: platformAccount.id },
          data: { isConnected: false }
        })

        await prisma.contentPlatform.update({
          where: { id: contentPlatformId },
          data: {
            publishStatus: 'FAILED',
            errorMessage: '授权已过期，请重新连接账号'
          }
        })

        throw new Error('授权已过期，请重新连接账号')
      }
    }

    // 根据平台类型选择适配器
    let publishResult: PublishResult

    // 准备发布内容
    const publishContent: PublishContent = {
      text: content.content || content.title || '',
      images: content.images || []
    }

    if (platformAccount.platform === Platform.WEIBO) {
      // 创建微博适配器
      const adapter = new WeiboAdapter({
        appKey: process.env.WEIBO_APP_KEY || '',
        appSecret: process.env.WEIBO_APP_SECRET || '',
        redirectUri: process.env.WEIBO_REDIRECT_URI || ''
      })

      // 调用适配器发布
      publishResult = await adapter.publish(platformAccount.accessToken, publishContent)
    } else if (platformAccount.platform === Platform.WECHAT) {
      // 创建微信公众号适配器
      const adapter = new WechatAdapter({
        appId: process.env.WECHAT_APP_ID || '',
        appSecret: process.env.WECHAT_APP_SECRET || '',
        redirectUri: process.env.WECHAT_REDIRECT_URI || ''
      })

      // 调用适配器发布
      publishResult = await adapter.publish(platformAccount.accessToken, publishContent)
    } else {
      // 其他平台暂不支持
      throw new Error(`平台 ${platformAccount.platform} 暂不支持`)
    }

    // 更新发布状态
    if (publishResult.success) {
      const updatedContentPlatform = await prisma.contentPlatform.update({
        where: { id: contentPlatformId },
        data: {
          publishStatus: 'SUCCESS',
          platformContentId: publishResult.platformPostId,
          publishedUrl: publishResult.publishedUrl
        }
      })

      // 创建分析记录
      await prisma.analytics.create({
        data: {
          contentPlatformId: updatedContentPlatform.id,
          platformAccountId: platformAccount.id,
          date: new Date(),
          views: 0,
          likes: 0,
          shares: 0,
          comments: 0
        }
      })
    } else {
      await prisma.contentPlatform.update({
        where: { id: contentPlatformId },
        data: {
          publishStatus: 'FAILED',
          errorMessage: publishResult.error || '发布失败'
        }
      })

      throw new Error(publishResult.error || '发布失败')
    }
  }

  /**
   * 取消定时发布
   */
  static async cancelScheduledPublish(contentPlatformId: string) {
    return await prisma.contentPlatform.update({
      where: { id: contentPlatformId },
      data: {
        publishStatus: 'FAILED',
        errorMessage: '已取消定时发布'
      }
    })
  }

  /**
   * 获取发布状态
   */
  static async getPublishStatus(contentId: string) {
    return await prisma.contentPlatform.findMany({
      where: { contentId },
      include: {
        platformAccount: true
      }
    })
  }

  /**
   * 重新发布失败的内容
   */
  static async retryFailedPublish(contentPlatformId: string) {
    const contentPlatform = await prisma.contentPlatform.findUnique({
      where: { id: contentPlatformId },
      include: {
        content: {
          include: {
            user: true
          }
        },
        platformAccount: true
      }
    })

    if (!contentPlatform) {
      throw new Error('发布记录不存在')
    }

    if (contentPlatform.publishStatus !== 'FAILED') {
      throw new Error('只能重试失败的发布')
    }

    // 更新状态为待发布
    await prisma.contentPlatform.update({
      where: { id: contentPlatformId },
      data: { publishStatus: 'PENDING' }
    })

    try {
      await this.executePublish(
        contentPlatformId,
        contentPlatform.content,
        contentPlatform.platformAccount
      )
      return { status: 'SUCCESS' }
    } catch (error) {
      await prisma.contentPlatform.update({
        where: { id: contentPlatformId },
        data: { publishStatus: 'FAILED' }
      })
      throw error
    }
  }
}
