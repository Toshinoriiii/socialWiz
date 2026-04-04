import { prisma } from '@/lib/db/prisma'
import { Platform } from '@/types/platform.types'
import { enrichWeiboPlaywrightProfileScreenName } from '@/lib/weibo-playwright/enrich-playwright-profile'
import {
  readWeiboPlaywrightProfileDisplayName,
  weiboPlaywrightSessionExists,
  WEIBO_PLAYWRIGHT_ACCESS_TOKEN_SENTINEL,
  WEIBO_PLAYWRIGHT_PLATFORM_USER_ID_PREFIX
} from '@/lib/weibo-playwright/session-files'

/** 会话文件存在则 upsert PlatformAccount（含从 profile.json 读取的展示昵称） */
export async function syncWeiboPlaywrightPlatformAccount (userId: string) {
  if (!weiboPlaywrightSessionExists(userId)) return null
  const blockingOauth = await prisma.platformAccount.findFirst({
    where: {
      userId,
      platform: Platform.WEIBO,
      platformUserId: {
        not: { startsWith: WEIBO_PLAYWRIGHT_PLATFORM_USER_ID_PREFIX }
      }
    }
  })
  if (blockingOauth) return null
  try {
    await enrichWeiboPlaywrightProfileScreenName(userId)
  } catch {
    /* 补全失败不阻断同步 */
  }
  const platformUserId = `${WEIBO_PLAYWRIGHT_PLATFORM_USER_ID_PREFIX}${userId}`
  const displayName =
    readWeiboPlaywrightProfileDisplayName(userId) ?? '微博（本机浏览器会话）'
  return prisma.platformAccount.upsert({
    where: {
      userId_platform_platformUserId: {
        userId,
        platform: Platform.WEIBO,
        platformUserId
      }
    },
    create: {
      userId,
      platform: Platform.WEIBO,
      platformUserId,
      platformUsername: displayName,
      accessToken: WEIBO_PLAYWRIGHT_ACCESS_TOKEN_SENTINEL,
      isConnected: true
    },
    update: {
      isConnected: true,
      accessToken: WEIBO_PLAYWRIGHT_ACCESS_TOKEN_SENTINEL,
      platformUsername: displayName
    }
  })
}
