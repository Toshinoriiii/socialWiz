import { NextRequest, NextResponse } from 'next/server'
import { WechatAdapter } from '@/lib/platforms/wechat/wechat-adapter'
import { generateOAuthState } from '@/lib/utils/oauth-state'
import { getPlatformConfig } from '@/config/platform.config'
import { Platform } from '@/types/platform.types'
import { AuthService } from '@/lib/services/auth.service'

/**
 * GET /api/platforms/wechat/auth
 * 获取微信公众号 OAuth 授权 URL
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
    const wechatConfig = getPlatformConfig(Platform.WECHAT)
    const appId = process.env.WECHAT_APP_ID
    const appSecret = process.env.WECHAT_APP_SECRET
    const redirectUri = process.env.WECHAT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/platforms/wechat/auth/callback`

    if (!appId || !appSecret) {
      return NextResponse.json(
        { error: '微信公众号配置未设置' },
        { status: 500 }
      )
    }

    // 生成 state（重定向到测试页面）
    const state = generateOAuthState(user.id, 'wechat', '/test/wechat')

    // 创建适配器并获取授权 URL
    const adapter = new WechatAdapter({
      appId,
      appSecret,
      redirectUri
    })

    const authUrl = await adapter.getAuthUrl({
      clientId: appId,
      clientSecret: appSecret,
      redirectUri,
      state,
      scope: 'snsapi_userinfo'
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
