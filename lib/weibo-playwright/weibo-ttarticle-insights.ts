/**
 * 微博头条文章（ttarticle）互动：拉取 weibo.com/ttarticle/p/show HTML，从页面/内嵌 JSON 解析
 * 阅读与互动；再以 aj/content、m 站 article/view JSON 与时间线 statuses/show 补全缺口。
 * 与时间线 mid 的 statuses/show 不是同一套 id。
 */
import {
  cookieHeaderForUrl,
  readWeiboPlaywrightStorageCookies
} from '@/lib/weibo-playwright/weibo-storage-cookies'
import { normalizeWeiboArticleOidDigitsForLookup } from '@/lib/weibo-playwright/weibo-internal-ids'
import { fetchWeiboStatusInsightsWithSessionCookies } from '@/lib/weibo-playwright/weibo-status-cookie'

const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

const PC_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** 与 WeiboCookieStatusInsights 对齐，供概览汇总 */
export interface WeiboTtarticleInsights {
  reads_count?: number
  comments_count?: number
  reposts_count?: number
  attitudes_count?: number
}

function parseIntLoose (s: string): number | undefined {
  const n = parseInt(s.replace(/,/g, ''), 10)
  return Number.isFinite(n) ? Math.max(0, n) : undefined
}

function firstMatchInt (html: string, patterns: RegExp[]): number | undefined {
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) {
      const v = parseIntLoose(m[1])
      if (v != null) return v
    }
  }
  return undefined
}

/** 同一 key 在页面中多次出现时，取合理值（互动数通常与正文同一段 JSON） */
function maxMatchIntInHtml (html: string, patterns: RegExp[]): number | undefined {
  let best: number | undefined
  for (const re of patterns) {
    const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`
    const globalRe = new RegExp(re.source, flags)
    let m: RegExpExecArray | null
    while ((m = globalRe.exec(html)) !== null) {
      const v = parseIntLoose(m[1])
      if (v == null) continue
      if (best == null || v > best) best = v
    }
  }
  return best
}

/**
 * 头条页内嵌数据多在 object_id 附近的 <script> 里，缩小窗口可减少误匹配其它模块数字。
 */
function sliceHtmlNearObjectId (html: string, objectId: string): string {
  const idx = html.indexOf(objectId)
  if (idx < 0) return html
  const pad = 12000
  return html.slice(Math.max(0, idx - pad), Math.min(html.length, idx + pad))
}

function parseStatsFromTtarticleHtml (
  html: string,
  objectId: string
): WeiboTtarticleInsights {
  const near = sliceHtmlNearObjectId(html, objectId)
  const scan = (full: string, nearOnly: string) => ({
    full,
    near: nearOnly
  })
  const { full, near: n } = scan(html, near)

  const reads = firstMatchInt(full, [
    /阅读数[：:\s]*(?:<[^>]+>)?\s*([\d,]+)/i,
    /"read_count"\s*:\s*(\d+)/,
    /"reads_count"\s*:\s*(\d+)/,
    /"readCount"\s*:\s*(\d+)/,
    /阅读\s*<[^>]*>\s*([\d,]+)/i
  ])

  const comments =
    firstMatchInt(n, [
      /"comment_count"\s*:\s*(\d+)/,
      /"comments_count"\s*:\s*(\d+)/,
      /"commentCount"\s*:\s*(\d+)/,
      /"total_comments"\s*:\s*(\d+)/,
      /"cmt_num"\s*:\s*(\d+)/,
      /"cmt_count"\s*:\s*(\d+)/,
      /"comment_num"\s*:\s*(\d+)/,
      /评论(?:数)?[：:\s]*(?:<[^>]+>)?\s*([\d,]+)/i,
      /评论\s*[（(]\s*([\d,]+)\s*[)）]/,
      /"rootCommentCount"\s*:\s*(\d+)/,
      /"comment_management"[^}]*"count"\s*:\s*(\d+)/
    ]) ??
    maxMatchIntInHtml(n, [
      /"comment_count"\s*:\s*(\d+)/,
      /"comments_count"\s*:\s*(\d+)/
    ])

  const reposts =
    firstMatchInt(n, [
      /"reposts_count"\s*:\s*(\d+)/,
      /"repost_count"\s*:\s*(\d+)/,
      /"repostCount"\s*:\s*(\d+)/,
      /"repost_num"\s*:\s*(\d+)/,
      /"forward_count"\s*:\s*(\d+)/,
      /"forward_num"\s*:\s*(\d+)/,
      /转发(?:数)?[：:\s]*(?:<[^>]+>)?\s*([\d,]+)/i,
      /转发\s*[（(]\s*([\d,]+)\s*[)）]/
    ]) ??
    maxMatchIntInHtml(n, [/"reposts_count"\s*:\s*(\d+)/])

  const attitudes =
    firstMatchInt(n, [
      /"attitudes_count"\s*:\s*(\d+)/,
      /"attitude_count"\s*:\s*(\d+)/,
      /"like_count"\s*:\s*(\d+)/,
      /"likeCount"\s*:\s*(\d+)/,
      /"liked_count"\s*:\s*(\d+)/,
      /"like_num"\s*:\s*(\d+)/,
      /"attitudes_status"[^}]*"count"\s*:\s*(\d+)/,
      /赞(?:数)?[：:\s]*(?:<[^>]+>)?\s*([\d,]+)/i,
      /赞\s*[（(]\s*([\d,]+)\s*[)）]/,
      /"like_counts"\s*:\s*(\d+)/,
      /点赞(?:数)?[：:\s]*(?:<[^>]+>)?\s*([\d,]+)/i
    ]) ??
    maxMatchIntInHtml(n, [
      /"attitudes_count"\s*:\s*(\d+)/,
      /"like_count"\s*:\s*(\d+)/
    ])

  const out: WeiboTtarticleInsights = {}
  if (reads != null) out.reads_count = reads
  if (comments != null) out.comments_count = comments
  if (reposts != null) out.reposts_count = reposts
  if (attitudes != null) out.attitudes_count = attitudes
  return out
}

/** 同字段优先取 a（左侧），便于 merge(aj接口, 页面HTML) 时以接口为准 */
function mergeTtarticleInsights (
  a: WeiboTtarticleInsights,
  b: WeiboTtarticleInsights
): WeiboTtarticleInsights {
  return {
    reads_count: a.reads_count ?? b.reads_count,
    comments_count: a.comments_count ?? b.comments_count,
    reposts_count: a.reposts_count ?? b.reposts_count,
    attitudes_count: a.attitudes_count ?? b.attitudes_count
  }
}

function insightsFromArticleApiObject (o: Record<string, unknown>): WeiboTtarticleInsights {
  const nonneg = (v: unknown): number | undefined => {
    if (typeof v === 'number' && Number.isFinite(v)) {
      return Math.max(0, Math.floor(v))
    }
    if (typeof v === 'string') return parseIntLoose(v)
    return undefined
  }
  const pick = (keys: string[]): number | undefined => {
    for (const k of keys) {
      const n = nonneg(o[k])
      if (n != null) return n
    }
    return undefined
  }
  const out: WeiboTtarticleInsights = {}
  const reads = pick([
    'read_count',
    'reads_count',
    'readCount',
    'vv',
    'view_count'
  ])
  const comments = pick([
    'comment_count',
    'comments_count',
    'commentCount',
    'cmt_num',
    'cmt_count',
    'comment_num',
    'rootCommentCount',
    'root_comment_count'
  ])
  const reposts = pick([
    'repost_count',
    'reposts_count',
    'repostCount',
    'forward_count',
    'forward_num',
    'repost_num'
  ])
  const likes = pick([
    'attitudes_count',
    'attitude_count',
    'like_count',
    'likeCount',
    'liked_count',
    'like_num',
    'praise_count'
  ])
  if (reads != null) out.reads_count = reads
  if (comments != null) out.comments_count = comments
  if (reposts != null) out.reposts_count = reposts
  if (likes != null) out.attitudes_count = likes
  return out
}

/** 与发布流程 deepFindFeedMid 一致：从嵌套 JSON 里找时间线帖 mid（非头条 object_id） */
function deepFindFeedMidInObject (obj: unknown, depth = 0): string | undefined {
  if (depth > 14 || obj == null || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    for (const x of obj) {
      const m = deepFindFeedMidInObject(x, depth + 1)
      if (m) return m
    }
    return
  }
  const o = obj as Record<string, unknown>
  for (const k of [
    'mid',
    'mblogid',
    'mblog_id',
    'status_mid',
    'longBlogId',
    'longblog_id',
    'idstr'
  ]) {
    const v = o[k]
    if (v == null) continue
    const s = String(v).replace(/\D/g, '')
    if (s.length >= 10 && s.length <= 40) return s
  }
  for (const v of Object.values(o)) {
    const m = deepFindFeedMidInObject(v, depth + 1)
    if (m) return m
  }
  return undefined
}

function extractFeedMidFromPayload (
  payload: unknown,
  objectId: string
): string | undefined {
  const oid = String(objectId).replace(/\D/g, '')
  const mid = deepFindFeedMidInObject(payload)
  if (!mid || mid === oid) return undefined
  return mid
}

/**
 * 头条正文页内嵌「分享到时间线」对应微博的 mid，转评赞多在单帖接口里。
 */
function extractAssociatedStatusMid (
  html: string,
  objectId: string
): string | null {
  const oid = objectId.replace(/\D/g, '')
  const near = sliceHtmlNearObjectId(html, objectId)
  const candidates: string[] = []

  const push = (raw: string | undefined) => {
    const d = raw?.replace(/\D/g, '') ?? ''
    if (d.length >= 10 && d.length <= 40 && d !== oid) candidates.push(d)
  }

  for (const chunk of [near, html]) {
    let m: RegExpExecArray | null
    const r1 = /m\.weibo\.cn\/(?:status|detail)\/(\d{10,40})/gi
    while ((m = r1.exec(chunk)) !== null) push(m[1])
    const r2 = /weibo\.com\/detail\/(\d{10,40})/gi
    while ((m = r2.exec(chunk)) !== null) push(m[1])
  }

  const rMid =
    /"(?:mid|mblogid|mblog_id|status_mid)"\s*:\s*"?(\d{10,40})"?/gi
  let m: RegExpExecArray | null
  while ((m = rMid.exec(near)) !== null) push(m[1])

  if (candidates.length === 0) return null
  const score = (id: string) => {
    let s = 0
    if (id.length <= 20) s += 2
    if (near.includes(`status/${id}`)) s += 5
    return s
  }
  const uniq = [...new Set(candidates)]
  uniq.sort((a, b) => score(b) - score(a) || a.length - b.length)
  return uniq[0] ?? null
}

function feedMidFromHtmlScripts (html: string, objectId: string): string | null {
  if (!html.includes(objectId)) return null
  const oid = objectId.replace(/\D/g, '')
  const re = /<script[^>]*>([\s\S]*?)<\/script>/gi
  let block: RegExpExecArray | null
  while ((block = re.exec(html)) !== null) {
    const text = block[1]
    if (!text || text.length < 100 || text.length > 600_000) continue
    if (!text.includes(objectId)) continue
    const tryParse = (raw: string): string | null => {
      try {
        const j = JSON.parse(raw) as unknown
        const mid = deepFindFeedMidInObject(j)
        return mid && mid !== oid ? mid : null
      } catch {
        return null
      }
    }
    const fromStart = text.indexOf('{')
    if (fromStart >= 0) {
      const found = tryParse(text.slice(fromStart))
      if (found) return found
    }
    const whole = tryParse(text.trim())
    if (whole) return whole
  }
  return null
}

async function supplementTtarticleFromLinkedStatus (
  userId: string,
  html: string,
  objectId: string,
  base: WeiboTtarticleInsights
): Promise<WeiboTtarticleInsights> {
  const needIx =
    base.comments_count == null ||
    base.reposts_count == null ||
    base.attitudes_count == null
  if (!needIx) return base

  const oid = objectId.replace(/\D/g, '')
  let mid =
    extractAssociatedStatusMid(html, objectId) ?? feedMidFromHtmlScripts(html, oid)
  if (!mid) return base

  const sr = await fetchWeiboStatusInsightsWithSessionCookies(userId, mid)
  if (!sr.ok) return base

  return mergeTtarticleInsights(base, {
    reads_count: base.reads_count == null ? sr.data.reads_count : undefined,
    comments_count: sr.data.comments_count,
    reposts_count: sr.data.reposts_count,
    attitudes_count: sr.data.attitudes_count
  })
}

function textSuggestsWeiboLogin (text: string): boolean {
  return /登录|请先登录|passport\.weibo/i.test(text)
}

function nonnegInt (v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Math.max(0, Math.floor(v))
  }
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) {
    return Math.max(0, parseInt(v, 10))
  }
  return undefined
}

/** 创作者后台文章列表单项上的 object_id 数字（与 ?id= 一致） */
function ttarticleListItemObjectIdDigits (
  row: Record<string, unknown>
): string | null {
  const oidRaw = row.oid
  if (typeof oidRaw === 'string') {
    const m = oidRaw.match(/^1022:(\d{10,40})$/i)
    if (m?.[1]) return m[1]
    const n = normalizeWeiboArticleOidDigitsForLookup(oidRaw)
    if (/^\d{10,40}$/.test(n)) return n
  }
  const pclink = row.pclink
  if (typeof pclink === 'string') {
    const pm = pclink.match(/[?&]id=(\d{10,40})/i)
    if (pm?.[1]) return pm[1]
    const hash = pclink.match(/#\/article\/(\d{10,40})/i)
    if (hash?.[1]) return hash[1]
  }
  return null
}

/**
 * 微博创作者中心「文章列表」接口，countList 与 PC 后台一致。
 * @see https://me.weibo.com/api/article/artlist?page=1
 */
async function fetchTtarticleFromMeWeiboArtlist (
  userId: string,
  objectIdDigits: string
): Promise<{ insights: WeiboTtarticleInsights; mid?: string } | null> {
  const want = normalizeWeiboArticleOidDigitsForLookup(objectIdDigits)
  if (!/^\d{10,40}$/.test(want)) return null

  const cookies = readWeiboPlaywrightStorageCookies(userId)
  if (!cookies?.length) return null

  const maxPages = 40
  for (let page = 1; page <= maxPages; page++) {
    const url = `https://me.weibo.com/api/article/artlist?page=${page}`
    const cookieHeader = cookieHeaderForUrl(url, cookies)
    if (!cookieHeader) return null

    try {
      const res = await fetch(url, {
        headers: {
          Cookie: cookieHeader,
          Referer: 'https://me.weibo.com/',
          Accept: 'application/json, text/plain, */*',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': PC_UA
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(14_000)
      })
      const text = await res.text()
      if (!res.ok || !text.trim().startsWith('{')) continue

      let j: Record<string, unknown>
      try {
        j = JSON.parse(text) as Record<string, unknown>
      } catch {
        continue
      }
      if (j.ok !== 1 && j.ok !== '1') continue

      const data = j.data
      const list =
        data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).list)
          ? ((data as Record<string, unknown>).list as unknown[])
          : null
      if (!list?.length) break

      for (const raw of list) {
        if (!raw || typeof raw !== 'object') continue
        const row = raw as Record<string, unknown>
        const itemOid = ttarticleListItemObjectIdDigits(row)
        if (!itemOid || itemOid !== want) continue

        const countList = row.countList as Record<string, unknown> | undefined
        const insights: WeiboTtarticleInsights = {}
        if (countList && typeof countList === 'object') {
          const rp = nonnegInt(countList.reposts_count)
          const cm = nonnegInt(countList.comments_count)
          const at = nonnegInt(countList.attitudes_count)
          if (rp != null) insights.reposts_count = rp
          if (cm != null) insights.comments_count = cm
          if (at != null) insights.attitudes_count = at
        }

        const midRaw = row.mid
        let mid: string | undefined
        if (midRaw != null) {
          const d = String(midRaw).replace(/\D/g, '')
          if (/^\d{10,40}$/.test(d)) mid = d
        }

        return { insights, mid }
      }
    } catch {
      /* next page */
    }
  }
  return null
}

/** 创作者 artlist 的 countList 优先作为转评赞（含合法 0） */
function mergeTtarticlePreferMeArtlistCounts (
  base: WeiboTtarticleInsights,
  me: WeiboTtarticleInsights | null | undefined
): WeiboTtarticleInsights {
  if (!me) return base
  return {
    reads_count: base.reads_count ?? me.reads_count,
    comments_count:
      me.comments_count != null ? me.comments_count : base.comments_count,
    reposts_count:
      me.reposts_count != null ? me.reposts_count : base.reposts_count,
    attitudes_count:
      me.attitudes_count != null ? me.attitudes_count : base.attitudes_count
  }
}

/** PC 端 aj/content 接口（与头条展示页 XHR 一致）。 */
async function fetchTtarticleInsightsFromAj (
  userId: string,
  objectId: string
): Promise<{ insights: WeiboTtarticleInsights; mid?: string; rawHint?: string }> {
  const cookies = readWeiboPlaywrightStorageCookies(userId)
  if (!cookies?.length) return { insights: {} }
  const cookieHeader = cookieHeaderForUrl('https://weibo.com/', cookies)
  if (!cookieHeader) return { insights: {} }

  const ref = `https://weibo.com/ttarticle/p/show?id=${encodeURIComponent(objectId)}`
  const urls = [
    `https://weibo.com/aj/content/getarticle?object_id=${encodeURIComponent(objectId)}`,
    `https://weibo.com/aj/content/article?object_id=${encodeURIComponent(objectId)}`
  ]

  let acc: WeiboTtarticleInsights = {}
  let mid: string | undefined
  let rawHint: string | undefined

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          Cookie: cookieHeader,
          'User-Agent': PC_UA,
          Accept: 'application/json, text/plain, */*',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: ref
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000)
      })
      const text = await res.text()
      rawHint = text.slice(0, 240)
      if (!res.ok || !text.trim().startsWith('{')) continue
      let j: Record<string, unknown>
      try {
        j = JSON.parse(text) as Record<string, unknown>
      } catch {
        continue
      }
      mid = mid ?? extractFeedMidFromPayload(j, objectId)

      let extra = parseStatsFromTtarticleHtml(text, objectId)
      const dataField = j.data
      if (typeof dataField === 'string') {
        try {
          const inner = JSON.parse(dataField) as unknown
          mid = mid ?? extractFeedMidFromPayload(inner, objectId)
        } catch {
          /* ignore */
        }
        extra = mergeTtarticleInsights(
          extra,
          parseStatsFromTtarticleHtml(dataField, objectId)
        )
      } else if (dataField && typeof dataField === 'object') {
        const rec = dataField as Record<string, unknown>
        mid = mid ?? extractFeedMidFromPayload(rec, objectId)
        extra = mergeTtarticleInsights(
          extra,
          insightsFromArticleApiObject(rec)
        )
        extra = mergeTtarticleInsights(
          extra,
          parseStatsFromTtarticleHtml(JSON.stringify(dataField), objectId)
        )
      }
      acc = mergeTtarticleInsights(extra, acc)
    } catch {
      /* try next */
    }
  }
  return { insights: acc, mid, rawHint }
}

/** m.weibo.cn 文章 JSON（非正文 HTML） */
async function fetchTtarticleInsightsFromMobileArticle (
  userId: string,
  objectId: string
): Promise<{ insights: WeiboTtarticleInsights; mid?: string; rawHint?: string }> {
  const cookies = readWeiboPlaywrightStorageCookies(userId)
  if (!cookies?.length) return { insights: {} }
  const url = `https://m.weibo.cn/article/view?object_id=${encodeURIComponent(objectId)}`
  const cookieHeader = cookieHeaderForUrl(url, cookies)
  if (!cookieHeader) return { insights: {} }

  try {
    const res = await fetch(url, {
      headers: {
        Cookie: cookieHeader,
        Referer: 'https://m.weibo.cn/',
        Accept: 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': MOBILE_UA
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000)
    })
    const text = await res.text()
    if (!res.ok || !text.trim().startsWith('{')) {
      return { insights: {}, rawHint: text.slice(0, 240) }
    }
    let j: Record<string, unknown>
    try {
      j = JSON.parse(text) as Record<string, unknown>
    } catch {
      return { insights: {}, rawHint: text.slice(0, 240) }
    }
    let mid = extractFeedMidFromPayload(j, objectId)
    const d = j.data
    let extra: WeiboTtarticleInsights = {}
    if (d && typeof d === 'object') {
      const rec = d as Record<string, unknown>
      mid = mid ?? extractFeedMidFromPayload(rec, objectId)
      extra = insightsFromArticleApiObject(rec)
      extra = mergeTtarticleInsights(
        extra,
        parseStatsFromTtarticleHtml(JSON.stringify(rec), objectId)
      )
    }
    extra = mergeTtarticleInsights(extra, parseStatsFromTtarticleHtml(text, objectId))
    return { insights: extra, mid, rawHint: text.slice(0, 240) }
  } catch {
    return { insights: {} }
  }
}

async function supplementTtarticleFromLinkedStatusMid (
  userId: string,
  objectId: string,
  mid: string | undefined,
  base: WeiboTtarticleInsights
): Promise<WeiboTtarticleInsights> {
  if (!mid?.trim()) return base
  const needIx =
    base.reads_count == null ||
    base.comments_count == null ||
    base.reposts_count == null ||
    base.attitudes_count == null
  if (!needIx) return base

  const sr = await fetchWeiboStatusInsightsWithSessionCookies(userId, mid)
  if (!sr.ok) return base

  return mergeTtarticleInsights(base, {
    reads_count: sr.data.reads_count,
    comments_count: sr.data.comments_count,
    reposts_count: sr.data.reposts_count,
    attitudes_count: sr.data.attitudes_count
  })
}

/**
 * 从头条展示页 URL 解析 object_id（长数字，如 2309405289405782032577）。
 */
export function extractTtarticleObjectIdFromUrl (
  raw: string | null | undefined
): string | null {
  if (!raw?.trim()) return null
  const t = raw.trim()
  const m =
    t.match(
      /(?:www\.)?(?:weibo\.com|weibo\.cn)\/ttarticle\/p\/show\?[^#]*\bid=(\d+)/i
    ) || t.match(/ttarticle\/p\/show\?[^#]*\bid=(\d+)/i)
  if (!m?.[1]) return null
  const id = m[1]
  return id.length >= 10 ? id : null
}

/** 头条正文展示页（发布记录里应展示此链接，而非 weibo.com/{uid}/{mid}） */
export function weiboTtarticleShowUrl (objectId: string): string {
  const digits = String(objectId).replace(/\D/g, '')
  if (digits.length >= 10) {
    return `https://weibo.com/ttarticle/p/show?id=${digits}`
  }
  return `https://weibo.com/ttarticle/p/show?id=${encodeURIComponent(objectId)}`
}

export async function fetchWeiboTtarticleInsightsWithSessionCookies (
  userId: string,
  objectId: string
): Promise<
  | { ok: true; data: WeiboTtarticleInsights }
  | { ok: false; error: string }
> {
  const id = String(objectId).replace(/\D/g, '')
  if (!/^\d{10,40}$/.test(id)) {
    return { ok: false, error: '头条文章 object id 无效（应为 10～40 位数字）' }
  }

  const cookies = readWeiboPlaywrightStorageCookies(userId)
  if (!cookies?.length) {
    return { ok: false, error: '无会话 Cookie' }
  }
  const cookieHeader = cookieHeaderForUrl('https://weibo.com/', cookies)
  if (!cookieHeader) {
    return { ok: false, error: '无法为 weibo.com 拼 Cookie' }
  }

  const pageUrl = `https://weibo.com/ttarticle/p/show?id=${encodeURIComponent(id)}`
  try {
    const artlistP = fetchTtarticleFromMeWeiboArtlist(userId, id)

    const res = await fetch(pageUrl, {
      headers: {
        Cookie: cookieHeader,
        'User-Agent': PC_UA,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Referer: 'https://weibo.com/',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      },
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000)
    })
    const html = await res.text()
    const meArt = await artlistP

    /** 正文页可读时从 HTML 抠阅读等；无权限时仍可能仅靠创作者 artlist 拿到转评赞 */
    let data: WeiboTtarticleInsights = {}
    if (res.ok) {
      data = parseStatsFromTtarticleHtml(html, id)
    }

    const aj = await fetchTtarticleInsightsFromAj(userId, id)
    const mob = await fetchTtarticleInsightsFromMobileArticle(userId, id)
    data = mergeTtarticleInsights(
      data,
      mergeTtarticleInsights(aj.insights, mob.insights)
    )
    data = mergeTtarticlePreferMeArtlistCounts(data, meArt?.insights)

    const midFromApi = meArt?.mid ?? aj.mid ?? mob.mid
    if (res.ok) {
      data = await supplementTtarticleFromLinkedStatus(userId, html, id, data)
    }
    data = await supplementTtarticleFromLinkedStatusMid(
      userId,
      id,
      midFromApi,
      data
    )

    const hasAny =
      data.reads_count != null ||
      data.comments_count != null ||
      data.reposts_count != null ||
      data.attitudes_count != null

    if (!hasAny) {
      if (res.ok && /登录|passport\.weibo/i.test(html)) {
        return {
          ok: false,
          error: '头条页需登录，请重新绑定微博浏览器会话'
        }
      }
      if (!res.ok && /登录|passport\.weibo/i.test(html)) {
        return {
          ok: false,
          error: `头条页 HTTP ${res.status}，且未从 me.weibo 文章列表匹配到数据；请登录并确认曾打开过 me.weibo.com`
        }
      }
      const hint = aj.rawHint ?? mob.rawHint ?? ''
      if (textSuggestsWeiboLogin(hint)) {
        return {
          ok: false,
          error: '微博接口提示需登录，请重新绑定浏览器会话'
        }
      }
      return {
        ok: false,
        error:
          '未能解析到阅读/互动数据。请确认会话含 me.weibo.com，或头条页可访问'
      }
    }

    return { ok: true, data }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e)
    }
  }
}
