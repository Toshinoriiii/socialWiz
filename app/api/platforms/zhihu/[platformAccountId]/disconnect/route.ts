import fs from 'fs'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { AuthService } from '@/lib/services/auth.service'
import { Platform } from '@/types/platform.types'
import {
  getZhihuPlaywrightProfilePath,
  getZhihuPlaywrightSessionPath,
  isPlaywrightZhihuUserId
} from '@/lib/zhihu-playwright/session-files'

export async function POST (
  request: NextRequest,
  context: { params: Promise<{ platformAccountId: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权，请先登录' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const user = await AuthService.verifyToken(token)

    const { platformAccountId } = await context.params

    const platformAccount = await prisma.platformAccount.findUnique({
      where: { id: platformAccountId }
    })

    if (!platformAccount) {
      return NextResponse.json({ error: '平台账号不存在' }, { status: 404 })
    }

    if (platformAccount.platform !== Platform.ZHIHU) {
      return NextResponse.json({ error: '账号类型错误' }, { status: 400 })
    }

    if (platformAccount.userId !== user.id) {
      return NextResponse.json({ error: '无权访问此账号' }, { status: 403 })
    }

    if (isPlaywrightZhihuUserId(platformAccount.platformUserId)) {
      try {
        fs.unlinkSync(getZhihuPlaywrightSessionPath(user.id))
      } catch {
        /* ignore */
      }
      try {
        fs.unlinkSync(getZhihuPlaywrightProfilePath(user.id))
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('知乎断开连接失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '断开连接失败' },
      { status: 500 }
    )
  }
}
