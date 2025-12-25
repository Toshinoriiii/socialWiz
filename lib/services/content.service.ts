import { prisma } from '@/lib/db/prisma'
import type { ContentStatus, PublishStatus } from '@prisma/client'

export interface CreateContentInput {
  title: string
  content: string
  coverImage?: string
  images?: string[]
  userId: string
  platformIds?: string[]
  scheduledAt?: Date
}

export interface UpdateContentInput {
  title?: string
  content?: string
  coverImage?: string
  images?: string[]
  status?: ContentStatus
}

/**
 * 内容管理服务
 */
export class ContentService {
  /**
   * 创建内容
   */
  static async createContent(input: CreateContentInput) {
    const { platformIds, ...contentData } = input

    const content = await prisma.content.create({
      data: {
        ...contentData,
        status: input.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        contentPlatforms: platformIds
          ? {
              create: platformIds.map((platformId) => ({
                platformAccountId: platformId,
                publishStatus: 'PENDING'
              }))
            }
          : undefined
      },
      include: {
        contentPlatforms: {
          include: {
            platformAccount: true
          }
        }
      }
    })

    return content
  }

  /**
   * 获取内容列表
   */
  static async getContentList(userId: string, options?: {
    status?: ContentStatus
    skip?: number
    take?: number
  }) {
    const { status, skip = 0, take = 20 } = options || {}

    const contents = await prisma.content.findMany({
      where: {
        userId,
        ...(status && { status })
      },
      include: {
        contentPlatforms: {
          include: {
            platformAccount: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take
    })

    const total = await prisma.content.count({
      where: {
        userId,
        ...(status && { status })
      }
    })

    return { contents, total }
  }

  /**
   * 获取内容详情
   */
  static async getContentById(contentId: string) {
    return await prisma.content.findUnique({
      where: { id: contentId },
      include: {
        contentPlatforms: {
          include: {
            platformAccount: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })
  }

  /**
   * 更新内容
   */
  static async updateContent(contentId: string, input: UpdateContentInput) {
    return await prisma.content.update({
      where: { id: contentId },
      data: input,
      include: {
        contentPlatforms: {
          include: {
            platformAccount: true
          }
        }
      }
    })
  }

  /**
   * 删除内容
   */
  static async deleteContent(contentId: string) {
    // 先删除关联的平台记录
    await prisma.contentPlatform.deleteMany({
      where: { contentId }
    })

    // 删除内容
    return await prisma.content.delete({
      where: { id: contentId }
    })
  }

  /**
   * 获取用户统计数据
   */
  static async getUserStats(userId: string) {
    const [totalContent, draftCount, publishedCount, scheduledCount] = await Promise.all([
      prisma.content.count({ where: { userId } }),
      prisma.content.count({ where: { userId, status: 'DRAFT' } }),
      prisma.content.count({ where: { userId, status: 'PUBLISHED' } }),
      prisma.content.count({ where: { userId, status: 'SCHEDULED' } })
    ])

    return {
      totalContent,
      draftCount,
      publishedCount,
      scheduledCount
    }
  }
}
