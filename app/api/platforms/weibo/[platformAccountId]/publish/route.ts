import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { AuthService } from '@/lib/services/auth.service'
import { WeiboAdapter } from '@/lib/platforms/weibo/weibo-adapter'
import type { PublishContent } from '@/lib/platforms/base/types'
import { decrypt } from '@/lib/utils/encryption'
import { decryptWeiboToken } from '@/lib/utils/weibo-token-crypto'
import { isTokenExpired } from '@/lib/platforms/weibo/weibo-utils'
import { isWeiboBrowserSessionAccount } from '@/lib/platforms/connection-kind'
import { NonOfficialPublishService } from '@/lib/services/non-official-publish.service'
import { absoluteUrlsForContent } from '@/lib/utils/content-image-urls'
import {
  effectiveWeiboContentTypeFromRecord,
  weiboPublishBodyTextFallback
} from '@/lib/utils/weibo-publish-content'
import { finalizeWeiboIdsForContentPlatform } from '@/lib/services/non-official-publish.service'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * POST /api/platforms/weibo/[platformAccountId]/publish
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ platformAccountId: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权，请先登录' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const user = await AuthService.verifyToken(token)

    const { platformAccountId } = await context.params

    const body = await request.json()
    const {
      contentId,
      text,
      imageUrls: bodyImageUrls,
      title: bodyTitle,
      contentType: bodyContentType
    } = body as {
      contentId?: string
      text?: string
      imageUrls?: string[]
      title?: string
      contentType?: string
    }

    if (!text && !contentId) {
      return NextResponse.json({ error: '内容或内容ID不能为空' }, { status: 400 })
    }

    const platformAccount = await prisma.platformAccount.findUnique({
      where: { id: platformAccountId },
      include: { weiboAppConfig: true }
    })

    if (!platformAccount) {
      return NextResponse.json({ error: '平台账号不存在' }, { status: 404 })
    }

    if (platformAccount.userId !== user.id) {
      return NextResponse.json({ error: '无权访问此账号' }, { status: 403 })
    }

    if (!platformAccount.isConnected) {
      return NextResponse.json({ error: '账号未连接，请先连接账号' }, { status: 400 })
    }

    if (isWeiboBrowserSessionAccount(platformAccount)) {
      let publishText = text as string | undefined
      let fromContentTitle: string | undefined
      let fromContentType: string | undefined
      let fromContentImages: string[] | undefined
      if (contentId) {
        const content = await prisma.content.findUnique({
          where: { id: contentId }
        })
        if (!content) {
          return NextResponse.json({ error: '内容不存在' }, { status: 404 })
        }
        if (!publishText) {
          publishText = content.content || content.title || ''
        }
        fromContentTitle = content.title
        fromContentType = effectiveWeiboContentTypeFromRecord(content)
        fromContentImages = absoluteUrlsForContent(
          process.env.NEXT_PUBLIC_BASE_URL,
          content.coverImage,
          content.images
        )
      }
      const imageUrls =
        Array.isArray(bodyImageUrls) && bodyImageUrls.length > 0
          ? bodyImageUrls.filter((u: string) => typeof u === 'string').slice(0, 9)
          : fromContentImages
      const mergedTitle =
        typeof bodyTitle === 'string' && bodyTitle.trim()
          ? bodyTitle.trim()
          : fromContentTitle
      const mergedContentType =
        typeof bodyContentType === 'string' && bodyContentType.trim()
          ? bodyContentType.trim()
          : fromContentType
      const bodyText = weiboPublishBodyTextFallback({
        text: (publishText ?? '').trim(),
        imageUrls,
        title: mergedTitle
      })
      if (!bodyText) {
        return NextResponse.json({ error: '内容不能为空' }, { status: 400 })
      }
      const r = await NonOfficialPublishService.publishWeiboBrowserSession({
        userId: user.id,
        platformAccountId,
        text: bodyText,
        contentId: contentId as string | undefined,
        source: 'weibo_account_publish',
        imageUrls,
        title: mergedTitle,
        contentType: mergedContentType
      })
      if (!r.success) {
        return NextResponse.json(
          {
            success: false,
            error: r.error,
            hint: r.message,
            jobId: r.jobId,
            requiresJobPolling: !!r.jobId
          },
          { status: 400 }
        )
      }
      return NextResponse.json({
        success: true,
        jobId: r.jobId,
        requiresJobPolling: true,
        message: r.message,
        platformPostId: r.platformPostId,
        publishedUrl: r.publishedUrl,
        postInsights: r.postInsights
      })
    }

    if (isTokenExpired(platformAccount.tokenExpiry ?? undefined)) {
      return NextResponse.json(
        { success: false, error: '微博授权已过期，请在账号管理重新绑定微博' },
        { status: 401 }
      )
    }

    let publishText = text as string | undefined
    if (contentId && !publishText) {
      const content = await prisma.content.findUnique({
        where: { id: contentId }
      })

      if (!content) {
        return NextResponse.json({ error: '内容不存在' }, { status: 404 })
      }

      publishText = content.content || content.title || ''
    }

    let appKey = process.env.WEIBO_APP_KEY || ''
    let appSecret = process.env.WEIBO_APP_SECRET || ''
    let redirectUri = process.env.WEIBO_REDIRECT_URI || ''
    if (platformAccount.weiboAppConfig) {
      appKey = platformAccount.weiboAppConfig.appId
      try {
        appSecret = decrypt(platformAccount.weiboAppConfig.appSecret)
      } catch {
        return NextResponse.json(
          { success: false, error: '微博应用配置解密失败' },
          { status: 500 }
        )
      }
      redirectUri = platformAccount.weiboAppConfig.callbackUrl
    } else if (!appKey || !appSecret) {
      return NextResponse.json(
        { success: false, error: '未配置微博应用密钥，请设置环境变量或添加应用凭证' },
        { status: 500 }
      )
    }

    const adapter = new WeiboAdapter({
      appKey,
      appSecret,
      redirectUri
    })

    const publishContent: PublishContent = {
      text: publishText || ''
    }

    const accessToken = decryptWeiboToken(platformAccount.accessToken)
    const result = await adapter.publish(accessToken, publishContent)

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

    if (contentId) {
      const wr = await finalizeWeiboIdsForContentPlatform(
        user.id,
        result.platformPostId ?? null,
        result.publishedUrl ?? null
      )
      const cpId = wr.platformPostId ?? result.platformPostId
      const pubUrl = wr.publishedUrl ?? result.publishedUrl
      const existing = await prisma.contentPlatform.findFirst({
        where: {
          contentId,
          platformAccountId
        }
      })
      if (existing) {
        await prisma.contentPlatform.update({
          where: { id: existing.id },
          data: {
            platformContentId: cpId,
            publishedUrl: pubUrl,
            ...(wr.weiboTimelineMid ? { weiboTimelineMid: wr.weiboTimelineMid } : {}),
            platformPublishedAt: new Date(),
            publishStatus: 'SUCCESS'
          }
        })
      } else {
        await prisma.contentPlatform.create({
          data: {
            contentId,
            platformAccountId,
            platformContentId: cpId,
            publishedUrl: pubUrl,
            ...(wr.weiboTimelineMid ? { weiboTimelineMid: wr.weiboTimelineMid } : {}),
            platformPublishedAt: new Date(),
            publishStatus: 'SUCCESS'
          }
        })
      }
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
