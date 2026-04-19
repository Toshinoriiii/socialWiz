/**
 * 浏览器会话型平台：用落盘 Cookie 向线上发轻量请求，判断登录是否仍有效。
 * 用于账号列表：会话文件仍在但 Cookie 已失效时提示用户重新绑定。
 */
import { readZhihuPlaywrightStorageCookies } from '@/lib/zhihu-playwright/zhihu-session-cookies'
import { zhihuJsonHeaders } from '@/lib/zhihu-playwright/zhihu-http'
import {
  readWeiboPlaywrightStorageCookies,
  cookieHeaderForUrl,
  type StorageStateCookie
} from '@/lib/weibo-playwright/weibo-storage-cookies'
import { probeWechatMpPlaywrightSessionAlive } from '@/lib/wechat-playwright/wechat-mp-web-publish'

const PROBE_TIMEOUT_MS = 12_000

const WEIBO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** 与 scripts/weibo-playwright/save-session-for-user.mjs 中 parseAjaxLoginUser 对齐 */
function parseWeiboAjaxLoginUser (json: unknown): boolean {
  if (!json || typeof json !== 'object') return false
  const o = json as Record<string, unknown>
  if (o.ok === 0 && o.msg) return false
  const tryUser = (u: unknown): boolean => {
    if (!u || typeof u !== 'object') return false
    const x = u as Record<string, unknown>
    const idRaw = x.idstr ?? x.id ?? x.uid
    const id =
      idRaw != null ? String(idRaw).replace(/\D/g, '') : ''
    const nameRaw = x.screen_name ?? x.name
    const sn = nameRaw != null ? String(nameRaw).trim() : ''
    if (/^\d{5,15}$/.test(id)) return true
    if (sn.length >= 1 && sn.length <= 80) return true
    return false
  }
  const data = o.data
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (tryUser(d.user)) return true
    if (tryUser(d.userInfo)) return true
    if (tryUser(d.login_user)) return true
    if (tryUser(d.loginUser)) return true
    if (d.uid != null) {
      const id = String(d.uid).replace(/\D/g, '')
      if (/^\d{5,15}$/.test(id)) return true
    }
  }
  if (tryUser(o.user)) return true
  return false
}

async function fetchWeiboJsonProbe (
  url: string,
  cookies: StorageStateCookie[],
  referer: string
): Promise<{ ok: boolean; unauthorized: boolean; parsed: unknown | null }> {
  const cookieHeader = cookieHeaderForUrl(url, cookies)
  if (!cookieHeader) {
    return { ok: false, unauthorized: false, parsed: null }
  }
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Cookie: cookieHeader,
        Referer: referer,
        Accept: 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': WEIBO_UA
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    })
    if (res.status === 401 || res.status === 403) {
      return { ok: false, unauthorized: true, parsed: null }
    }
    if (!res.ok) {
      return { ok: false, unauthorized: false, parsed: null }
    }
    const text = await res.text()
    if (!text || text[0] !== '{') {
      return { ok: true, unauthorized: false, parsed: null }
    }
    try {
      return {
        ok: true,
        unauthorized: false,
        parsed: JSON.parse(text) as unknown
      }
    } catch {
      return { ok: true, unauthorized: false, parsed: null }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('abort') || msg.includes('Timeout')) {
      return { ok: false, unauthorized: false, parsed: null }
    }
    return { ok: false, unauthorized: false, parsed: null }
  }
}

/**
 * @returns true 仍在线；false 已失效；null 未探测或网络/超时不确定（不强制改 needsReauth）
 */
export async function probeWeiboPlaywrightSessionAlive (
  userId: string
): Promise<boolean | null> {
  const cookies = readWeiboPlaywrightStorageCookies(userId)
  if (!cookies?.length) return null

  const urls: Array<{ url: string; referer: string }> = [
    {
      url: 'https://weibo.com/ajax/statuses/config',
      referer: 'https://weibo.com/'
    },
    {
      url: 'https://weibo.com/ajax/profile/info?custom=1',
      referer: 'https://weibo.com/'
    },
    {
      url: 'https://m.weibo.cn/api/config',
      referer: 'https://m.weibo.cn/'
    }
  ]

  let sawUnauthorized = false
  let anyNetwork = false

  for (const { url, referer } of urls) {
    const r = await fetchWeiboJsonProbe(url, cookies, referer)
    if (r.unauthorized) sawUnauthorized = true
    if (r.parsed != null) anyNetwork = true
    if (r.parsed != null && parseWeiboAjaxLoginUser(r.parsed)) {
      return true
    }
  }

  if (sawUnauthorized) return false
  if (!anyNetwork) return null
  return false
}

export async function probeZhihuPlaywrightSessionAlive (
  userId: string
): Promise<boolean | null> {
  const cookies = readZhihuPlaywrightStorageCookies(userId)
  if (!cookies?.length) return null

  const byName = new Map(cookies.map((c) => [c.name, c.value]))
  if (!byName.get('z_c0')?.trim() || !byName.get('_xsrf')?.trim()) {
    return false
  }

  const xsrf = byName.get('_xsrf') ?? ''
  const cookieHeader = cookieHeaderForUrl('https://www.zhihu.com/', cookies)
  if (!cookieHeader) return false

  try {
    const res = await fetch('https://www.zhihu.com/api/v4/me', {
      headers: {
        ...zhihuJsonHeaders(xsrf),
        Cookie: cookieHeader
      },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    })

    if (res.status === 401 || res.status === 403) return false
    if (!res.ok) return null

    const text = await res.text()
    let data: Record<string, unknown>
    try {
      data = JSON.parse(text) as Record<string, unknown>
    } catch {
      return null
    }

    if (data.id == null && data.name == null && data.url_token == null) {
      return false
    }
    return true
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('abort') || msg.includes('Timeout')) return null
    return null
  }
}

export { probeWechatMpPlaywrightSessionAlive }

export async function probePlaywrightPlatformsSessionAlive (userId: string, which: {
  weibo: boolean
  wechat: boolean
  zhihu: boolean
}): Promise<{
  weibo: boolean | null
  wechat: boolean | null
  zhihu: boolean | null
}> {
  const [weibo, wechat, zhihu] = await Promise.all([
    which.weibo ? probeWeiboPlaywrightSessionAlive(userId) : Promise.resolve(null),
    which.wechat ? probeWechatMpPlaywrightSessionAlive(userId) : Promise.resolve(null),
    which.zhihu ? probeZhihuPlaywrightSessionAlive(userId) : Promise.resolve(null)
  ])
  return { weibo, wechat, zhihu }
}
