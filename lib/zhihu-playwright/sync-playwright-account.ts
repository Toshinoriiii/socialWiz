import { prisma } from '@/lib/db/prisma'
import { Platform } from '@/types/platform.types'
import {
  readZhihuPlaywrightProfileDisplayName,
  zhihuPlaywrightSessionExists,
  ZHIHU_PLAYWRIGHT_ACCESS_TOKEN_SENTINEL,
  ZHIHU_PLAYWRIGHT_PLATFORM_USER_ID_PREFIX
} from '@/lib/zhihu-playwright/session-files'

/** 会话文件存在则 upsert PlatformAccount */
export async function syncZhihuPlaywrightPlatformAccount (userId: string) {
  if (!zhihuPlaywrightSessionExists(userId)) return null
  const platformUserId = `${ZHIHU_PLAYWRIGHT_PLATFORM_USER_ID_PREFIX}${userId}`
  const displayName =
    readZhihuPlaywrightProfileDisplayName(userId) ?? '知乎（本机浏览器会话）'
  return prisma.platformAccount.upsert({
    where: {
      userId_platform_platformUserId: {
        userId,
        platform: Platform.ZHIHU,
        platformUserId
      }
    },
    create: {
      userId,
      platform: Platform.ZHIHU,
      platformUserId,
      platformUsername: displayName,
      accessToken: ZHIHU_PLAYWRIGHT_ACCESS_TOKEN_SENTINEL,
      isConnected: true
    },
    update: {
      isConnected: true,
      accessToken: ZHIHU_PLAYWRIGHT_ACCESS_TOKEN_SENTINEL,
      platformUsername: displayName
    }
  })
}
