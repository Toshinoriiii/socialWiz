import { NextRequest, NextResponse } from 'next/server'
import { WeiboAdapter } from '@/lib/platforms/weibo/weibo-adapter'
import { validateOAuthState } from '@/lib/utils/oauth-state'
import { Platform } from '@/types/platform.types'
import { prisma } from '@/lib/db/prisma'
import { calculateTokenExpiry } from '@/lib/platforms/weibo/weibo-utils'
import { encryptWeiboToken } from '@/lib/utils/weibo-token-crypto'
import { weiboAppConfigService } from '@/lib/services/weibo-app-config.service'

function redirectToAccounts(request: NextRequest, query: string) {
  const origin = new URL(request.url).origin
  return NextResponse.redirect(new URL(`/accounts${query}`, origin))
}

/**
 * GET /api/platforms/weibo/auth/callback
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    if (error) {
      console.error('OAuth 回调错误:', error, errorDescription)
      return redirectToAccounts(
        request,
        `?platform=weibo&status=error&error=${encodeURIComponent(errorDescription || error)}`
      )
    }

    if (!code || !state) {
      return redirectToAccounts(
        request,
        '/?platform=weibo&status=error&error=' + encodeURIComponent('缺少必要参数')
      )
    }

    const stateData = await validateOAuthState(state, 'weibo')
    if (!stateData) {
      return redirectToAccounts(
        request,
        '/?platform=weibo&status=error&error=' + encodeURIComponent('State验证失败')
      )
    }

    let appKey: string
    let appSecret: string
    let redirectUri: string

    if (stateData.weiboAppConfigId) {
      const creds = await weiboAppConfigService.getSecretsForOAuth(
        stateData.weiboAppConfigId,
        stateData.userId
      )
      if (!creds) {
        return redirectToAccounts(
          request,
          '/?platform=weibo&status=error&error=' + encodeURIComponent('微博应用配置无效')
        )
      }
      appKey = creds.appId
      appSecret = creds.appSecret
      redirectUri = creds.callbackUrl
    } else {
      appKey = process.env.WEIBO_APP_KEY || ''
      appSecret = process.env.WEIBO_APP_SECRET || ''
      redirectUri =
        process.env.WEIBO_REDIRECT_URI ||
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/platforms/weibo/auth/callback`
      if (!appKey || !appSecret) {
        return redirectToAccounts(
          request,
          '/?platform=weibo&status=error&error=' + encodeURIComponent('微博配置未设置')
        )
      }
    }

    const adapter = new WeiboAdapter({
      appKey,
      appSecret,
      redirectUri
    })

    const tokenInfo = await adapter.exchangeToken(code, {
      clientId: appKey,
      clientSecret: appSecret,
      redirectUri
    })

    const userInfo = await adapter.getUserInfo(tokenInfo.accessToken)

    const existingAccount = await prisma.platformAccount.findFirst({
      where: {
        userId: stateData.userId,
        platform: Platform.WEIBO,
        platformUserId: userInfo.id
      }
    })

    const tokenExpiry = calculateTokenExpiry(tokenInfo.expiresIn)
    const accessEnc = encryptWeiboToken(tokenInfo.accessToken)
    const refreshEnc = tokenInfo.refreshToken
      ? encryptWeiboToken(tokenInfo.refreshToken)
      : null

    const weiboAppConfigId = stateData.weiboAppConfigId ?? null

    if (existingAccount) {
      await prisma.platformAccount.update({
        where: { id: existingAccount.id },
        data: {
          platformUsername: userInfo.username,
          accessToken: accessEnc,
          refreshToken: refreshEnc,
          tokenExpiry,
          isConnected: true,
          weiboAppConfigId
        }
      })
    } else {
      /** 产品策略：每用户仅一条微博绑定（浏览器会话或 OAuth 二选一，不可叠两条） */
      const otherWeibo = await prisma.platformAccount.findFirst({
        where: {
          userId: stateData.userId,
          platform: Platform.WEIBO
        }
      })
      if (otherWeibo) {
        return redirectToAccounts(
          request,
          '?platform=weibo&status=error&error=' +
            encodeURIComponent(
              '已绑定微博账号（含浏览器会话或开放平台）。请先解绑后再授权其它账号。'
            )
        )
      }
      await prisma.platformAccount.create({
        data: {
          userId: stateData.userId,
          platform: Platform.WEIBO,
          platformUserId: userInfo.id,
          platformUsername: userInfo.username,
          accessToken: accessEnc,
          refreshToken: refreshEnc,
          tokenExpiry,
          isConnected: true,
          weiboAppConfigId
        }
      })
    }

    return redirectToAccounts(request, '?platform=weibo&status=connected')
  } catch (error) {
    console.error('OAuth 回调处理失败:', error)
    return redirectToAccounts(
      request,
      `?platform=weibo&status=error&error=${encodeURIComponent(
        error instanceof Error ? error.message : '授权失败'
      )}`
    )
  }
}
