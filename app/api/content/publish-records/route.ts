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

/**
 * 发布记录列表缩略图：封面优先，图文作品通常只有 images[] 无 coverImage。
 */
function pickContentThumbUrl (
  coverImage: string | null | undefined,
  images: string[] | null | undefined
): string | null {
  const cover = coverImage?.trim()
  const firstImg = images
    ?.map((s) => (typeof s === 'string' ? s.trim() : ''))
    .find((s) => s.length > 0)
  const raw = cover || firstImg || null
  if (!raw) return null
  return normalizeMediaUrlForBrowser(raw)
}

/**
 * `public/content-images` 若存成 http://127.0.0.1:3000/content-images/... ，
 * 与当前浏览器域名不一致时会裂图；统一为站内相对路径。
 */
function normalizeMediaUrlForBrowser (raw: string): string {
  const t = raw.trim()
  if (!t) return t
  if (t.startsWith('/')) return t
  try {
    const u = new URL(t)
    if (u.pathname.startsWith('/content-images/')) {
      return `${u.pathname}${u.search}${u.hash}`
    }
  } catch {
    /* 非绝对 URL */
  }
  return t
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
            images: true,
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
        coverImage: pickContentThumbUrl(
          r.content?.coverImage,
          r.content?.images
        ),
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
