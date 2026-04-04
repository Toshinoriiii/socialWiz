import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { AuthService } from '@/lib/services/auth.service'
import { isTokenExpired } from '@/lib/platforms/weibo/weibo-utils'
import { decryptWeiboToken } from '@/lib/utils/weibo-token-crypto'
import { WeiboAdapter } from '@/lib/platforms/weibo/weibo-adapter'
import { decrypt } from '@/lib/utils/encryption'
import {
  isPlaywrightWeiboUserId,
  weiboPlaywrightSessionExists,
  WEIBO_PLAYWRIGHT_ACCESS_TOKEN_SENTINEL
} from '@/lib/weibo-playwright/session-files'

/**
 * GET /api/platforms/weibo/[platformAccountId]/status
 * Query live=1 时额外请求微博 get_token_info（更耗配额，慎用）
 */
export async function GET(
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

    const isPlaywright =
      isPlaywrightWeiboUserId(platformAccount.platformUserId) ||
      platformAccount.accessToken === WEIBO_PLAYWRIGHT_ACCESS_TOKEN_SENTINEL

    let needsReauth = isPlaywright
      ? !platformAccount.isConnected || !weiboPlaywrightSessionExists(user.id)
      : !platformAccount.isConnected || isTokenExpired(platformAccount.tokenExpiry ?? undefined)

    const live = request.nextUrl.searchParams.get('live') === '1'
    if (!isPlaywright && live && !needsReauth && platformAccount.accessToken) {
      try {
        let appKey = process.env.WEIBO_APP_KEY || ''
        let appSecret = process.env.WEIBO_APP_SECRET || ''
        let redirectUri = process.env.WEIBO_REDIRECT_URI || ''
        if (platformAccount.weiboAppConfig) {
          appKey = platformAccount.weiboAppConfig.appId
          appSecret = decrypt(platformAccount.weiboAppConfig.appSecret)
          redirectUri = platformAccount.weiboAppConfig.callbackUrl
        }
        const adapter = new WeiboAdapter({ appKey, appSecret, redirectUri })
        const plain = decryptWeiboToken(platformAccount.accessToken)
        await adapter.probeAccessToken(plain)
      } catch {
        needsReauth = true
      }
    }

    return NextResponse.json({
      id: platformAccount.id,
      platform: platformAccount.platform,
      platformUsername: platformAccount.platformUsername,
      isConnected: platformAccount.isConnected,
      tokenExpiry: platformAccount.tokenExpiry,
      needsReauth,
      weiboAppConfigId: platformAccount.weiboAppConfigId
    })
  } catch (error) {
    console.error('获取账号状态失败:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '获取账号状态失败'
      },
      { status: 500 }
    )
  }
}
