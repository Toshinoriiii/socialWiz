import fs from 'fs'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { AuthService } from '@/lib/services/auth.service'
import {
  getWeiboPlaywrightProfilePath,
  getWeiboPlaywrightSessionPath,
  isPlaywrightWeiboUserId
} from '@/lib/weibo-playwright/session-files'

/**
 * POST /api/platforms/weibo/[platformAccountId]/disconnect
 * 断开微博账号连接
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ platformAccountId: string }> }
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

    const { platformAccountId } = await context.params

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

    if (isPlaywrightWeiboUserId(platformAccount.platformUserId)) {
      try {
        fs.unlinkSync(getWeiboPlaywrightSessionPath(user.id))
      } catch {
        /* ignore */
      }
      try {
        fs.unlinkSync(getWeiboPlaywrightProfilePath(user.id))
      } catch {
        /* ignore */
      }
      await prisma.platformAccount.delete({
        where: { id: platformAccountId }
      })
    } else {
      await prisma.platformAccount.update({
        where: { id: platformAccountId },
        data: {
          accessToken: '',
          refreshToken: null,
          tokenExpiry: null,
          isConnected: false
        }
      })
    }

    return NextResponse.json({
      success: true
    })
  } catch (error) {
    console.error('断开连接失败:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '断开连接失败'
      },
      { status: 500 }
    )
  }
}
