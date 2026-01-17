import { NextRequest, NextResponse } from 'next/server'
import { wechatTokenService } from '@/lib/services/wechat-token.service'
import { verify } from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

/**
 * 从请求头获取用户ID
 */
function getUserIdFromRequest(request: NextRequest): string | null {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const decoded = verify(token, JWT_SECRET) as { userId: string }
    return decoded.userId
  } catch (error) {
    return null
  }
}

/**
 * GET /api/wechat/token/[configId]
 * 测试获取Access Token（用于测试页面）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const userId = getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      )
    }

    // 解包params
    const { configId } = await params

    console.log(`[Token API] 获取Token userId=${userId} configId=${configId}`)

    // 调用TokenService获取或刷新token
    const accessToken = await wechatTokenService.getOrRefreshToken(userId, configId)

    // 获取缓存的token信息（包含过期时间）
    const cachedToken = await wechatTokenService.getCachedToken(userId, configId)

    return NextResponse.json({
      accessToken,
      expiresAt: cachedToken?.expiresAt || Date.now() + 7200000,
      configId
    })
  } catch (error) {
    console.error('[Token API] 获取Token失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取Token失败' },
      { status: 500 }
    )
  }
}
