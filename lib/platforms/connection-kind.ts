import type { PlatformAccount } from '@prisma/client'
import {
  isPlaywrightWeiboUserId,
  WEIBO_PLAYWRIGHT_ACCESS_TOKEN_SENTINEL
} from '@/lib/weibo-playwright/session-files'

/** 微博：Playwright 保存的网页会话，非开放平台 access_token */
export function isWeiboBrowserSessionAccount(account: PlatformAccount): boolean {
  if (account.platform !== 'WEIBO') return false
  return (
    isPlaywrightWeiboUserId(account.platformUserId) ||
    account.accessToken === WEIBO_PLAYWRIGHT_ACCESS_TOKEN_SENTINEL
  )
}

/** 微博：可走 WeiboAdapter + 官方 API 的账号 */
export function isWeiboOAuthApiAccount(account: PlatformAccount): boolean {
  if (account.platform !== 'WEIBO') return false
  return !isWeiboBrowserSessionAccount(account)
}
