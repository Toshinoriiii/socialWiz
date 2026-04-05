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
import { backfillWechatCredentialPlatformAccounts } from '@/lib/platforms/wechat/wechat-platform-account'
import {
  wechatPlaywrightSessionExists,
  isPlaywrightWeChatUserId
} from '@/lib/wechat-playwright/session-files'
import { syncWechatPlaywrightPlatformAccount } from '@/lib/wechat-playwright/sync-playwright-account'

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

    if (wechatPlaywrightSessionExists(user.id)) {
      try {
        await syncWechatPlaywrightPlatformAccount(user.id)
      } catch {
        /* ignore */
      }
    }

    try {
      await backfillWechatCredentialPlatformAccounts(user.id)
    } catch {
      /* 不阻断列表 */
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
        wechatAccountConfigId: true,
        createdAt: true,
        updatedAt: true,
        wechatAccountConfig: {
          select: {
            appId: true,
            accountName: true,
            subjectType: true,
            canPublish: true,
            isActive: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const enriched = platformAccounts.map((a) => {
      const isPlaywrightWeibo =
        a.platform === Platform.WEIBO && isPlaywrightWeiboUserId(a.platformUserId)
      const sessionMissingWeibo =
        isPlaywrightWeibo && !weiboPlaywrightSessionExists(user.id)
      const isPlaywrightWechat =
        a.platform === Platform.WECHAT && isPlaywrightWeChatUserId(a.platformUserId)
      const sessionMissingWechat =
        isPlaywrightWechat && !wechatPlaywrightSessionExists(user.id)

      let needsReauth: boolean
      if (a.platform === Platform.WEIBO) {
        needsReauth = isPlaywrightWeibo
          ? sessionMissingWeibo || !a.isConnected
          : !a.isConnected || isTokenExpired(a.tokenExpiry ?? undefined)
      } else if (a.platform === Platform.WECHAT) {
        if (isPlaywrightWechat) {
          needsReauth = sessionMissingWechat || !a.isConnected
        } else if (a.wechatAccountConfigId) {
          needsReauth =
            !a.isConnected ||
            !a.wechatAccountConfig ||
            !a.wechatAccountConfig.isActive
        } else {
          needsReauth =
            !a.isConnected || isTokenExpired(a.tokenExpiry ?? undefined)
        }
      } else {
        needsReauth =
          !a.isConnected || isTokenExpired(a.tokenExpiry ?? undefined)
      }

      const { wechatAccountConfig, ...rest } = a

      let canPublish: boolean | undefined
      if (a.platform === Platform.WECHAT) {
        if (isPlaywrightWechat) {
          canPublish = !sessionMissingWechat
        } else {
          canPublish = wechatAccountConfig?.canPublish ?? undefined
        }
      }

      return {
        ...rest,
        needsReauth,
        appId: wechatAccountConfig?.appId,
        accountName: wechatAccountConfig?.accountName ?? undefined,
        subjectType: wechatAccountConfig?.subjectType ?? undefined,
        canPublish
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
