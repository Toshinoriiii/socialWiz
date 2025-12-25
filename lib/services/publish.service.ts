import { prisma } from '@/lib/db/prisma'
import type { PublishStatus } from '@prisma/client'

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
            publishStatus: scheduledAt ? 'PENDING' : 'PUBLISHING',
            scheduledAt
          }
        })
      } else {
        // 创建新记录
        contentPlatform = await prisma.contentPlatform.create({
          data: {
            contentId,
            platformAccountId: platformId,
            publishStatus: scheduledAt ? 'PENDING' : 'PUBLISHING',
            scheduledAt
          }
        })
      }

      // 如果不是定时发布，立即执行发布
      if (!scheduledAt) {
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
    // 这里是示例，实际需要根据不同平台调用对应的API
    // 可以集成到 lib/integrations 中的平台服务

    console.log(`正在发布到 ${platformAccount.platform}...`)
    console.log('内容:', content.title, content.content)

    // 模拟发布过程
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 更新发布状态
    await prisma.contentPlatform.update({
      where: { id: contentPlatformId },
      data: {
        publishStatus: 'SUCCESS',
        publishedAt: new Date(),
        platformPostId: `${platformAccount.platform}_${Date.now()}`
      }
    })

    // 创建分析记录
    await prisma.analytics.create({
      data: {
        contentId: content.id,
        platformAccountId: platformAccount.id,
        views: 0,
        likes: 0,
        shares: 0,
        comments: 0
      }
    })
  }

  /**
   * 取消定时发布
   */
  static async cancelScheduledPublish(contentPlatformId: string) {
    return await prisma.contentPlatform.update({
      where: { id: contentPlatformId },
      data: {
        publishStatus: 'CANCELLED',
        scheduledAt: null
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

    // 更新状态为发布中
    await prisma.contentPlatform.update({
      where: { id: contentPlatformId },
      data: { publishStatus: 'PUBLISHING' }
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
