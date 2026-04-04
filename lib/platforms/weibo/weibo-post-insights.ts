import type { PlatformAccount, WeiboAppConfig } from '@prisma/client'
import { Platform } from '@/types/platform.types'
import { WeiboAdapter } from '@/lib/platforms/weibo/weibo-adapter'
import { decrypt } from '@/lib/utils/encryption'
import { decryptWeiboToken } from '@/lib/utils/weibo-token-crypto'
import { fetchWeiboStatusInsightsWithSessionCookies } from '@/lib/weibo-playwright/weibo-status-cookie'
import {
  isPlaywrightWeiboUserId,
  WEIBO_PLAYWRIGHT_ACCESS_TOKEN_SENTINEL
} from '@/lib/weibo-playwright/session-files'

export type WeiboPostInsightsResult =
  | {
      ok: true
      transport: 'cookie_session' | 'oauth'
      data: unknown
      note?: string
    }
  | { ok: false; error: string }

type AccountWithWeiboConfig = PlatformAccount & { weiboAppConfig: WeiboAppConfig | null }

export async function fetchWeiboPostInsightsForAccount (
  account: AccountWithWeiboConfig,
  sessionOwnerUserId: string,
  postId: string
): Promise<WeiboPostInsightsResult> {
  if (account.platform !== Platform.WEIBO) {
    return { ok: false, error: '非微博账号' }
  }
  const id = postId.trim()
  if (!id) {
    return { ok: false, error: '缺少 postId' }
  }

  if (
    isPlaywrightWeiboUserId(account.platformUserId) ||
    account.accessToken === WEIBO_PLAYWRIGHT_ACCESS_TOKEN_SENTINEL
  ) {
    const r = await fetchWeiboStatusInsightsWithSessionCookies(sessionOwnerUserId, id)
    if (!r.ok) {
      return { ok: false, error: r.error }
    }
    return {
      ok: true,
      transport: 'cookie_session',
      data: r.data,
      note:
        '阅读数会尽量从 statuses/show、本人时间线 getIndex、PC ajax/show 补全；若仍无，多为接口对非本人或未开放阅读量。'
    }
  }

  let appKey = process.env.WEIBO_APP_KEY || ''
  let appSecret = process.env.WEIBO_APP_SECRET || ''
  let redirectUri = process.env.WEIBO_REDIRECT_URI || ''
  if (account.weiboAppConfig) {
    appKey = account.weiboAppConfig.appId
    try {
      appSecret = decrypt(account.weiboAppConfig.appSecret)
    } catch {
      return { ok: false, error: '应用配置解密失败' }
    }
    redirectUri = account.weiboAppConfig.callbackUrl
  }
  if (!appKey || !appSecret) {
    return { ok: false, error: '未配置微博应用密钥' }
  }

  const accessToken = decryptWeiboToken(account.accessToken)
  const adapter = new WeiboAdapter({ appKey, appSecret, redirectUri })
  const raw = await adapter.getStatusShow(accessToken, id)

  const userObj = raw.user as Record<string, unknown> | undefined
  const safe = {
    id: raw.id,
    idstr: raw.idstr,
    text: typeof raw.text === 'string' ? raw.text.slice(0, 280) : undefined,
    created_at: raw.created_at,
    source: raw.source,
    reposts_count: raw.reposts_count,
    comments_count: raw.comments_count,
    attitudes_count: raw.attitudes_count,
    bmiddle_pic: raw.bmiddle_pic,
    pic_num: raw.pic_num,
    user: userObj
      ? {
          screen_name: userObj.screen_name,
          id: userObj.id
        }
      : undefined
  }

  return {
    ok: true,
    transport: 'oauth',
    data: safe,
    note: '阅读数等敏感字段通常需微博商业接口，此处为开放平台可见字段。'
  }
}
