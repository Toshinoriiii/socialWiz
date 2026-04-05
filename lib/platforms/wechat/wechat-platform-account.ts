import { prisma } from '@/lib/db/prisma'
import { Platform } from '@/types/platform.types'

/**
 * 微信公众平台「AppID + AppSecret」绑定：accessToken 列占位，真实发信用 client_credential + WechatAccountConfig
 * （与微博 Playwright 会话使用 SENTINEL 同理，便于与 OAuth 网页授权账号区分。）
 */
export const WECHAT_CREDENTIAL_ACCESS_TOKEN_SENTINEL = 'WECHAT_MP_CREDENTIAL'

export function wechatCredentialPlatformUserId (configId: string): string {
  return `wechat_cred_${configId}`
}

export function isWechatCredentialPlatformAccount (account: {
  platform: Platform | string
  accessToken: string
  wechatAccountConfigId: string | null
}): boolean {
  if (account.platform !== Platform.WECHAT && account.platform !== 'WECHAT') return false
  return (
    account.wechatAccountConfigId != null ||
    account.accessToken === WECHAT_CREDENTIAL_ACCESS_TOKEN_SENTINEL
  )
}

/**
 * 将开发者凭证配置与唯一的 WECHAT PlatformAccount 行对齐（每用户仅一条微信绑定）。
 */
export async function attachWechatCredentialPlatformAccount (
  userId: string,
  configRow: {
    id: string
    appId: string
    accountName: string | null
    isActive: boolean
  }
): Promise<void> {
  const platformUserId = wechatCredentialPlatformUserId(configRow.id)
  const display = (configRow.accountName?.trim() || configRow.appId).trim()

  const existingForConfig = await prisma.platformAccount.findFirst({
    where: {
      userId,
      platform: Platform.WECHAT,
      wechatAccountConfigId: configRow.id
    }
  })

  if (existingForConfig) {
    await prisma.platformAccount.update({
      where: { id: existingForConfig.id },
      data: {
        platformUsername: display,
        isConnected: configRow.isActive,
        accessToken: WECHAT_CREDENTIAL_ACCESS_TOKEN_SENTINEL,
        wechatAccountConfigId: configRow.id
      }
    })
    return
  }

  await prisma.platformAccount.deleteMany({
    where: { userId, platform: Platform.WECHAT }
  })

  await prisma.platformAccount.create({
    data: {
      userId,
      platform: Platform.WECHAT,
      platformUserId,
      platformUsername: display,
      accessToken: WECHAT_CREDENTIAL_ACCESS_TOKEN_SENTINEL,
      isConnected: configRow.isActive,
      wechatAccountConfigId: configRow.id
    }
  })
}

/** 列表加载时：已有配置但尚无关联 PlatformAccount 的旧数据 */
export async function backfillWechatCredentialPlatformAccounts (userId: string): Promise<void> {
  const configs = await prisma.wechatAccountConfig.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  })
  if (configs.length === 0) return

  const linked = await prisma.platformAccount.findFirst({
    where: {
      userId,
      platform: Platform.WECHAT,
      wechatAccountConfigId: { not: null }
    }
  })
  if (linked) {
    const cfg = configs.find((c) => c.id === linked.wechatAccountConfigId)
    if (cfg) {
      await attachWechatCredentialPlatformAccount(userId, {
        id: cfg.id,
        appId: cfg.appId,
        accountName: cfg.accountName,
        isActive: cfg.isActive
      })
    }
    return
  }

  const cfg = configs[0]
  await attachWechatCredentialPlatformAccount(userId, {
    id: cfg.id,
    appId: cfg.appId,
    accountName: cfg.accountName,
    isActive: cfg.isActive
  })
}
