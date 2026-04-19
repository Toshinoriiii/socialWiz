import type { PlatformAccount } from '@prisma/client'
import {
  isPlaywrightWeiboUserId,
  WEIBO_PLAYWRIGHT_ACCESS_TOKEN_SENTINEL
} from '@/lib/weibo-playwright/session-files'
import {
  isPlaywrightWeChatUserId,
  WECHAT_PLAYWRIGHT_ACCESS_TOKEN_SENTINEL
} from '@/lib/wechat-playwright/session-files'
import {
  isPlaywrightZhihuUserId,
  ZHIHU_PLAYWRIGHT_ACCESS_TOKEN_SENTINEL
} from '@/lib/zhihu-playwright/session-files'

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

/** 微信：mp.weixin.qq.com Playwright 会话，非 AppSecret / 开放平台 */
export function isWechatBrowserSessionAccount(account: PlatformAccount): boolean {
  if (account.platform !== 'WECHAT') return false
  return (
    isPlaywrightWeChatUserId(account.platformUserId) ||
    account.accessToken === WECHAT_PLAYWRIGHT_ACCESS_TOKEN_SENTINEL
  )
}

/** 知乎：www.zhihu.com Playwright 会话 */
export function isZhihuBrowserSessionAccount (account: PlatformAccount): boolean {
  if (account.platform !== 'ZHIHU') return false
  return (
    isPlaywrightZhihuUserId(account.platformUserId) ||
    account.accessToken === ZHIHU_PLAYWRIGHT_ACCESS_TOKEN_SENTINEL
  )
}
