import { NextRequest, NextResponse } from 'next/server'
import { WeiboAdapter } from '@/lib/platforms/weibo/weibo-adapter'
import { validateOAuthState } from '@/lib/utils/oauth-state'
import { getPlatformConfig } from '@/config/platform.config'
import { Platform } from '@/types/platform.types'
import { prisma } from '@/lib/db/prisma'
import { calculateTokenExpiry } from '@/lib/platforms/weibo/weibo-utils'

/**
 * GET /api/platforms/weibo/auth/callback
 * 处理微博 OAuth 回调
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // 检查是否有错误
    if (error) {
      console.error('OAuth 回调错误:', error, errorDescription)
      return NextResponse.redirect(
        new URL(`/dashboard/settings?platform=weibo&status=error&error=${encodeURIComponent(errorDescription || error)}`, request.url)
      )
    }

    // 验证参数
    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?platform=weibo&status=error&error=缺少必要参数', request.url)
      )
    }

    // 验证 state
    const stateData = await validateOAuthState(state, 'weibo')
    if (!stateData) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?platform=weibo&status=error&error=State验证失败', request.url)
      )
    }

    // 获取配置
    const appKey = process.env.WEIBO_APP_KEY
    const appSecret = process.env.WEIBO_APP_SECRET
    const redirectUri = process.env.WEIBO_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/platforms/weibo/auth/callback`

    if (!appKey || !appSecret) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?platform=weibo&status=error&error=微博配置未设置', request.url)
      )
    }

    // 创建适配器并交换 Token
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

    // 获取用户信息
    const userInfo = await adapter.getUserInfo(tokenInfo.accessToken)

    // 检查是否已存在账号
    const existingAccount = await prisma.platformAccount.findFirst({
      where: {
        userId: stateData.userId,
        platform: Platform.WEIBO
      }
    })

    const tokenExpiry = calculateTokenExpiry(tokenInfo.expiresIn)

    if (existingAccount) {
      // 更新现有账号
      await prisma.platformAccount.update({
        where: { id: existingAccount.id },
        data: {
          platformUserId: userInfo.id,
          platformUsername: userInfo.username,
          accessToken: tokenInfo.accessToken, // 注意：实际应该加密存储
          refreshToken: tokenInfo.refreshToken, // 注意：实际应该加密存储
          tokenExpiry,
          isConnected: true
        }
      })
    } else {
      // 创建新账号
      await prisma.platformAccount.create({
        data: {
          userId: stateData.userId,
          platform: Platform.WEIBO,
          platformUserId: userInfo.id,
          platformUsername: userInfo.username,
          accessToken: tokenInfo.accessToken, // 注意：实际应该加密存储
          refreshToken: tokenInfo.refreshToken, // 注意：实际应该加密存储
          tokenExpiry,
          isConnected: true
        }
      })
    }

    // 重定向到设置页面
    return NextResponse.redirect(
      new URL('/dashboard/settings?platform=weibo&status=connected', request.url)
    )
  } catch (error) {
    console.error('OAuth 回调处理失败:', error)
    return NextResponse.redirect(
      new URL(
        `/dashboard/settings?platform=weibo&status=error&error=${encodeURIComponent(error instanceof Error ? error.message : '授权失败')}`,
        request.url
      )
    )
  }
}
