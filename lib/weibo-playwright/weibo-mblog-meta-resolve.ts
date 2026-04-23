import {
  cookieHeaderForUrl,
  readWeiboPlaywrightStorageCookies
} from '@/lib/weibo-playwright/weibo-storage-cookies'
import { normalizeWeiboMblogIdSegment } from '@/lib/weibo-playwright/weibo-profile-status-url'

const UA =
  'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

const PC_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

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
    /**
     * 新版 m 站常见 `data.list` / 深层 card，而不是顶层 `data.cards`；
     * 只扫 `cards` 会得到 0 条 mblog，时间线兜底永远失败。
     */
    visit(data)
  } else {
    visit(j)
  }
  return out
}

function buildPublishedUrl (weiboUid: string, idstr: string): string {
  const uid = weiboUid.replace(/\D/g, '')
  return uid
    ? `https://weibo.com/${uid}/${idstr}`
    : `https://weibo.com/detail/${idstr}`
}

function normalizeMblogTime (raw: unknown): number | null {
  if (raw == null) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw > 1e12 ? raw / 1000 : raw
  }
  if (typeof raw === 'string' && /^\d{10,13}$/.test(raw)) {
    const n = parseInt(raw, 10)
    return n > 1e12 ? n / 1000 : n
  }
  return null
}

/**
 * 从 PC 站「我的微博」块 HTML/JSON 碎片里抠单帖链接（不依赖整段 JSON 结构）。
 */
function pluckFromPcMymblogRaw (raw: string, uid: string): {
  platformPostId: string
  publishedUrl: string
} | null {
  const s = raw.replace(/\\\//g, '/')
  const m = s.match(
    /https?:\/\/(?:www\.)?weibo\.com\/(\d{5,20})\/([0-9A-Za-z_\-]{4,32})(?=[\s"'<\\#?,]|$)/i
  )
  if (m?.[1] && m[2] && m[1] === uid) {
    return {
      platformPostId: m[2],
      publishedUrl: `https://weibo.com/${m[1]}/${m[2]}`
    }
  }
  return null
}

async function fetchMWeiboGetIndexMblogs (
  userId: string,
  uid: string,
  containerid: string
): Promise<Record<string, unknown>[]> {
  const cookies = readWeiboPlaywrightStorageCookies(userId)
  if (!cookies?.length) return []
  const url = `https://m.weibo.cn/api/container/getIndex?type=uid&value=${encodeURIComponent(uid)}&containerid=${encodeURIComponent(containerid)}`
  const cookieHeader = cookieHeaderForUrl(url, cookies)
  if (!cookieHeader) return []
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
    if (!res.ok) return []
  } catch {
    return []
  }
  try {
    return collectMbogsFromContainerJson(JSON.parse(raw) as unknown)
  } catch {
    return []
  }
}

/**
 * 试拉 PC 端「我发的微博」ajax（与 m 站 getIndex 互补；Cookie 为 weibo.com 会话）。
 */
async function tryPcMymblogPluck (
  userId: string,
  uid: string
): Promise<{ platformPostId: string; publishedUrl: string } | null> {
  const cookies = readWeiboPlaywrightStorageCookies(userId)
  if (!cookies?.length) return null
  const u = new URL('https://weibo.com/ajax/statuses/mymblog')
  u.searchParams.set('uid', uid)
  u.searchParams.set('page', '1')
  u.searchParams.set('feature', '0')
  u.searchParams.set('__rnd', String(Date.now()))
  const url = u.toString()
  const cookieHeader = cookieHeaderForUrl('https://weibo.com/', cookies)
  if (!cookieHeader) return null
  try {
    const res = await fetch(url, {
      headers: {
        Cookie: cookieHeader,
        Referer: `https://weibo.com/u/${uid}`,
        Accept: 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': PC_UA
      },
      cache: 'no-store'
    })
    const raw = await res.text()
    if (!res.ok) return null
    return pluckFromPcMymblogRaw(raw, uid)
  } catch {
    return null
  }
}

function pickMblogByMatch (
  mblogs: Record<string, unknown>[],
  postedPlainText: string,
  uid: string
): { platformPostId: string; publishedUrl: string } | null {
  if (mblogs.length === 0) return null

  const needle = compactForMatch(postedPlainText.trim())
  if (needle.length >= 4) {
    for (const mb of mblogs) {
      const idstr = normalizeWeiboMblogIdSegment(mb.idstr ?? mb.mid ?? mb.id)
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
    const idstr = normalizeWeiboMblogIdSegment(mb.idstr ?? mb.mid ?? mb.id)
    const ca = normalizeMblogTime(mb.created_at)
    if (!idstr || ca == null) continue
    if (now - ca >= -30 && now - ca <= 900) {
      return { platformPostId: idstr, publishedUrl: buildPublishedUrl(uid, idstr) }
    }
  }

  /** 强兜底：列表第一条若在约 3 分钟内发出，通常即刚发这条（多账号狂发时才有误配风险） */
  const first = mblogs[0]
  const id0 = normalizeWeiboMblogIdSegment(
    first.idstr ?? first.mid ?? first.id
  )
  const ca0 = normalizeMblogTime(first.created_at)
  if (id0 && ca0 != null && now - ca0 >= -60 && now - ca0 <= 180) {
    return { platformPostId: id0, publishedUrl: buildPublishedUrl(uid, id0) }
  }

  return null
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

  const containers = [`107603${uid}`, `100505${uid}`]
  for (const cid of containers) {
    const mblogs = await fetchMWeiboGetIndexMblogs(userId, uid, cid)
    const hit = pickMblogByMatch(mblogs, postedPlainText, uid)
    if (hit) return hit
  }

  const pc = await tryPcMymblogPluck(userId, uid)
  if (pc) return pc

  return null
}
