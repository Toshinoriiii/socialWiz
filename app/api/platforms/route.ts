import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { AuthService } from '@/lib/services/auth.service'
import { Platform } from '@/types/platform.types'

/**
 * GET /api/platforms
 * 获取用户绑定的平台账号列表
 */
export async function GET(request: NextRequest) {
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

    // 获取用户的平台账号列表
    const platformAccounts = await prisma.platformAccount.findMany({
      where: {
        userId: user.id
      },
      select: {
        id: true,
        platform: true,
        platformUserId: true,
        platformUsername: true,
        isConnected: true,
        tokenExpiry: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(platformAccounts)
  } catch (error) {
    console.error('获取平台账号列表失败:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '获取平台账号列表失败'
      },
      { status: 500 }
    )
  }
}
