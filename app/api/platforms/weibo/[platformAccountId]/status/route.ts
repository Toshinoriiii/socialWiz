import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { AuthService } from '@/lib/services/auth.service'
import { isTokenExpired } from '@/lib/platforms/weibo/weibo-utils'

/**
 * GET /api/platforms/weibo/[platformAccountId]/status
 * 获取微博账号状态
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { platformAccountId: string } }
) {
  try {
    // 验证用户身份
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '未授权，请先登录' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const user = await AuthService.verifyToken(token)

    const { platformAccountId } = params

    // 查找平台账号
    const platformAccount = await prisma.platformAccount.findUnique({
      where: { id: platformAccountId }
    })

    if (!platformAccount) {
      return NextResponse.json(
        { error: '平台账号不存在' },
        { status: 404 }
      )
    }

    // 验证账号属于当前用户
    if (platformAccount.userId !== user.id) {
      return NextResponse.json(
        { error: '无权访问此账号' },
        { status: 403 }
      )
    }

    // 检查是否需要重新授权
    const needsReauth = !platformAccount.isConnected || isTokenExpired(platformAccount.tokenExpiry || undefined)

    return NextResponse.json({
      id: platformAccount.id,
      platform: platformAccount.platform,
      platformUsername: platformAccount.platformUsername,
      isConnected: platformAccount.isConnected,
      tokenExpiry: platformAccount.tokenExpiry,
      needsReauth
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
