import { prisma } from '@/lib/db/prisma'
import { Platform } from '@/types/platform.types'
import {
  wechatPlaywrightSessionExists,
  WECHAT_PLAYWRIGHT_ACCESS_TOKEN_SENTINEL,
  WECHAT_PLAYWRIGHT_PLATFORM_USER_ID_PREFIX,
  readWechatPlaywrightProfileDisplayName,
  writeWechatPlaywrightProfileMerge,
  WECHAT_PLAYWRIGHT_DISPLAY_NAME_FALLBACK
} from '@/lib/wechat-playwright/session-files'
import { resolveWechatPublicAccountDisplayName } from '@/lib/wechat-playwright/wechat-mp-web-publish'

/** 会话文件存在则 upsert 微信「浏览器会话」型 PlatformAccount */
export async function syncWechatPlaywrightPlatformAccount (userId: string) {
  if (!wechatPlaywrightSessionExists(userId)) return null

  const blockingCred = await prisma.platformAccount.findFirst({
    where: {
      userId,
      platform: Platform.WECHAT,
      wechatAccountConfigId: { not: null }
    }
  })
  if (blockingCred) return null

  const oauthOrOther = await prisma.platformAccount.findFirst({
    where: {
      userId,
      platform: Platform.WECHAT,
      platformUserId: {
        not: { startsWith: WECHAT_PLAYWRIGHT_PLATFORM_USER_ID_PREFIX }
      },
      wechatAccountConfigId: null
    }
  })
  if (oauthOrOther) return null

  const platformUserId = `${WECHAT_PLAYWRIGHT_PLATFORM_USER_ID_PREFIX}${userId}`
  let displayName = readWechatPlaywrightProfileDisplayName(userId)
  if (!displayName) {
    const resolved = await resolveWechatPublicAccountDisplayName(userId).catch(
      () => null
    )
    if (resolved) {
      writeWechatPlaywrightProfileMerge(userId, { displayName: resolved })
      displayName = resolved
    }
  }
  displayName = displayName ?? WECHAT_PLAYWRIGHT_DISPLAY_NAME_FALLBACK

  await prisma.platformAccount.deleteMany({
    where: {
      userId,
      platform: Platform.WECHAT,
      platformUserId: { not: platformUserId }
    }
  })

  return prisma.platformAccount.upsert({
    where: {
      userId_platform_platformUserId: {
        userId,
        platform: Platform.WECHAT,
        platformUserId
      }
    },
    create: {
      userId,
      platform: Platform.WECHAT,
      platformUserId,
      platformUsername: displayName,
      accessToken: WECHAT_PLAYWRIGHT_ACCESS_TOKEN_SENTINEL,
      isConnected: true
    },
    update: {
      isConnected: true,
      accessToken: WECHAT_PLAYWRIGHT_ACCESS_TOKEN_SENTINEL,
      platformUsername: displayName
    }
  })
}
