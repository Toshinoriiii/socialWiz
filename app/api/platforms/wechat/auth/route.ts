import { NextRequest, NextResponse } from 'next/server'
import { WechatAdapter } from '@/lib/platforms/wechat/wechat-adapter'
import { generateOAuthState } from '@/lib/utils/oauth-state'
import { getPlatformConfig } from '@/config/platform.config'
import { Platform } from '@/types/platform.types'
import { AuthService } from '@/lib/services/auth.service'

/**
 * GET /api/platforms/wechat/auth
 * 获取微信开放平台网站应用授权URL（用于外部浏览器扫码登录）
 */
export async function GET(request: NextRequest) {
  try {
    // 从查询参数获取 token（前端通过URL传递）
    const token = request.nextUrl.searchParams.get('token')
    
    if (!token) {
      // 如果没有token，返回JSON错误（前端可以处理）
      return NextResponse.json(
        { error: '未授权，请先登录' },
        { status: 401 }
      )
    }

    const user = await AuthService.verifyToken(token)

    // 获取配置（使用微信开放平台网站应用的AppID和AppSecret）
    const appId = process.env.WECHAT_APP_ID
    const appSecret = process.env.WECHAT_APP_SECRET
    const redirectUri = process.env.WECHAT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/platforms/wechat/auth/callback`

    if (!appId || !appSecret) {
      return NextResponse.json(
        { error: '微信开放平台网站应用配置未设置' },
        { status: 500 }
      )
    }

    // 生成 state（重定向到测试页面）
    const state = generateOAuthState(user.id, 'wechat', '/dashboard/test-wechat')

    // 创建适配器并获取授权 URL（网站应用授权，使用 qrconnect + snsapi_login）
    const adapter = new WechatAdapter({
      appId,
      appSecret,
      redirectUri
    })

    const authUrl = await adapter.getAuthUrl({
      clientId: appId,
      clientSecret: appSecret,
      redirectUri,
      state
      // scope 参数会被忽略，网站应用固定使用 snsapi_login
    })

    // 返回授权URL，让前端在新窗口打开
    return NextResponse.json({
      authUrl,
      state
    })
  } catch (error) {
    console.error('获取授权 URL 失败:', error)
    return NextResponse.redirect(
      new URL(`/dashboard/test-wechat?error=${encodeURIComponent(error instanceof Error ? error.message : '获取授权 URL 失败')}`, request.url)
    )
  }
}
