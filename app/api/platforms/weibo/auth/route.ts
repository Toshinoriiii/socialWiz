import { NextRequest, NextResponse } from 'next/server'
import { WeiboAdapter } from '@/lib/platforms/weibo/weibo-adapter'
import { generateOAuthState } from '@/lib/utils/oauth-state'
import { AuthService } from '@/lib/services/auth.service'
import { weiboAppConfigService } from '@/lib/services/weibo-app-config.service'

/**
 * GET /api/platforms/weibo/auth
 * 获取微博 OAuth 授权 URL。
 * Query: weiboAppConfigId（可选）— 使用用户保存的微博应用配置；省略则回退环境变量 WEIBO_*（开发/单租户）。
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权，请先登录' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const user = await AuthService.verifyToken(token)

    const weiboAppConfigId = request.nextUrl.searchParams.get('weiboAppConfigId')

    let appKey: string
    let appSecret: string
    let redirectUri: string

    if (weiboAppConfigId) {
      const creds = await weiboAppConfigService.getSecretsForOAuth(weiboAppConfigId, user.id)
      if (!creds) {
        return NextResponse.json(
          { error: '微博应用配置不存在、已禁用或无权访问' },
          { status: 400 }
        )
      }
      appKey = creds.appId
      appSecret = creds.appSecret
      redirectUri = creds.callbackUrl
    } else {
      // 开发/单租户：无用户配置时使用环境变量（生产多租户应配置 WeiboAppConfig）
      appKey = process.env.WEIBO_APP_KEY || ''
      appSecret = process.env.WEIBO_APP_SECRET || ''
      redirectUri =
        process.env.WEIBO_REDIRECT_URI ||
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/platforms/weibo/auth/callback`
      if (!appKey || !appSecret) {
        return NextResponse.json(
          {
            error:
              '微博未配置：请在环境变量设置 WEIBO_APP_KEY / WEIBO_APP_SECRET，或在账号页添加微博应用凭证'
          },
          { status: 500 }
        )
      }
    }

    const state = generateOAuthState(user.id, 'weibo', '/accounts', weiboAppConfigId || undefined)

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
