/**
 * 统一发布接口
 * POST /api/platforms/publish
 *
 * 将平台配置与各平台发布方法结合，根据 platform 路由到对应实现。
 *
 * 请求格式: FormData
 * - contentId: string (作品/草稿 ID，用于更新状态并创建发布记录)
 * - platform: string (WECHAT | WEIBO)
 * - accountId: string (账号ID：WECHAT=WechatAccountConfig.id, WEIBO=PlatformAccount.id)
 * - publishConfigId?: string (PlatformPublishConfig id，提供作者、原文链接等)
 * - title: string (标题)
 * - content: string (内容)
 * - coverImage?: File (封面图片，WECHAT 必填)
 */

import { NextRequest, NextResponse } from 'next/server'
import { verify } from 'jsonwebtoken'
import { Platform } from '@/types/platform.types'
import { prisma } from '@/lib/db/prisma'
import { PublishService } from '@/lib/services/publish.service'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

function getUserIdFromRequest(request: NextRequest): string | null {
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

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', details: '请先登录' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const contentId = (formData.get('contentId') as string) || undefined
    const platform = formData.get('platform') as string
    const accountId = formData.get('accountId') as string
    const publishConfigId = (formData.get('publishConfigId') as string) || undefined
    const title = (formData.get('title') as string) || ''
    const content = (formData.get('content') as string) || ''
    const imageFile = formData.get('image') as File | null

    if (!platform || !accountId) {
      return NextResponse.json(
        { error: 'Invalid request', details: 'platform 和 accountId 不能为空' },
        { status: 400 }
      )
    }

    if (!contentId) {
      return NextResponse.json(
        { error: 'Invalid request', details: 'contentId 不能为空' },
        { status: 400 }
      )
    }

    if (!Object.values(Platform).includes(platform as Platform)) {
      return NextResponse.json(
        { error: 'Invalid request', details: `不支持的平台: ${platform}` },
        { status: 400 }
      )
    }

    if (!content?.trim()) {
      return NextResponse.json(
        { error: 'Invalid request', details: '内容不能为空' },
        { status: 400 }
      )
    }

    // 微信公众号需要标题和封面图
    if (platform === Platform.WECHAT) {
      if (!title?.trim()) {
        return NextResponse.json(
          { error: 'Invalid request', details: '标题不能为空' },
          { status: 400 }
        )
      }
      if (!imageFile) {
        return NextResponse.json(
          { error: 'Missing image', details: '封面图片不能为空' },
          { status: 400 }
        )
      }
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
      if (!allowedTypes.includes(imageFile.type)) {
        return NextResponse.json(
          { error: 'Invalid file type', details: '只支持 JPG/PNG 格式的图片' },
          { status: 400 }
        )
      }
      const maxSize = 2 * 1024 * 1024
      if (imageFile.size > maxSize) {
        return NextResponse.json(
          {
            error: 'File too large',
            details: `图片大小不能超过 2MB，当前 ${(imageFile.size / 1024 / 1024).toFixed(2)}MB`,
          },
          { status: 400 }
        )
      }
    }

    let coverImage: { buffer: Buffer; filename: string; contentType: string } | undefined
    if (imageFile) {
      const arrayBuffer = await imageFile.arrayBuffer()
      coverImage = {
        buffer: Buffer.from(arrayBuffer),
        filename: imageFile.name || 'cover.jpg',
        contentType: imageFile.type || 'image/jpeg',
      }
    }

    const result = await PublishService.publish({
      userId,
      platform: platform as Platform,
      accountId,
      publishConfigId,
      title: title.trim(),
      content: content.trim(),
      coverImage,
    })

    if (!result.success) {
      const status = result.error?.includes('无权') ? 403 :
        result.error?.includes('不存在') ? 404 : 500
      return NextResponse.json(
        {
          error: 'Publish failed',
          success: false,
          details: result.error,
        },
        { status }
      )
    }

    // 发布成功：更新作品状态为已发布，创建发布记录
    try {
      const contentRecord = await prisma.content.findFirst({
        where: { id: contentId, userId },
      })
      if (contentRecord) {
        await prisma.content.update({
          where: { id: contentId },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
            updatedAt: new Date(),
          },
        })
        if (platform === Platform.WECHAT) {
          const existing = await prisma.contentPlatform.findFirst({
            where: { contentId, wechatConfigId: accountId },
          })
          if (existing) {
            await prisma.contentPlatform.update({
              where: { id: existing.id },
              data: {
                platformContentId: result.platformPostId ?? undefined,
                publishedUrl: result.publishedUrl ?? undefined,
                publishStatus: 'SUCCESS',
              },
            })
          } else {
            await prisma.contentPlatform.create({
              data: {
                contentId,
                wechatConfigId: accountId,
                platformContentId: result.platformPostId ?? undefined,
                publishedUrl: result.publishedUrl ?? undefined,
                publishStatus: 'SUCCESS',
              },
            })
          }
        } else if (platform === Platform.WEIBO) {
          const existing = await prisma.contentPlatform.findFirst({
            where: { contentId, platformAccountId: accountId },
          })
          if (existing) {
            await prisma.contentPlatform.update({
              where: { id: existing.id },
              data: {
                platformContentId: result.platformPostId ?? undefined,
                publishedUrl: result.publishedUrl ?? undefined,
                publishStatus: 'SUCCESS',
              },
            })
          } else {
            await prisma.contentPlatform.create({
              data: {
                contentId,
                platformAccountId: accountId,
                platformContentId: result.platformPostId ?? undefined,
                publishedUrl: result.publishedUrl ?? undefined,
                publishStatus: 'SUCCESS',
              },
            })
          }
        }
      }
    } catch (dbError) {
      console.error('[Unified Publish API] 更新发布记录失败:', dbError)
      // 不阻塞返回，发布已成功
    }

    return NextResponse.json({
      success: true,
      platformPostId: result.platformPostId,
      publishedUrl: result.publishedUrl,
      message: result.message,
    })
  } catch (error) {
    console.error('[Unified Publish API] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : '服务器处理请求时发生错误',
      },
      { status: 500 }
    )
  }
}
