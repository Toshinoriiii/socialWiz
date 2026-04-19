import {
  cookieHeaderForUrl,
  readWeiboPlaywrightStorageCookies
} from '@/lib/weibo-playwright/weibo-storage-cookies'
import { normalizeWeiboArticleOidDigitsForLookup } from '@/lib/weibo-playwright/weibo-internal-ids'
import { collectMbogsFromContainerJson } from '@/lib/weibo-playwright/weibo-mblog-meta-resolve'
import { readWeiboPlaywrightProfile } from '@/lib/weibo-playwright/session-files'
import { normalizeWeiboStatusPostId } from '@/lib/weibo-playwright/weibo-profile-status-url'

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

/** 头条/专栏 object_id 多为 18～28 位十进制，与时间线 mid（常更短）区分，避免误用 statuses/show */
export function isWeiboArticleNumericObjectId (digits: string): boolean {
  const d = normalizeWeiboArticleOidDigitsForLookup(digits)
  return d.length >= 18 && d.length <= 28 && /^\d+$/.test(d)
}

function articleOidMatchSet (objectIdDigits: string): Set<string> {
  const want = new Set<string>()
  const d = normalizeWeiboArticleOidDigitsForLookup(objectIdDigits)
  if (d.length >= 10) {
    want.add(d)
    want.add(`1022:${d}`)
  }
  return want
}

function blobRefsArticleOid (v: unknown, want: Set<string>): boolean {
  if (v == null) return false
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  for (const w of want) {
    if (w.length >= 8 && s.includes(w)) return true
  }
  return false
}

function mblogRefsArticleObjectId (
  mb: Record<string, unknown>,
  objectIdDigits: string
): boolean {
  const want = articleOidMatchSet(objectIdDigits)
  if (blobRefsArticleOid(mb.page_info, want)) return true
  const us = mb.url_struct
  if (Array.isArray(us)) {
    for (const u of us) {
      if (u && typeof u === 'object' && blobRefsArticleOid(u, want)) return true
    }
  }
  const ann = mb.annotations
  if (Array.isArray(ann)) {
    for (const a of ann) {
      if (a && typeof a === 'object') {
        const o = a as Record<string, unknown>
        if (blobRefsArticleOid(o.oid, want) || blobRefsArticleOid(o.type, want)) {
          return true
        }
      }
    }
  }
  if (blobRefsArticleOid(mb.retweeted_status, want)) return true
  return blobRefsArticleOid(mb, want)
}

function midDigitsFromMblog (mb: Record<string, unknown>): string | null {
  for (const x of [mb.idstr, mb.mid, mb.id]) {
    if (x == null) continue
    const d = String(x).replace(/\D/g, '')
    if (/^\d{5,40}$/.test(d)) return d
  }
  return null
}

/**
 * 发布记录里只有头条 object_id 时，在个人微博时间线容器里找带该文章卡片的 mblog，取出时间线 mid。
 */
export async function findFeedMidByWeiboArticleObjectId (
  userId: string,
  articleObjectIdRaw: string,
  maxPages = 25
): Promise<string | null> {
  const oid = normalizeWeiboArticleOidDigitsForLookup(articleObjectIdRaw)
  if (!/^\d{10,40}$/.test(oid)) return null
  const profile = readWeiboPlaywrightProfile(userId)
  const uid = profile?.weiboUid?.replace(/\D/g, '') ?? ''
  if (!/^\d{5,15}$/.test(uid)) return null
  const cookies = readWeiboPlaywrightStorageCookies(userId)
  if (!cookies?.length) return null

  const containerid = `107603${uid}`

  for (let page = 1; page <= maxPages; page++) {
    const url = `https://m.weibo.cn/api/container/getIndex?type=uid&value=${encodeURIComponent(
      uid
    )}&containerid=${encodeURIComponent(containerid)}&page=${page}`
    const cookieHeader = cookieHeaderForUrl(url, cookies)
    if (!cookieHeader) return null

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
      if (!res.ok) continue
      const j: unknown = JSON.parse(raw)
      const mblogs = collectMbogsFromContainerJson(j)
      for (const mb of mblogs) {
        if (mblogRefsArticleObjectId(mb, oid)) {
          const mid = midDigitsFromMblog(mb)
          if (mid) return mid
        }
      }
      if (mblogs.length === 0) break
    } catch {
      /* next page */
    }
  }
  return null
}

export type FindFeedMidRetryOptions = {
  maxPages?: number
  /** 每次未找到后再等待的毫秒数；默认用于发布落库（约 5 次尝试） */
  pauseMsAfterFail?: number[]
}

/**
 * 新发头条后时间线可能延迟数秒才出现卡片，多次扫描容器接口提高落库与分析成功率。
 * 数据分析等场景可传入更短的 `pauseMsAfterFail` 以免拖慢整页。
 */
export async function findFeedMidByWeiboArticleObjectIdWithRetry (
  userId: string,
  articleObjectIdRaw: string,
  options?: FindFeedMidRetryOptions
): Promise<string | null> {
  const maxPages = options?.maxPages ?? 25
  const pauseMs =
    options?.pauseMsAfterFail ?? [1200, 2000, 3200, 4500]
  for (let attempt = 0; attempt <= pauseMs.length; attempt++) {
    const mid = await findFeedMidByWeiboArticleObjectId(
      userId,
      articleObjectIdRaw,
      maxPages
    )
    if (mid) return mid
    const wait = pauseMs[attempt]
    if (wait != null) {
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  return null
}

function looksLikeMblogShape (o: Record<string, unknown>): boolean {
  const hasId =
    o.id != null || o.idstr != null || o.mid != null || o.bid != null
  if (!hasId) return false
  const n = (v: unknown) => coerceNonnegInt(v)
  return (
    n(o.reposts_count) != null ||
    n(o.comments_count) != null ||
    n(o.attitudes_count) != null ||
    n(o.repost_count) != null ||
    n(o.comment_count) != null ||
    n(o.like_count) != null ||
    typeof o.text === 'string'
  )
}

const REPOST_COUNT_KEYS = [
  'reposts_count',
  'repost_count',
  'reposts',
  'forward_count'
] as const
const COMMENT_COUNT_KEYS = [
  'comments_count',
  'comment_count',
  'cmt_num',
  'rootcomments_count'
] as const
const LIKE_COUNT_KEYS = [
  'attitudes_count',
  'attitude_count',
  'like_count',
  'liked_count',
  'praise_count'
] as const

function pickCountFromRecord (
  rec: Record<string, unknown>,
  keys: readonly string[]
): number | undefined {
  for (const k of keys) {
    const n = coerceNonnegInt(rec[k])
    if (n != null) return n
  }
  return undefined
}

/** 接口常把转评赞做成字符串或塞进 ext/page_info，与阅读数逻辑一致做宽松解析 */
function interactionCountsFromMblog (
  m: Record<string, unknown>
): {
  reposts_count?: number
  comments_count?: number
  attitudes_count?: number
} {
  let reposts = pickCountFromRecord(m, REPOST_COUNT_KEYS)
  let comments = pickCountFromRecord(m, COMMENT_COUNT_KEYS)
  let attitudes = pickCountFromRecord(m, LIKE_COUNT_KEYS)

  const ext = m.ext
  if (ext && typeof ext === 'object') {
    const ex = ext as Record<string, unknown>
    reposts ??= pickCountFromRecord(ex, REPOST_COUNT_KEYS)
    comments ??= pickCountFromRecord(ex, COMMENT_COUNT_KEYS)
    attitudes ??= pickCountFromRecord(ex, LIKE_COUNT_KEYS)
  }
  const pi = m.page_info
  if (pi && typeof pi === 'object') {
    const p = pi as Record<string, unknown>
    reposts ??= pickCountFromRecord(p, REPOST_COUNT_KEYS)
    comments ??= pickCountFromRecord(p, COMMENT_COUNT_KEYS)
    attitudes ??= pickCountFromRecord(p, LIKE_COUNT_KEYS)
  }
  return {
    reposts_count: reposts,
    comments_count: comments,
    attitudes_count: attitudes
  }
}

function deepFindInteractionCount (
  obj: unknown,
  keys: readonly string[],
  depth: number
): number | undefined {
  if (depth > 8 || obj == null) return undefined
  if (typeof obj !== 'object') return undefined
  if (Array.isArray(obj)) {
    for (const el of obj) {
      const r = deepFindInteractionCount(el, keys, depth + 1)
      if (r != null) return r
    }
    return undefined
  }
  const o = obj as Record<string, unknown>
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(o, k)) {
      const n = coerceNonnegInt(o[k])
      if (n != null) return n
    }
  }
  for (const v of Object.values(o)) {
    const r = deepFindInteractionCount(v, keys, depth + 1)
    if (r != null) return r
  }
  return undefined
}

/**
 * 解析 H5/PC statuses/show 类 JSON，取出 mblog 节点（结构随产品线变化，尽量宽松）。
 */
function extractMblogFromShowJson (
  j: Record<string, unknown>
): { mblog: Record<string, unknown>; dataRoot: Record<string, unknown> } | null {
  const ok = j.ok
  if (ok === 0 || ok === '0') return null

  const d = j.data
  if (!d || typeof d !== 'object') return null
  const dataRoot = d as Record<string, unknown>
  const nested = dataRoot.mblog
  if (nested && typeof nested === 'object') {
    return { mblog: nested as Record<string, unknown>, dataRoot }
  }
  if (looksLikeMblogShape(dataRoot)) {
    return { mblog: dataRoot, dataRoot }
  }
  return null
}

async function fetchJsonPcStatusesShow (
  userId: string,
  id: string
): Promise<Record<string, unknown> | null> {
  const cookies = readWeiboPlaywrightStorageCookies(userId)
  if (!cookies?.length) return null
  const cookieHeader = cookieHeaderForUrl('https://weibo.com/', cookies)
  if (!cookieHeader) return null
  const url = `https://weibo.com/ajax/statuses/show?id=${encodeURIComponent(id)}`
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
    if (!res.ok) return null
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * 从本人时间线多页中按 mid/id 找 mblog（H5 show 对非时间线体裁常无 data）。
 */
async function findMblogOnProfileTimeline (
  userId: string,
  postId: string,
  maxPages = 12
): Promise<Record<string, unknown> | null> {
  const profile = readWeiboPlaywrightProfile(userId)
  const uid = profile?.weiboUid?.replace(/\D/g, '') ?? ''
  if (!/^\d{5,15}$/.test(uid)) return null
  const cookies = readWeiboPlaywrightStorageCookies(userId)
  if (!cookies?.length) return null

  const containerid = `107603${uid}`
  const pid = postId.replace(/\D/g, '')

  for (let page = 1; page <= maxPages; page++) {
    const url = `https://m.weibo.cn/api/container/getIndex?type=uid&value=${encodeURIComponent(
      uid
    )}&containerid=${encodeURIComponent(containerid)}&page=${page}`
    const cookieHeader = cookieHeaderForUrl(url, cookies)
    if (!cookieHeader) return null

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
      if (!res.ok) continue
      const j: unknown = JSON.parse(raw)
      const mblogs = collectMbogsFromContainerJson(j)
      for (const mb of mblogs) {
        if (mblogIdMatches(mb, pid)) return mb
      }
      if (mblogs.length === 0) break
    } catch {
      /* next page */
    }
  }
  return null
}

/**
 * statuses/show 经常不带 reads；个人时间线 container/getIndex 的 card 里较常见。
 */
async function supplementReadsFromUserTimeline (
  userId: string,
  postId: string
): Promise<number | undefined> {
  const mb = await findMblogOnProfileTimeline(userId, postId, 12)
  if (!mb) return
  return readCountFromMblogNode(mb) ?? deepReadCount(mb, 0)
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

function weiboApiMsgSnippet (j: Record<string, unknown> | null): string {
  if (!j) return ''
  const parts = [j.msg, j.message, j.errmsg].filter(
    (x): x is string => typeof x === 'string' && x.length > 0
  )
  return parts[0]?.slice(0, 120) ?? ''
}

/**
 * 用 Playwright 会话 Cookie 拉单帖互动：PC ajax/show（与 weibo.com/ajax/statuses/show 一致）→
 * m.weibo.cn show → 本人时间线多页匹配。
 */
export async function fetchWeiboStatusInsightsWithSessionCookies (
  userId: string,
  postId: string
): Promise<{ ok: true; data: WeiboCookieStatusInsights } | { ok: false; error: string }> {
  const id = normalizeWeiboStatusPostId(postId)
  if (!id) {
    return {
      ok: false,
      error:
        '无法解析微博帖 id（需为 5～40 位数字 mid，或含 weibo.com/…/mid、m.weibo.cn/status/mid 的链接）'
    }
  }
  const cookies0 = readWeiboPlaywrightStorageCookies(userId)
  if (!cookies0?.length) {
    return { ok: false, error: '无会话 Cookie' }
  }

  try {
    let mobileJson: Record<string, unknown> | null = null
    let mobileHttpFail: string | null = null
    let m: Record<string, unknown> | null = null
    let dataRoot: Record<string, unknown> | null = null

    const pcJsonFirst = await fetchJsonPcStatusesShow(userId, id)
    if (pcJsonFirst) {
      const ex = extractMblogFromShowJson(pcJsonFirst)
      if (ex) {
        m = ex.mblog
        dataRoot = ex.dataRoot
      }
    }

    if (!m) {
      const url = `https://m.weibo.cn/statuses/show?id=${encodeURIComponent(id)}`
      const cookieHeader = cookieHeaderForUrl(url, cookies0)
      if (!cookieHeader) {
        return { ok: false, error: '无法为 m.weibo.cn 拼 Cookie' }
      }
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
        mobileHttpFail = `H5 HTTP ${res.status}: ${raw.slice(0, 160)}`
      } else {
        try {
          mobileJson = JSON.parse(raw) as Record<string, unknown>
        } catch {
          mobileHttpFail = 'H5 返回非 JSON'
        }
      }
      if (mobileJson) {
        const ex = extractMblogFromShowJson(mobileJson)
        if (ex) {
          m = ex.mblog
          dataRoot = ex.dataRoot
        }
      }
    }

    if (!m) {
      m = await findMblogOnProfileTimeline(userId, id, 12)
      dataRoot = m
    }

    if (!m) {
      const hint = [
        mobileJson ? weiboApiMsgSnippet(mobileJson) : null,
        mobileHttpFail
      ]
        .filter(Boolean)
        .join('；')
      return {
        ok: false,
        error: `无法解析该帖详情（已尝试 PC ajax、H5 statuses/show、时间线）。${
          hint ? ` ${hint}` : ''
        } 若为头条文章等体裁，id 可能与时间线 mid 不一致。`
      }
    }

    let readsCount =
      readCountFromMblogNode(m) ??
      (dataRoot ? readCountFromMblogNode(dataRoot) : undefined) ??
      (dataRoot ? deepReadCount(dataRoot, 0) : undefined) ??
      deepReadCount(m, 0)

    if (readsCount == null) {
      readsCount = await supplementReadsFromUserTimeline(userId, id)
    }
    if (readsCount == null) {
      readsCount = await supplementReadsFromWeiboPcAjax(userId, id)
    }

    let {
      reposts_count: repostsCount,
      comments_count: commentsCount,
      attitudes_count: attitudesCount
    } = interactionCountsFromMblog(m)

    if (
      repostsCount == null ||
      commentsCount == null ||
      attitudesCount == null
    ) {
      const pcJson = await fetchJsonPcStatusesShow(userId, id)
      const ex = pcJson ? extractMblogFromShowJson(pcJson) : null
      const mPc = ex?.mblog
      if (mPc) {
        const pcInts = interactionCountsFromMblog(mPc)
        repostsCount ??= pcInts.reposts_count
        commentsCount ??= pcInts.comments_count
        attitudesCount ??= pcInts.attitudes_count
      }
      if (pcJson) {
        repostsCount ??= deepFindInteractionCount(
          pcJson,
          REPOST_COUNT_KEYS,
          0
        )
        commentsCount ??= deepFindInteractionCount(
          pcJson,
          COMMENT_COUNT_KEYS,
          0
        )
        attitudesCount ??= deepFindInteractionCount(
          pcJson,
          LIKE_COUNT_KEYS,
          0
        )
      }
    }

    if (
      repostsCount == null ||
      commentsCount == null ||
      attitudesCount == null
    ) {
      repostsCount ??= deepFindInteractionCount(m, REPOST_COUNT_KEYS, 0)
      commentsCount ??= deepFindInteractionCount(m, COMMENT_COUNT_KEYS, 0)
      attitudesCount ??= deepFindInteractionCount(m, LIKE_COUNT_KEYS, 0)
    }

    const out: WeiboCookieStatusInsights = {
      id: m.id != null ? String(m.id) : undefined,
      idstr: m.idstr != null ? String(m.idstr) : undefined,
      text: typeof m.text === 'string' ? m.text.slice(0, 280) : undefined,
      reposts_count: repostsCount,
      comments_count: commentsCount,
      attitudes_count: attitudesCount,
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
