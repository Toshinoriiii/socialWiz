import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { AuthService } from '@/lib/services/auth.service'
import { WechatAdapter } from '@/lib/platforms/wechat/wechat-adapter'
import { getPlatformConfig } from '@/config/platform.config'
import { Platform } from '@/types/platform.types'
import type { PublishContent } from '@/lib/platforms/base/types'

/**
 * POST /api/platforms/wechat/[platformAccountId]/publish
 * 发布内容到微信公众号
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { platformAccountId: string } }
) {
  try {
    // 验证用户身份
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '未授权，请先登录' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const user = await AuthService.verifyToken(token)

    const { platformAccountId } = params

    // 解析请求体
    const body = await request.json()
    const { contentId, text } = body

    if (!text && !contentId) {
      return NextResponse.json(
        { error: '内容或内容ID不能为空' },
        { status: 400 }
      )
    }

    // 查找平台账号
    const platformAccount = await prisma.platformAccount.findUnique({
      where: { id: platformAccountId }
    })

    if (!platformAccount) {
      return NextResponse.json(
        { error: '平台账号不存在' },
        { status: 404 }
      )
    }

    // 验证账号属于当前用户
    if (platformAccount.userId !== user.id) {
      return NextResponse.json(
        { error: '无权访问此账号' },
        { status: 403 }
      )
    }

    // 验证账号已连接
    if (!platformAccount.isConnected) {
      return NextResponse.json(
        { error: '账号未连接，请先连接账号' },
        { status: 400 }
      )
    }

    // 如果提供了 contentId，从数据库获取内容
    let publishText = text
    if (contentId && !text) {
      const content = await prisma.content.findUnique({
        where: { id: contentId }
      })

      if (!content) {
        return NextResponse.json(
          { error: '内容不存在' },
          { status: 404 }
        )
      }

      publishText = content.content || content.title || ''
    }

    // 创建适配器
    const wechatConfig = getPlatformConfig(Platform.WECHAT)
    const adapter = new WechatAdapter({
      appId: process.env.WECHAT_APP_ID || '',
      appSecret: process.env.WECHAT_APP_SECRET || '',
      redirectUri: process.env.WECHAT_REDIRECT_URI || ''
    })

    // 准备发布内容
    const publishContent: PublishContent = {
      text: publishText
    }

    // 发布内容
    const result = await adapter.publish(platformAccount.accessToken, publishContent)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          errorCode: result.errorCode
        },
        { status: 400 }
      )
    }

    // 如果提供了 contentId，更新 ContentPlatform 记录
    if (contentId) {
      await prisma.contentPlatform.upsert({
        where: {
          contentId_platformAccountId: {
            contentId,
            platformAccountId
          }
        },
        create: {
          contentId,
          platformAccountId,
          platformContentId: result.platformPostId,
          publishedUrl: result.publishedUrl,
          publishStatus: 'SUCCESS'
        },
        update: {
          platformContentId: result.platformPostId,
          publishedUrl: result.publishedUrl,
          publishStatus: 'SUCCESS'
        }
      })
    }

    return NextResponse.json({
      success: true,
      platformPostId: result.platformPostId,
      publishedUrl: result.publishedUrl
    })
  } catch (error) {
    console.error('发布内容失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '发布失败'
      },
      { status: 500 }
    )
  }
}
