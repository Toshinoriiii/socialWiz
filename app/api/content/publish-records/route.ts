/**
 * 发布记录 API
 * GET /api/content/publish-records - 获取用户的发布记录（按时间倒序）
 */

import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/auth.service'
import { prisma } from '@/lib/db/prisma'

const PLATFORM_NAMES: Record<string, string> = {
  WECHAT: '微信公众号',
  WEIBO: '微博',
  DOUYIN: '抖音',
  XIAOHONGSHU: '小红书',
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('token')?.value

    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const user = await AuthService.verifyToken(token).catch(() => null)
    if (!user) {
      return NextResponse.json({ error: '无效的 token' }, { status: 401 })
    }

    const records = await prisma.contentPlatform.findMany({
      where: {
        publishStatus: 'SUCCESS',
        content: {
          userId: user.id,
        },
      },
      include: {
        content: {
          select: {
            id: true,
            title: true,
            content: true,
            coverImage: true,
            publishedAt: true,
          },
        },
        wechatConfig: {
          select: {
            accountName: true,
            appId: true,
          },
        },
        platformAccount: {
          select: {
            platformUsername: true,
            platform: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const list = records.map((r) => {
      const platform = r.wechatConfig
        ? 'WECHAT'
        : r.platformAccount?.platform || 'UNKNOWN'
      const accountName = r.wechatConfig?.accountName || r.wechatConfig?.appId ||
        r.platformAccount?.platformUsername || '-'

      return {
        id: r.id,
        contentId: r.contentId,
        platform,
        platformName: PLATFORM_NAMES[platform] || platform,
        accountName,
        title: r.content?.title || '未命名',
        contentPreview: r.content?.content?.slice(0, 200) || '',
        coverImage: r.content?.coverImage,
        publishedUrl: r.publishedUrl,
        platformContentId: r.platformContentId,
        publishStatus: r.publishStatus,
        createdAt: r.createdAt,
        publishedAt: r.content?.publishedAt,
      }
    })

    return NextResponse.json({ records: list })
  } catch (error) {
    console.error('获取发布记录失败:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}
