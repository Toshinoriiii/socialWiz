// lib/services/content-generation.service.ts

import { PrismaClient } from '@prisma/client'
import type {
  ContentGenerationInput,
  ContentOutput,
} from '@/types/content-generation.types'

const prisma = new PrismaClient()

/**
 * 内容生成服务
 * 负责管理内容生成请求的生命周期
 */
export class ContentGenerationService {
  /**
   * 创建内容生成请求
   */
  async createRequest(input: ContentGenerationInput) {
    const request = await prisma.contentGenerationRequest.create({
      data: {
        userId: input.userId,
        prompt: input.prompt,
        platform: input.platform?.toUpperCase() as any,
        style: input.style,
        status: 'PENDING',
      },
    })

    return request
  }

  /**
   * 更新请求状态
   */
  async updateRequestStatus(
    requestId: string,
    status: 'PENDING' | 'SEARCHING' | 'CREATING' | 'GENERATING_IMAGE' | 'COMPLETED' | 'FAILED'
  ) {
    return prisma.contentGenerationRequest.update({
      where: { id: requestId },
      data: { status },
    })
  }

  /**
   * 保存生成的内容
   */
  async saveGeneratedContent(
    requestId: string,
    content: {
      title?: string
      body: string
      tags?: string[]
      imageUrl?: string
      imagePrompt?: string
      platform?: string
      searchResults?: any
    }
  ) {
    return prisma.generatedContent.create({
      data: {
        requestId,
        title: content.title,
        body: content.body,
        tags: content.tags || [],
        imageUrl: content.imageUrl,
        imagePrompt: content.imagePrompt,
        platform: content.platform?.toUpperCase() as any,
        searchResults: content.searchResults,
      },
    })
  }

  /**
   * 获取请求详情
   */
  async getRequest(requestId: string) {
    return prisma.contentGenerationRequest.findUnique({
      where: { id: requestId },
      include: {
        content: true,
        workflowExecution: {
          include: {
            steps: true,
          },
        },
      },
    })
  }

  /**
   * 获取用户的内容历史
   */
  async getUserContentHistory(userId: string, limit = 20, offset = 0) {
    return prisma.contentGenerationRequest.findMany({
      where: { userId },
      include: {
        content: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    })
  }

  /**
   * 删除请求
   */
  async deleteRequest(requestId: string, userId: string) {
    // 验证请求属于该用户
    const request = await prisma.contentGenerationRequest.findFirst({
      where: {
        id: requestId,
        userId,
      },
    })

    if (!request) {
      throw new Error('请求不存在或无权限删除')
    }

    return prisma.contentGenerationRequest.delete({
      where: { id: requestId },
    })
  }

  /**
   * 保存用户反馈
   */
  async saveFeedback(requestId: string, rating: number, feedback?: string) {
    const content = await prisma.generatedContent.findUnique({
      where: { requestId },
    })

    if (!content) {
      throw new Error('内容不存在')
    }

    return prisma.generatedContent.update({
      where: { requestId },
      data: {
        rating,
        feedback,
      },
    })
  }
}

export const contentGenerationService = new ContentGenerationService()
