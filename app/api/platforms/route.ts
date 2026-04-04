import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { AuthService } from '@/lib/services/auth.service'
import { Platform } from '@/types/platform.types'
import { isTokenExpired } from '@/lib/platforms/weibo/weibo-utils'
import {
  weiboPlaywrightSessionExists,
  isPlaywrightWeiboUserId
} from '@/lib/weibo-playwright/session-files'
import { syncWeiboPlaywrightPlatformAccount } from '@/lib/weibo-playwright/sync-playwright-account'

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

    if (weiboPlaywrightSessionExists(user.id)) {
      try {
        await syncWeiboPlaywrightPlatformAccount(user.id)
      } catch {
        /* 列表仍返回，避免同步失败阻断 */
      }
    }

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

    const enriched = platformAccounts.map((a) => {
      const isPlaywrightWeibo =
        a.platform === Platform.WEIBO && isPlaywrightWeiboUserId(a.platformUserId)
      const sessionMissing =
        isPlaywrightWeibo && !weiboPlaywrightSessionExists(user.id)
      return {
        ...a,
        needsReauth:
          isPlaywrightWeibo
            ? sessionMissing || !a.isConnected
            : a.platform === Platform.WEIBO &&
              (!a.isConnected || isTokenExpired(a.tokenExpiry ?? undefined))
      }
    })

    return NextResponse.json(enriched)
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
