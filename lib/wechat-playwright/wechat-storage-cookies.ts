import fs from 'fs'
import { getWechatPlaywrightSessionPath } from '@/lib/wechat-playwright/session-files'

export interface WechatStorageCookie {
  name: string
  value: string
  domain: string
  path: string
  expires: number
  httpOnly: boolean
  secure: boolean
  sameSite?: 'Lax' | 'Strict' | 'None'
}

export function readWechatPlaywrightStorageCookies (
  userId: string
): WechatStorageCookie[] | null {
  try {
    const p = getWechatPlaywrightSessionPath(userId)
    const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as {
      cookies?: WechatStorageCookie[]
    }
    const list = raw.cookies ?? []
    return list.length > 0 ? list : null
  } catch {
    return null
  }
}

function domainMatch (requestHost: string, cookieDomain: string): boolean {
  const d = cookieDomain.startsWith('.')
    ? cookieDomain.slice(1).toLowerCase()
    : cookieDomain.toLowerCase()
  const h = requestHost.toLowerCase()
  if (h === d) return true
  if (h.endsWith('.' + d)) return true
  return false
}

export function cookieHeaderForUrl (
  targetUrl: string,
  cookies: WechatStorageCookie[]
): string {
  const u = new URL(targetUrl)
  const host = u.hostname
  const reqPath = u.pathname || '/'
  const now = Date.now() / 1000
  const map = new Map<string, string>()
  for (const c of cookies) {
    if (c.expires != null && c.expires > 0 && c.expires < now) continue
    const p = c.path && c.path.length > 0 ? c.path : '/'
    if (!reqPath.startsWith(p)) continue
    if (!domainMatch(host, c.domain)) continue
    map.set(c.name, c.value)
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}
