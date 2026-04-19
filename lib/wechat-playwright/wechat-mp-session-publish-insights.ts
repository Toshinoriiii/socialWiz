/**
 * 使用公众平台「发表记录」网页接口（Playwright 落盘 Cookie + token）解析单篇阅读/赞/分享等，
 * 与开发者 datacube 无关；字段随 MP 改版可能需重抓包。
 */
import {
  fetchMpAppmsgpublishListJsonForUser,
  resolveWechatMpTokenAndCookie
} from '@/lib/wechat-playwright/wechat-mp-web-publish'

const MP_ORIGIN = 'https://mp.weixin.qq.com'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export interface WechatMpSessionInsightTotals {
  views: number
  comments: number
  likes: number
  shares: number
  collections?: number
}

const READ_KEYS = [
  'read_num',
  'readNum',
  'read_count',
  'total_read_num',
  'int_page_read_count',
  /** 单篇统计页 / datacube 风格 */
  'read_user',
  'int_page_read_user'
] as const
const LIKE_KEYS = [
  'like_num',
  'likeNum',
  'old_like_num',
  'attitudes_count',
  'praise_num'
] as const
const SHARE_KEYS = [
  'share_num',
  'shareNum',
  'share_count',
  'forward_num',
  'repost_num',
  'share_user'
] as const
const CMT_KEYS = [
  'comment_num',
  'commentNum',
  'e2e_comment_count',
  'comments_count',
  'comment_count'
] as const
const COLLECT_KEYS = [
  'collection_num',
  'collectionNum',
  'collection_user',
  'collect_count',
  'fav_num',
  'favorite_num'
] as const

function coerceInt (v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Math.max(0, Math.floor(v))
  }
  if (typeof v === 'string') {
    const s = v.trim().replace(/[，,]/g, '')
    if (/^\d+$/.test(s)) return Math.max(0, parseInt(s, 10))
  }
  return undefined
}

function pickInt (o: unknown, keys: readonly string[]): number | undefined {
  if (!o || typeof o !== 'object') return undefined
  const r = o as Record<string, unknown>
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(r, k)) {
      const n = coerceInt(r[k])
      if (n != null) return n
    }
  }
  return undefined
}

/** 后台单篇统计常见：拇指赞 + 爱心赞分开字段，需相加 */
function pickLikesFromObject (o: unknown): number | undefined {
  const direct = pickInt(o, LIKE_KEYS)
  if (direct != null) return direct
  if (!o || typeof o !== 'object') return undefined
  const r = o as Record<string, unknown>
  const z = coerceInt(r.zaikan_user)
  const lu = coerceInt(r.like_user)
  if (z != null || lu != null) return (z ?? 0) + (lu ?? 0)
  return undefined
}

function normTitle (t: string): string {
  return t.trim().replace(/\s+/g, ' ')
}

/** 与正文链接匹配：/s/xxx 或 query sn= */
export function wechatMpArticleSnKey (url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  const u = url.trim()
  const m1 = u.match(/\/s\/([A-Za-z0-9_-]+)/i)
  if (m1?.[1]) return m1[1].toLowerCase()
  const m2 = u.match(/[?&#]sn=([A-Za-z0-9_-]+)/i)
  if (m2?.[1]) return m2[1].toLowerCase()
  return null
}

type FlatRow = {
  linkSn: string | null
  titleNorm: string | null
  views: number
  likes: number
  shares: number
  comments: number
  collections: number
}

/** 自左向右：先出现的对象优先（最细粒度放最前） */
function mergeStatObjects (...parts: unknown[]): {
  views: number
  likes: number
  shares: number
  comments: number
  collections: number
} {
  let views: number | undefined
  let likes: number | undefined
  let shares: number | undefined
  let comments: number | undefined
  let collections: number | undefined
  for (const o of parts) {
    if (views == null) {
      const v = pickInt(o, READ_KEYS)
      if (v != null) views = v
    }
    if (likes == null) {
      const v = pickLikesFromObject(o)
      if (v != null) likes = v
    }
    if (shares == null) {
      const v = pickInt(o, SHARE_KEYS)
      if (v != null) shares = v
    }
    if (comments == null) {
      const v = pickInt(o, CMT_KEYS)
      if (v != null) comments = v
    }
    if (collections == null) {
      const v = pickInt(o, COLLECT_KEYS)
      if (v != null) collections = v
    }
  }
  return {
    views: views ?? 0,
    likes: likes ?? 0,
    shares: shares ?? 0,
    comments: comments ?? 0,
    collections: collections ?? 0
  }
}

function flattenPublishPageRows (j: Record<string, unknown>): FlatRow[] {
  const raw = j.publish_page
  if (typeof raw !== 'string' || raw.length < 20) return []
  let page: Record<string, unknown>
  try {
    page = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return []
  }
  const list = page.publish_list
  if (!Array.isArray(list)) return []
  const out: FlatRow[] = []

  for (const it of list) {
    if (!it || typeof it !== 'object') continue
    const item = it as Record<string, unknown>

    const pInfoStr = item.publish_info
    if (typeof pInfoStr !== 'string') continue
    let inner: Record<string, unknown>
    try {
      inner = JSON.parse(pInfoStr) as Record<string, unknown>
    } catch {
      continue
    }
    const pubInner = inner.publish_info
    const pubRec =
      pubInner && typeof pubInner === 'object'
        ? (pubInner as Record<string, unknown>)
        : null

    const ex = inner.appmsgex
    if (Array.isArray(ex)) {
      for (const row of ex) {
        if (!row || typeof row !== 'object') continue
        const r = row as Record<string, unknown>
        const link = typeof r.link === 'string' ? r.link.trim() : ''
        const title = typeof r.title === 'string' ? r.title.trim() : ''
        const rowStats = mergeStatObjects(r, inner, pubRec, item)
        out.push({
          linkSn: wechatMpArticleSnKey(link || null),
          titleNorm: title ? normTitle(title) : null,
          views: rowStats.views,
          likes: rowStats.likes,
          shares: rowStats.shares,
          comments: rowStats.comments,
          collections: rowStats.collections
        })
      }
    } else {
      const linkRaw =
        (typeof inner.link === 'string' && inner.link) ||
        (typeof item.link === 'string' && item.link) ||
        ''
      const titleRaw =
        (typeof inner.title === 'string' && inner.title) ||
        (typeof item.title === 'string' && item.title) ||
        ''
      const rowStats = mergeStatObjects(inner, pubRec, item)
      out.push({
        linkSn: wechatMpArticleSnKey(linkRaw || null),
        titleNorm: titleRaw ? normTitle(titleRaw) : null,
        views: rowStats.views,
        likes: rowStats.likes,
        shares: rowStats.shares,
        comments: rowStats.comments,
        collections: rowStats.collections
      })
    }
  }
  return out
}

function ymdShanghai (d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d)
}

/** 按顺序取第一个匹配到的数字（含合法 0）；无匹配返回 undefined，避免用 0 盖住 JSON 里的真实值 */
function firstCapturedIntOptional (
  html: string,
  patterns: RegExp[]
): number | undefined {
  for (const re of patterns) {
    const m = html.match(re)
    if (m) {
      const n = parseInt(m[1].replace(/,/g, ''), 10)
      if (Number.isFinite(n)) return Math.max(0, n)
    }
  }
  return undefined
}

/**
 * misc/appmsganalysis?action=detailpage 单篇统计 HTML 内嵌 JSON（与后台「内容分析」单篇页一致）。
 */
function parseAppmsgAnalysisDetailHtml (
  html: string
): WechatMpSessionInsightTotals | null {
  if (
    /请重新登录|环境异常|完成验证|当前环境异常|去验证/.test(html)
  ) {
    return null
  }
  if (html.length < 800) return null

  const chunks: unknown[] = []
  const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi
  let sm: RegExpExecArray | null
  while ((sm = scriptRe.exec(html)) !== null) {
    const text = sm[1]
    if (text.length < 40) continue
    const tryParse = (raw: string) => {
      try {
        chunks.push(JSON.parse(raw))
      } catch {
        /* ignore */
      }
    }
    tryParse(text.trim())
    const i = text.indexOf('{')
    if (i >= 0) tryParse(text.slice(i))
  }

  let bestScore = -1
  let best: {
    views: number
    likes: number
    shares: number
    comments: number
    collections: number
  } | null = null
  for (const c of chunks) {
    const m = mergeStatObjects(c)
    const score = m.views + m.likes + m.shares + m.comments + m.collections
    if (score > bestScore) {
      bestScore = score
      best = m
    }
  }

  const rxViews = firstCapturedIntOptional(html, [
    /"read_num"\s*:\s*(\d+)/,
    /"int_page_read_count"\s*:\s*(\d+)/,
    /"read_user"\s*:\s*(\d+)/,
    /"total_read_num"\s*:\s*(\d+)/
  ])

  let rxLikes: number | undefined
  if (/"like_num"\s*:/.test(html)) {
    rxLikes = firstCapturedIntOptional(html, [/\"like_num\"\s*:\s*(\d+)/])
  } else {
    const z = firstCapturedIntOptional(html, [/\"zaikan_user\"\s*:\s*(\d+)/])
    const lu = firstCapturedIntOptional(html, [/\"like_user\"\s*:\s*(\d+)/])
    const ol = firstCapturedIntOptional(html, [/\"old_like_num\"\s*:\s*(\d+)/])
    if (z != null || lu != null || ol != null) {
      rxLikes = (z ?? 0) + (lu ?? 0) + (ol ?? 0)
    }
  }

  const rxShares = firstCapturedIntOptional(html, [
    /"share_num"\s*:\s*(\d+)/,
    /"share_user"\s*:\s*(\d+)/,
    /"share_count"\s*:\s*(\d+)/
  ])

  const rxComments = firstCapturedIntOptional(html, [
    /"comment_num"\s*:\s*(\d+)/,
    /"comment_count"\s*:\s*(\d+)/,
    /"e2e_comment_count"\s*:\s*(\d+)/
  ])

  const rxColl = firstCapturedIntOptional(html, [
    /"collection_user"\s*:\s*(\d+)/,
    /"collection_num"\s*:\s*(\d+)/
  ])

  const overlay: Record<string, unknown> = {}
  if (rxViews != null) overlay.read_num = rxViews
  if (rxLikes != null) overlay.like_num = rxLikes
  if (rxShares != null) overlay.share_num = rxShares
  if (rxComments != null) overlay.comment_num = rxComments
  if (rxColl != null) overlay.collection_user = rxColl

  const merged = mergeStatObjects(overlay, best ?? {})

  const hasSignal =
    /read_num|read_user|int_page_read|like_num|zaikan_user|share_num|share_user|appmsganalysis|detailpage/i.test(
      html
    )
  if (!hasSignal) return null

  if (
    merged.views +
      merged.likes +
      merged.shares +
      merged.comments +
      merged.collections ===
    0
  ) {
    return null
  }

  return {
    views: merged.views,
    likes: merged.likes,
    shares: merged.shares,
    comments: merged.comments,
    collections: merged.collections > 0 ? merged.collections : undefined
  }
}

async function fetchAppmsgAnalysisDetailTotals (
  userId: string,
  msgid: string,
  publishDateYmd: string
): Promise<WechatMpSessionInsightTotals | null> {
  const tc = await resolveWechatMpTokenAndCookie(userId)
  if (!tc) return null

  const url = new URL(`${MP_ORIGIN}/misc/appmsganalysis`)
  url.searchParams.set('action', 'detailpage')
  url.searchParams.set('msgid', msgid.trim())
  url.searchParams.set('publish_date', publishDateYmd)
  url.searchParams.set('type', 'int')
  url.searchParams.set('pageVersion', '1')
  url.searchParams.set('token', tc.token)
  url.searchParams.set('lang', 'zh_CN')

  try {
    const r = await fetch(url.toString(), {
      headers: {
        Cookie: tc.cookieHeader,
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Referer: `${MP_ORIGIN}/cgi-bin/home?t=home/index&token=${encodeURIComponent(
          tc.token
        )}&lang=zh_CN`
      },
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(22_000)
    })
    const html = await r.text()
    return parseAppmsgAnalysisDetailHtml(html)
  } catch {
    return null
  }
}

function totalCountHint (j: Record<string, unknown>): number {
  const raw = j.publish_page
  if (typeof raw !== 'string') return 0
  try {
    const page = JSON.parse(raw) as Record<string, unknown>
    const t = page.total_count ?? page.publish_total_count ?? page.totalCount
    if (typeof t === 'number' && Number.isFinite(t)) return Math.max(0, t)
  } catch {
    /* ignore */
  }
  return 0
}

export async function fetchWechatMpArticleInsightViaSession (
  userId: string,
  options: {
    publishedUrl: string | null | undefined
    title: string
    /** 与后台单篇统计 URL 中 msgid= 一致，如 2247483850_1 */
    datacubeMsgid?: string | null
    /** 用于 publish_date=（北京时间发表日） */
    publishedAt?: Date | null
  }
): Promise<
  | { ok: true; data: WechatMpSessionInsightTotals }
  | { ok: false; error: string }
> {
  const msgid = options.datacubeMsgid?.trim()
  const publishedAt = options.publishedAt
  if (msgid && publishedAt) {
    const offsets = [0, -1, 1, -2, 2]
    const triedYmd = new Set<string>()
    for (const delta of offsets) {
      const t = new Date(publishedAt.getTime() + delta * 86400000)
      const ymd = ymdShanghai(t)
      if (triedYmd.has(ymd)) continue
      triedYmd.add(ymd)
      const detail = await fetchAppmsgAnalysisDetailTotals(userId, msgid, ymd)
      if (detail) {
        return { ok: true, data: detail }
      }
    }
  }

  const wantSn = wechatMpArticleSnKey(options.publishedUrl)
  const wantTitle = normTitle(options.title)
  if (!wantSn && !wantTitle) {
    return {
      ok: false,
      error:
        '缺少正文链接与标题，且未写入 wechatDatacubeMsgid 时无法拉取单篇统计或发表记录'
    }
  }

  const pageSize = 10
  const maxPages = 30
  let totalHint = 0

  for (let page = 0; page < maxPages; page++) {
    const begin = page * pageSize
    const j = await fetchMpAppmsgpublishListJsonForUser(userId, {
      begin,
      count: pageSize
    })
    if (!j) {
      return {
        ok: false,
        error:
          page === 0
            ? '无法拉取发表记录（请确认已绑定微信公众平台浏览器会话且未登出）'
            : '发表记录分页请求失败'
      }
    }
    if (page === 0) {
      totalHint = totalCountHint(j)
    }

    const rows = flattenPublishPageRows(j)
    for (const r of rows) {
      const snMatch = wantSn && r.linkSn && r.linkSn === wantSn
      const titleMatch =
        wantTitle.length > 0 &&
        r.titleNorm != null &&
        r.titleNorm === wantTitle
      if (snMatch || titleMatch) {
        return {
          ok: true,
          data: {
            views: r.views,
            comments: r.comments,
            likes: r.likes,
            shares: r.shares,
            collections: r.collections
          }
        }
      }
    }

    if (totalHint > 0 && begin + pageSize >= totalHint) break
    if (rows.length < pageSize) break
  }

  return {
    ok: false,
    error:
      '在已拉取的发表记录中未匹配到该篇（可核对正文链接是否与后台一致，或文章较旧需翻页更多）'
  }
}
