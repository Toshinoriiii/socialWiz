import {
  cookieHeaderForUrl,
  readWeiboPlaywrightStorageCookies
} from '@/lib/weibo-playwright/weibo-storage-cookies'

const UA =
  'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

function normalizeWeiboStatusId (v: unknown): string | null {
  if (v == null) return null
  const digits = String(v).replace(/\D/g, '')
  return digits.length >= 5 ? digits : null
}

function plainFromWeiboHtml (html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}

function compactForMatch (s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '')
    .slice(0, 120)
}

/** 从 container/getIndex 的 JSON 中收集全部 mblog（供时间线匹配、阅读量补全等） */
export function collectMbogsFromContainerJson (j: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  const visit = (node: unknown) => {
    if (node == null) return
    if (Array.isArray(node)) {
      for (const x of node) visit(x)
      return
    }
    if (typeof node !== 'object') return
    const o = node as Record<string, unknown>
    if (o.mblog && typeof o.mblog === 'object') {
      out.push(o.mblog as Record<string, unknown>)
    }
    for (const v of Object.values(o)) visit(v)
  }
  const data = (j as Record<string, unknown>)?.data
  if (data && typeof data === 'object') {
    visit((data as Record<string, unknown>).cards)
  }
  return out
}

function buildPublishedUrl (weiboUid: string, idstr: string): string {
  const uid = weiboUid.replace(/\D/g, '')
  return uid
    ? `https://weibo.com/${uid}/${idstr}`
    : `https://weibo.com/detail/${idstr}`
}

/**
 * aj/mblog/add 常不返回完整 mblog：根据正文前缀或发布时间，从 m 站个人时间线最近几条里兜底解析帖 ID。
 */
export async function resolveMblogMetaFromProfileTimeline (
  userId: string,
  weiboUid: string,
  postedPlainText: string
): Promise<{ platformPostId: string; publishedUrl: string } | null> {
  const uid = weiboUid.replace(/\D/g, '')
  if (!/^\d{5,15}$/.test(uid)) return null

  const cookies = readWeiboPlaywrightStorageCookies(userId)
  if (!cookies?.length) return null

  const containerid = `107603${uid}`
  const url = `https://m.weibo.cn/api/container/getIndex?type=uid&value=${encodeURIComponent(uid)}&containerid=${encodeURIComponent(containerid)}`
  const cookieHeader = cookieHeaderForUrl(url, cookies)
  if (!cookieHeader) return null

  let raw: string
  try {
    const res = await fetch(url, {
      headers: {
        Cookie: cookieHeader,
        Referer: `https://m.weibo.cn/u/${uid}`,
        Accept: 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': UA
      },
      cache: 'no-store'
    })
    raw = await res.text()
    if (!res.ok) return null
  } catch {
    return null
  }

  let j: unknown
  try {
    j = JSON.parse(raw)
  } catch {
    return null
  }

  const mblogs = collectMbogsFromContainerJson(j)
  if (mblogs.length === 0) return null

  const needle = compactForMatch(postedPlainText.trim())
  if (needle.length >= 8) {
    for (const mb of mblogs) {
      const idstr = normalizeWeiboStatusId(mb.idstr ?? mb.mid ?? mb.id)
      if (!idstr) continue
      const t =
        typeof mb.text === 'string' ? compactForMatch(plainFromWeiboHtml(mb.text)) : ''
      if (
        t &&
        (t.includes(needle.slice(0, Math.min(40, needle.length))) ||
          needle.includes(t.slice(0, Math.min(32, t.length))))
      ) {
        return { platformPostId: idstr, publishedUrl: buildPublishedUrl(uid, idstr) }
      }
    }
  }

  const now = Date.now() / 1000
  for (const mb of mblogs) {
    const idstr = normalizeWeiboStatusId(mb.idstr ?? mb.mid ?? mb.id)
    const ca = mb.created_at
    if (!idstr || typeof ca !== 'number') continue
    if (now - ca >= -30 && now - ca <= 360) {
      return { platformPostId: idstr, publishedUrl: buildPublishedUrl(uid, idstr) }
    }
  }

  return null
}
