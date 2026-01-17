import { NextRequest, NextResponse } from 'next/server'
import { WechatAdapter } from '@/lib/platforms/wechat/wechat-adapter'
import { validateOAuthState } from '@/lib/utils/oauth-state'
import { getPlatformConfig } from '@/config/platform.config'
import { Platform } from '@/types/platform.types'
import { prisma } from '@/lib/db/prisma'
import { calculateTokenExpiry } from '@/lib/platforms/wechat/wechat-utils'

/**
 * GET /api/platforms/wechat/auth/callback
 * 处理微信公众号 OAuth 回调
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // 生成错误页面HTML（用于在新窗口中显示并关闭）
    const createErrorPage = (errorMsg: string) => {
      return new NextResponse(
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>授权失败</title>
</head>
<body>
  <script>
    // 如果是在新窗口中打开的，关闭窗口并通知父窗口
    if (window.opener) {
      window.opener.postMessage({ 
        type: 'wechat_auth_error', 
        platform: 'wechat',
        error: ${JSON.stringify(errorMsg)}
      }, '*')
      window.close()
    } else {
      window.location.href = '/dashboard/test-wechat?platform=wechat&status=error&error=${encodeURIComponent(errorMsg)}'
    }
  </script>
  <p>授权失败：${errorMsg}</p>
  <p>如果窗口没有自动关闭，请手动关闭。</p>
</body>
</html>`,
        {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
          },
        }
      )
    }

    // 检查是否有错误
    if (error) {
      console.error('OAuth 回调错误:', error, errorDescription)
      return createErrorPage(errorDescription || error)
    }

    // 验证参数
    if (!code || !state) {
      return createErrorPage('缺少必要参数')
    }

    // 验证 state
    const stateData = await validateOAuthState(state, 'wechat')
    if (!stateData) {
      return createErrorPage('State验证失败')
    }

    // 获取配置
    const appId = process.env.WECHAT_APP_ID
    const appSecret = process.env.WECHAT_APP_SECRET
    const redirectUri = process.env.WECHAT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/platforms/wechat/auth/callback`

    if (!appId || !appSecret) {
      return createErrorPage('微信公众号配置未设置')
    }

    // 创建适配器并交换 Token
    const adapter = new WechatAdapter({
      appId,
      appSecret,
      redirectUri
    })

    const tokenInfo = await adapter.exchangeToken(code, {
      clientId: appId,
      clientSecret: appSecret,
      redirectUri
    }) as any // 包含 openid

    // 获取用户信息
    const openid = tokenInfo.openid
    if (!openid) {
      return createErrorPage('无法获取用户ID')
    }

    const userInfo = await adapter.getUserInfo(tokenInfo.accessToken, openid)

    // 检查是否已存在账号
    const existingAccount = await prisma.platformAccount.findFirst({
      where: {
        userId: stateData.userId,
        platform: Platform.WECHAT
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
          platform: Platform.WECHAT,
          platformUserId: userInfo.id,
          platformUsername: userInfo.username,
          accessToken: tokenInfo.accessToken, // 注意：实际应该加密存储
          refreshToken: tokenInfo.refreshToken, // 注意：实际应该加密存储
          tokenExpiry,
          isConnected: true
        }
      })
    }

    // 重定向到测试页面，并添加成功标识
    // 如果是从新窗口打开的授权，这个重定向会在新窗口中完成
    // 前端可以通过检测URL参数来关闭窗口并刷新父页面
    const redirectUrl = new URL('/dashboard/test-wechat?platform=wechat&status=connected', request.url)
    
    // 返回一个包含关闭窗口脚本的HTML页面
    return new NextResponse(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>授权成功</title>
</head>
<body>
  <script>
    // 如果是在新窗口中打开的，关闭窗口并通知父窗口
    if (window.opener) {
      // 通知父窗口授权成功
      window.opener.postMessage({ type: 'wechat_auth_success', platform: 'wechat' }, '*')
      // 关闭当前窗口
      window.close()
    } else {
      // 如果不是新窗口，直接跳转
      window.location.href = '${redirectUrl.toString()}'
    }
  </script>
  <p>授权成功！如果窗口没有自动关闭，请手动关闭。</p>
</body>
</html>`,
      {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      }
    )
  } catch (error) {
    console.error('OAuth 回调处理失败:', error)
    const errorMsg = error instanceof Error ? error.message : '授权失败'
    return new NextResponse(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>授权失败</title>
</head>
<body>
  <script>
    // 如果是在新窗口中打开的，关闭窗口并通知父窗口
    if (window.opener) {
      window.opener.postMessage({ 
        type: 'wechat_auth_error', 
        platform: 'wechat',
        error: ${JSON.stringify(errorMsg)}
      }, '*')
      window.close()
    } else {
      window.location.href = '/dashboard/test-wechat?platform=wechat&status=error&error=${encodeURIComponent(errorMsg)}'
    }
  </script>
  <p>授权失败：${errorMsg}</p>
  <p>如果窗口没有自动关闭，请手动关闭。</p>
</body>
</html>`,
      {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      }
    )
  }
}
