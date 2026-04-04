import {
  cookieHeaderForUrl,
  readWeiboPlaywrightStorageCookies
} from '@/lib/weibo-playwright/weibo-storage-cookies'
import { collectMbogsFromContainerJson } from '@/lib/weibo-playwright/weibo-mblog-meta-resolve'
import { readWeiboPlaywrightProfile } from '@/lib/weibo-playwright/session-files'

const UA =
  'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

const PC_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export interface WeiboCookieStatusInsights {
  id?: string
  idstr?: string
  text?: string
  reposts_count?: number
  comments_count?: number
  attitudes_count?: number
  /** 阅读数：statuses/show 常不含，多从时间线或 PC ajax 补全 */
  reads_count?: number
}

function coerceNonnegInt (v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
    return Math.trunc(v)
  }
  if (typeof v === 'string') {
    const raw = v.trim().replace(/[，,]/g, '')
    if (/^\d+$/.test(raw)) {
      const n = parseInt(raw, 10)
      return Number.isNaN(n) ? undefined : n
    }
    const wan = raw.match(/^(\d+(?:\.\d+)?)\s*万(?:阅读|次)?$/i)
    if (wan) return Math.round(parseFloat(wan[1]) * 10_000)
    const yi = raw.match(/^(\d+(?:\.\d+)?)\s*亿/i)
    if (yi) return Math.round(parseFloat(yi[1]) * 100_000_000)
  }
  return undefined
}

const READ_LIKE_KEYS = [
  'reads_count',
  'read_count',
  'view_count',
  'total_reads',
  'read_num',
  'vv'
] as const

function readCountFromMblogNode (m: Record<string, unknown>): number | undefined {
  for (const k of READ_LIKE_KEYS) {
    const n = coerceNonnegInt(m[k])
    if (n != null) return n
  }
  const pi = m.page_info
  if (pi && typeof pi === 'object') {
    const p = pi as Record<string, unknown>
    for (const k of READ_LIKE_KEYS) {
      const n = coerceNonnegInt(p[k])
      if (n != null) return n
    }
  }
  const ext = m.ext
  if (ext && typeof ext === 'object') {
    const ex = ext as Record<string, unknown>
    for (const k of READ_LIKE_KEYS) {
      const n = coerceNonnegInt(ex[k])
      if (n != null) return n
    }
  }
  return undefined
}

/** 仅在已知子树内搜常见阅读字段，避免误取无关 count */
function deepReadCount (obj: unknown, depth: number): number | undefined {
  if (depth > 9 || obj == null) return
  if (typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    for (const x of obj) {
      const r = deepReadCount(x, depth + 1)
      if (r != null) return r
    }
    return
  }
  const o = obj as Record<string, unknown>
  for (const k of ['reads_count', 'read_count', 'view_count'] as const) {
    if (Object.prototype.hasOwnProperty.call(o, k)) {
      const n = coerceNonnegInt(o[k])
      if (n != null) return n
    }
  }
  for (const v of Object.values(o)) {
    const r = deepReadCount(v, depth + 1)
    if (r != null) return r
  }
}

function mblogIdMatches (mb: Record<string, unknown>, pid: string): boolean {
  for (const x of [mb.idstr, mb.mid, mb.id]) {
    if (x == null) continue
    const d = String(x).replace(/\D/g, '')
    if (d && d === pid) return true
  }
  return false
}

/**
 * statuses/show 经常不带 reads；个人时间线 container/getIndex 的 card 里较常见。
 */
async function supplementReadsFromUserTimeline (
  userId: string,
  postId: string
): Promise<number | undefined> {
  const profile = readWeiboPlaywrightProfile(userId)
  const uid = profile?.weiboUid?.replace(/\D/g, '') ?? ''
  if (!/^\d{5,15}$/.test(uid)) return
  const cookies = readWeiboPlaywrightStorageCookies(userId)
  if (!cookies?.length) return

  const containerid = `107603${uid}`
  const url = `https://m.weibo.cn/api/container/getIndex?type=uid&value=${encodeURIComponent(
    uid
  )}&containerid=${encodeURIComponent(containerid)}&page=1`
  const cookieHeader = cookieHeaderForUrl(url, cookies)
  if (!cookieHeader) return

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
    const raw = await res.text()
    if (!res.ok) return
    const j: unknown = JSON.parse(raw)
    const mblogs = collectMbogsFromContainerJson(j)
    const pid = postId.replace(/\D/g, '')
    for (const mb of mblogs) {
      if (!mblogIdMatches(mb, pid)) continue
      return readCountFromMblogNode(mb) ?? deepReadCount(mb, 0)
    }
  } catch {
    /* ignore */
  }
}

/** PC ajax 有时带阅读数（需登录 Cookie，接口非稳定契约） */
async function supplementReadsFromWeiboPcAjax (
  userId: string,
  postId: string
): Promise<number | undefined> {
  const cookies = readWeiboPlaywrightStorageCookies(userId)
  if (!cookies?.length) return
  const cookieHeader = cookieHeaderForUrl('https://weibo.com/', cookies)
  if (!cookieHeader) return
  const url = `https://weibo.com/ajax/statuses/show?id=${encodeURIComponent(postId)}`
  try {
    const res = await fetch(url, {
      headers: {
        Cookie: cookieHeader,
        Referer: 'https://weibo.com/',
        Accept: 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': PC_UA
      },
      cache: 'no-store'
    })
    const raw = await res.text()
    if (!res.ok) return
    const j = JSON.parse(raw) as Record<string, unknown>
    const data = j.data
    if (data && typeof data === 'object') {
      return deepReadCount(data, 0)
    }
  } catch {
    /* ignore */
  }
}

/**
 * 用 Playwright 会话 Cookie 请求 m.weibo.cn 单条详情（与开放接口 fields 类似但非稳定契约）。
 */
export async function fetchWeiboStatusInsightsWithSessionCookies (
  userId: string,
  postId: string
): Promise<{ ok: true; data: WeiboCookieStatusInsights } | { ok: false; error: string }> {
  const id = String(postId).trim()
  if (!/^\d{5,25}$/.test(id)) {
    return { ok: false, error: 'postId 应为数字 mid/id' }
  }
  const cookies = readWeiboPlaywrightStorageCookies(userId)
  if (!cookies?.length) {
    return { ok: false, error: '无会话 Cookie' }
  }
  const url = `https://m.weibo.cn/statuses/show?id=${encodeURIComponent(id)}`
  const cookieHeader = cookieHeaderForUrl(url, cookies)
  if (!cookieHeader) {
    return { ok: false, error: '无法为 m.weibo.cn 拼 Cookie' }
  }
  try {
    const res = await fetch(url, {
      headers: {
        Cookie: cookieHeader,
        Referer: `https://m.weibo.cn/status/${id}`,
        Accept: 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': UA
      },
      cache: 'no-store'
    })
    const raw = await res.text()
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${raw.slice(0, 200)}` }
    }
    const j = JSON.parse(raw) as Record<string, unknown>
    let st: unknown = j.data
    if (!st || typeof st !== 'object') {
      return { ok: false, error: '响应无 data' }
    }
    const dataRoot = st as Record<string, unknown>
    let m = dataRoot
    const nested = m.mblog
    if (nested && typeof nested === 'object') {
      m = nested as Record<string, unknown>
    }

    let readsCount =
      readCountFromMblogNode(m) ??
      readCountFromMblogNode(dataRoot) ??
      deepReadCount(dataRoot, 0)

    if (readsCount == null) {
      readsCount = await supplementReadsFromUserTimeline(userId, id)
    }
    if (readsCount == null) {
      readsCount = await supplementReadsFromWeiboPcAjax(userId, id)
    }

    const out: WeiboCookieStatusInsights = {
      id: m.id != null ? String(m.id) : undefined,
      idstr: m.idstr != null ? String(m.idstr) : undefined,
      text: typeof m.text === 'string' ? m.text.slice(0, 280) : undefined,
      reposts_count:
        typeof m.reposts_count === 'number' ? m.reposts_count : undefined,
      comments_count:
        typeof m.comments_count === 'number' ? m.comments_count : undefined,
      attitudes_count:
        typeof m.attitudes_count === 'number' ? m.attitudes_count : undefined,
      reads_count: readsCount
    }
    return { ok: true, data: out }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e)
    }
  }
}
