import type { StorageStateCookie } from '@/lib/weibo-playwright/weibo-storage-cookies'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export function xsrfTokenFromCookies (
  cookies: StorageStateCookie[]
): string | null {
  const byName = Object.fromEntries(cookies.map((c) => [c.name, c.value]))
  for (const key of ['XSRF-TOKEN', 'csrf_token', 'XSRF_TOKEN']) {
    const v = byName[key]
    if (!v || typeof v !== 'string') continue
    try {
      const dec = decodeURIComponent(v.split(';')[0].trim())
      if (dec.length >= 4) return dec
    } catch {
      /* ignore */
    }
  }
  return null
}

export function extractXsrfFromHtml (html: string): string | null {
  const patterns = [
    /"xsrfToken"\s*:\s*"([^"]+)"/,
    /'xsrfToken'\s*:\s*'([^']+)'/,
    /"xsrf"\s*:\s*"([^"]+)"/,
    /\$CONFIG\s*=\s*\{[\s\S]*?'xsrf'\s*:\s*'([^']+)'/,
    /\$CONFIG\s*=\s*\{[\s\S]*?"xsrf"\s*:\s*"([^"]+)"/,
    /<meta\s+name="csrf-token"\s+content="([^"]+)"/i
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1] && m[1].length >= 4) return m[1]
  }
  return null
}

export async function fetchWeiboHomeHtml (
  cookieHeader: string
): Promise<string | null> {
  if (!cookieHeader) return null
  try {
    const res = await fetch('https://weibo.com/', {
      method: 'GET',
      headers: {
        Cookie: cookieHeader,
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': UA
      },
      cache: 'no-store',
      redirect: 'follow'
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export async function resolveXsrf (
  cookies: StorageStateCookie[],
  cookieHeader: string
): Promise<string | null> {
  const fromCookie = xsrfTokenFromCookies(cookies)
  if (fromCookie) return fromCookie
  const html = await fetchWeiboHomeHtml(cookieHeader)
  if (!html) return null
  return extractXsrfFromHtml(html)
}
