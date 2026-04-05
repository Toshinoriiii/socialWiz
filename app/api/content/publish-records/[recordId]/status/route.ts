/**
 * 查询发布状态（按作品聚合）
 * GET /api/content/publish-records/[recordId]/status
 *
 * recordId 优先为 **作品/草稿 ID（contentId）**；兼容传入任一 ContentPlatform 行 ID。
 * 返回该作品下所有 SUCCESS 的平台行：平台名、账号、文章链接；微信行会按需请求 freepublish/get。
 */

import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/auth.service'
import { WechatTokenService } from '@/lib/services/wechat-token.service'
import { prisma } from '@/lib/db/prisma'

const PLATFORM_NAMES: Record<string, string> = {
  WECHAT: '微信公众号',
  WEIBO: '微博',
  DOUYIN: '抖音',
  XIAOHONGSHU: '小红书',
}

const WECHAT_STATUS_MAP: Record<number, string> = {
  0: '发布成功',
  1: '发布中',
  2: '原创声明失败',
  3: '常规失败',
  4: '平台审核不通过',
  5: '成功后用户删除所有文章',
  6: '成功后系统封禁所有文章',
}

type PublishStatusPlatformRow = {
  recordId: string
  platform: string
  platformName: string
  accountName: string
  statusText: string
  publishedUrl: string | null
  publishId?: string | null
  /** 微信 publish_status 原始值 */
  wechatPublishStatus?: number
}

async function resolveWechatRow (
  userId: string,
  wechatConfigId: string,
  platformContentId: string | null,
  storedUrl: string | null
): Promise<Pick<PublishStatusPlatformRow, 'statusText' | 'publishedUrl' | 'publishId' | 'wechatPublishStatus'>> {
  if (!platformContentId) {
    return {
      statusText: '发布成功',
      publishedUrl: storedUrl,
      publishId: null
    }
  }
  const tokenService = new WechatTokenService()
  const accessToken = await tokenService.getOrRefreshToken(userId, wechatConfigId)
  if (!accessToken) {
    return {
      statusText: '获取凭证失败',
      publishedUrl: storedUrl,
      publishId: platformContentId
    }
  }

  const getUrl = `https://api.weixin.qq.com/cgi-bin/freepublish/get?access_token=${accessToken}`
  const publishIdNum = parseInt(String(platformContentId), 10)
  const res = await fetch(getUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publish_id: publishIdNum }),
  })
  const data = (await res.json()) as {
    errcode?: number
    errmsg?: string
    publish_status?: number
    article_detail?: { item?: Array<{ article_url?: string }> }
  }

  if (data.errcode && data.errcode !== 0) {
    return {
      statusText: data.errmsg || '查询失败',
      publishedUrl: storedUrl,
      publishId: platformContentId
    }
  }

  const status = data.publish_status ?? -1
  const articleUrl =
    data.article_detail?.item?.[0]?.article_url || storedUrl
  const statusText = WECHAT_STATUS_MAP[status] || `状态 ${status}`
  return {
    statusText,
    publishedUrl: articleUrl,
    publishId: platformContentId,
    wechatPublishStatus: status
  }
}

export async function GET (
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
) {
  try {
    const token =
      request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.cookies.get('token')?.value

    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const user = await AuthService.verifyToken(token).catch(() => null)
    if (!user) {
      return NextResponse.json({ error: '无效的 token' }, { status: 401 })
    }

    const { recordId } = await params

    const ownedContent = await prisma.content.findFirst({
      where: { id: recordId, userId: user.id },
      select: { id: true, title: true },
    })

    let contentId: string
    let title: string

    if (ownedContent) {
      contentId = ownedContent.id
      title = ownedContent.title
    } else {
      const anchor = await prisma.contentPlatform.findFirst({
        where: {
          id: recordId,
          content: { userId: user.id },
        },
        include: {
          content: { select: { id: true, title: true } },
        },
      })
      if (!anchor?.content) {
        return NextResponse.json({ error: '发布记录不存在' }, { status: 404 })
      }
      contentId = anchor.contentId
      title = anchor.content.title
    }

    const rows = await prisma.contentPlatform.findMany({
      where: {
        contentId,
        publishStatus: 'SUCCESS',
        content: { userId: user.id },
      },
      include: {
        wechatConfig: {
          select: { accountName: true, appId: true },
        },
        platformAccount: {
          select: { platformUsername: true, platform: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const platforms: PublishStatusPlatformRow[] = await Promise.all(
      rows.map(async (r) => {
        const platform = r.wechatConfigId
          ? 'WECHAT'
          : r.platformAccount?.platform ?? 'UNKNOWN'
        const accountName =
          r.wechatConfig?.accountName ||
          r.wechatConfig?.appId ||
          r.platformAccount?.platformUsername ||
          '-'

        if (r.wechatConfigId) {
          const w = await resolveWechatRow(
            user.id,
            r.wechatConfigId,
            r.platformContentId,
            r.publishedUrl
          )
          return {
            recordId: r.id,
            platform,
            platformName: PLATFORM_NAMES[platform] || platform,
            accountName,
            statusText: w.statusText,
            publishedUrl: w.publishedUrl,
            publishId: w.publishId ?? r.platformContentId,
            wechatPublishStatus: w.wechatPublishStatus,
          }
        }

        return {
          recordId: r.id,
          platform,
          platformName: PLATFORM_NAMES[platform] || platform,
          accountName,
          statusText:
            r.publishStatus === 'SUCCESS'
              ? '发布成功'
              : String(r.publishStatus),
          publishedUrl: r.publishedUrl,
          publishId: r.platformContentId,
        }
      })
    )

    return NextResponse.json({
      title,
      contentId,
      platforms,
    })
  } catch (error) {
    console.error('查询发布状态失败:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
