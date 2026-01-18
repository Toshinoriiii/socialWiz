import { NextRequest, NextResponse } from 'next/server'
import { WechatAdapter } from '@/lib/platforms/wechat/wechat-adapter'
import { generateOAuthState } from '@/lib/utils/oauth-state'
import { getPlatformConfig } from '@/config/platform.config'
import { Platform } from '@/types/platform.types'
import { AuthService } from '@/lib/services/auth.service'
import { prisma } from '@/lib/db/prisma'

/**
 * GET /api/platforms/wechat/auth
 * 获取微信开放平台网站应用授权URL（用于外部浏览器扫码登录）
 * 
 * Query参数:
 * - token: JWT token
 * - configId: (可选) 使用用户配置的AppID/Secret而非环境变量
 */
export async function GET(request: NextRequest) {
  try {
    // 从查询参数获取 token和 configId
    const token = request.nextUrl.searchParams.get('token')
    const configId = request.nextUrl.searchParams.get('configId')
    
    if (!token) {
      return NextResponse.json(
        { error: '未授权，请先登录' },
        { status: 401 }
      )
    }

    const user = await AuthService.verifyToken(token)

    let appId: string
    let appSecret: string
    // 强制使用 localhost 回调地址
    const redirectUri = 'http://localhost:3000/api/platforms/wechat/auth/callback'

    // 如果提供了 configId，使用用户配置
    if (configId) {
      const config = await prisma.wechatAccountConfig.findFirst({
        where: {
          id: configId,
          userId: user.id
        }
      })

      if (!config) {
        return NextResponse.json(
          { error: '配置不存在或无权访问' },
          { status: 404 }
        )
      }

      appId = config.appId
      appSecret = config.appSecret
    } else {
      // 使用环境变量配置
      appId = process.env.WECHAT_APP_ID || ''
      appSecret = process.env.WECHAT_APP_SECRET || ''

      if (!appId || !appSecret) {
        return NextResponse.json(
          { error: '微信开放平台网站应用配置未设置' },
          { status: 500 }
        )
      }
    }

    // 生成 state（重定向到测试页面）
    const state = generateOAuthState(user.id, 'wechat', `/dashboard/test-wechat${configId ? `?configId=${configId}` : ''}`)

    // 创建适配器并获取授权 URL
    const adapter = new WechatAdapter({
      appId,
      appSecret,
      redirectUri
    })

    // 使用服务号网页授权，snsapi_userinfo 可获取用户信息
    const authUrl = await adapter.getAuthUrl({
      clientId: appId,
      clientSecret: appSecret,
      redirectUri,
      state,
      scope: 'snsapi_userinfo' // 服务号网页授权，获取用户信息
    })

    // 返回授权URL，让前端在新窗口打开
    return NextResponse.json({
      authUrl,
      state,
      configId
    })
  } catch (error) {
    console.error('获取授权 URL 失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取授权 URL 失败' },
      { status: 500 }
    )
  }
}
