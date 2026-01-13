import { NextRequest, NextResponse } from 'next/server'
import { WeiboAdapter } from '@/lib/platforms/weibo/weibo-adapter'
import { generateOAuthState } from '@/lib/utils/oauth-state'
import { getPlatformConfig } from '@/config/platform.config'
import { Platform } from '@/types/platform.types'
import { AuthService } from '@/lib/services/auth.service'

/**
 * GET /api/platforms/weibo/auth
 * 获取微博 OAuth 授权 URL
 */
export async function GET(request: NextRequest) {
  try {
    // 获取当前用户（从 Authorization header）
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '未授权，请先登录' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const user = await AuthService.verifyToken(token)

    // 获取配置
    const weiboConfig = getPlatformConfig(Platform.WEIBO)
    const appKey = process.env.WEIBO_APP_KEY
    const appSecret = process.env.WEIBO_APP_SECRET
    const redirectUri = process.env.WEIBO_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/platforms/weibo/auth/callback`

    if (!appKey || !appSecret) {
      return NextResponse.json(
        { error: '微博配置未设置' },
        { status: 500 }
      )
    }

    // 生成 state
    const state = generateOAuthState(user.id, 'weibo', '/dashboard/settings')

    // 创建适配器并获取授权 URL
    const adapter = new WeiboAdapter({
      appKey,
      appSecret,
      redirectUri
    })

    const authUrl = await adapter.getAuthUrl({
      clientId: appKey,
      clientSecret: appSecret,
      redirectUri,
      state,
      scope: 'all'
    })

    return NextResponse.json({
      authUrl,
      state
    })
  } catch (error) {
    console.error('获取授权 URL 失败:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '获取授权 URL 失败'
      },
      { status: 500 }
    )
  }
}
