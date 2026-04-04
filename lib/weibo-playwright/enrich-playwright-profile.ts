import fs from 'fs'
import {
  getWeiboPlaywrightSessionPath,
  readWeiboPlaywrightProfile,
  writeWeiboPlaywrightProfileMerge
} from '@/lib/weibo-playwright/session-files'
import {
  cookieHeaderForUrl,
  type StorageStateCookie
} from '@/lib/weibo-playwright/weibo-storage-cookies'

interface StorageStateFile {
  cookies?: StorageStateCookie[]
}

function extractScreenNameFromJson (json: unknown): string | null {
  if (!json || typeof json !== 'object') return null
  const tryName = (v: unknown): string | null => {
    if (typeof v !== 'string') return null
    const s = v.trim()
    if (s.length >= 1 && s.length <= 80) return s.slice(0, 80)
    return null
  }
  const walkUser = (user: unknown): string | null => {
    if (!user || typeof user !== 'object') return null
    const o = user as Record<string, unknown>
    return (
      tryName(o.screen_name) ??
      tryName(o.screenName) ??
      tryName(o.name)
    )
  }
  const o = json as Record<string, unknown>
  const data = o.data
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    const fromUserInfo = walkUser(d.userInfo)
    if (fromUserInfo) return fromUserInfo
    const fromUser = walkUser(d.user)
    if (fromUser) return fromUser
    const cards = d.cards
    if (Array.isArray(cards)) {
      for (const c of cards) {
        if (!c || typeof c !== 'object') continue
        const card = c as Record<string, unknown>
        const mblog = card.mblog
        if (mblog && typeof mblog === 'object') {
          const u = (mblog as Record<string, unknown>).user
          const n = walkUser(u)
          if (n) return n
        }
        const n2 = walkUser(card.user)
        if (n2) return n2
      }
    }
  }
  return walkUser(o.user)
}

async function fetchJsonWithCookies (
  url: string,
  cookieHeader: string,
  referer: string
): Promise<unknown | null> {
  if (!cookieHeader) return null
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Cookie: cookieHeader,
      Referer: referer,
      Accept: 'application/json, text/plain, */*',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    cache: 'no-store'
  })
  if (!res.ok) return null
  const text = await res.text()
  if (!text || text[0] !== '{') return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

/**
 * 使用 Playwright storageState 中的 Cookie 请求微博接口，按 uid 解析昵称（不读 DOM）。
 */
export async function fetchWeiboScreenNameWithSessionCookies (
  userId: string,
  weiboUid: string
): Promise<string | null> {
  const uid = String(weiboUid).replace(/\D/g, '')
  if (!/^\d{5,15}$/.test(uid)) return null

  const sessionPath = getWeiboPlaywrightSessionPath(userId)
  let raw: StorageStateFile
  try {
    raw = JSON.parse(fs.readFileSync(sessionPath, 'utf8')) as StorageStateFile
  } catch {
    return null
  }
  const cookies = raw.cookies ?? []
  if (cookies.length === 0) return null

  const pcUrl = `https://weibo.com/ajax/profile/info?uid=${encodeURIComponent(uid)}`
  const pcCookie = cookieHeaderForUrl(pcUrl, cookies)
  let json = await fetchJsonWithCookies(
    pcUrl,
    pcCookie,
    'https://weibo.com/'
  )
  let name = json ? extractScreenNameFromJson(json) : null
  if (name) return name

  const mUrl = `https://m.weibo.cn/api/container/getIndex?type=uid&value=${encodeURIComponent(uid)}&containerid=${encodeURIComponent(`100505${uid}`)}`
  const mCookie = cookieHeaderForUrl(mUrl, cookies)
  json = await fetchJsonWithCookies(mUrl, mCookie, 'https://m.weibo.cn/')
  name = json ? extractScreenNameFromJson(json) : null
  return name
}

const enrichCooldownFail = new Map<string, number>()
const ENRICH_FAIL_COOLDOWN_MS = 120_000

/**
 * 若 profile 仅有 weiboUid、缺少 displayName，则用会话 Cookie 拉取 screen_name 并写回 profile。
 */
export async function enrichWeiboPlaywrightProfileScreenName (
  userId: string
): Promise<void> {
  const profile = readWeiboPlaywrightProfile(userId)
  if (!profile?.weiboUid) return
  if (profile.displayName && profile.displayName.length > 0) return

  const lastFail = enrichCooldownFail.get(userId)
  if (lastFail != null && Date.now() - lastFail < ENRICH_FAIL_COOLDOWN_MS) {
    return
  }

  try {
    const name = await fetchWeiboScreenNameWithSessionCookies(
      userId,
      profile.weiboUid
    )
    if (name) {
      writeWeiboPlaywrightProfileMerge(userId, { displayName: name })
      enrichCooldownFail.delete(userId)
    } else {
      enrichCooldownFail.set(userId, Date.now())
    }
  } catch {
    enrichCooldownFail.set(userId, Date.now())
  }
}
