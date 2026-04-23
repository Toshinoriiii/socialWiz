/**
 * 使用公众平台**运营后台**（`appmsgpublish` 的 `publish_page` → `publish_list` → `appmsg_info[]`）拉取
 * 单篇 read/like/comment/share 等，Playwright 落盘 Cookie + token 复现。不请求开放平台、不拉取 `mp.weixin.qq.com/s/...` 正文页。
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
  'view_count',
  'viewCount',
  'total_read_num',
  'int_page_read_count',
  /** 新版发表列表/数据卡片 */
  'pv',
  'read_pv',
  'browse_count',
  'read_user',
  'int_page_read_user',
  /** 部分后台列为 UV / 新字段名 */
  'read_uv',
  'real_read_num',
  'page_read_num'
] as const
const LIKE_KEYS = [
  'like_num',
  'likeNum',
  'old_like_num',
  /** 发表记录 appmsg_info 中可能与 like_num 并存 */
  'moment_like_num',
  'attitudes_count',
  'praise_num'
] as const
const SHARE_KEYS = [
  'share_num',
  'shareNum',
  'share_count',
  'shareCount',
  'forward_num',
  'forward_count',
  'forwardCount',
  'repost_num',
  'share_user',
  'transmit_count'
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
  const lower: Record<string, string> = {}
  for (const k of Object.keys(r)) {
    lower[k.toLowerCase()] = k
  }
  for (const k of keys) {
    const orig = lower[k.toLowerCase()]
    if (orig != null) {
      const n = coerceInt(r[orig])
      if (n != null) return n
    }
  }
  return undefined
}

/**
 * 接口改版后 key 不固定、或嵌在深层，按「键名」+ 数字做启发式（仅当明文字段全空时用）。
 */
function deepPluckStatsFromObjects (parts: unknown[]): {
  views: number
  likes: number
  comments: number
  shares: number
  collections: number
} {
  const out = {
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    collections: 0
  }
  const seen = new WeakSet<object>()

  function considerNumber (key: string, nRaw: number): void {
    const n = Math.min(Math.max(0, Math.floor(nRaw)), 1_000_000_000)
    if (n <= 0) return
    const k = key.toLowerCase()
    if (
      /read|view|vv|int_page|intpage|total_read|read_num|readcount|read_count|view_count|viewcount|browse|pv|read_user|int_page_read|浏览/.test(
        k
      ) &&
      !/thread|already|breadcrumbs/.test(k)
    ) {
      if (n > out.views) out.views = n
    } else if (/(^|_)(share|forward|repost|transmit|转发)/.test(k) || k.includes('share_num')) {
      if (n > out.shares) out.shares = n
    } else if (/comment|reply|e2e_/.test(k) && /comment|reply|count/.test(k)) {
      if (n > out.comments) out.comments = n
    } else if (
      /(like|praise|zan|zan|zan|attitude|拇指|喜欢)/.test(k) &&
      !/dislike|unlike/.test(k)
    ) {
      if (n > out.likes) out.likes = n
    } else if (/(collect|fav|favor|收藏|star)/.test(k) && /count|user|num/.test(k)) {
      if (n > out.collections) out.collections = n
    }
  }

  function visit (node: unknown, key: string): void {
    if (node == null) return
    if (typeof node === 'number' && Number.isFinite(node)) {
      considerNumber(key, node)
      return
    }
    if (typeof node === 'string') {
      const c = coerceInt(node)
      if (c != null) considerNumber(key, c)
      return
    }
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        visit(node[i], `${key}[${i}]`)
      }
      return
    }
    if (typeof node === 'object') {
      if (seen.has(node as object)) return
      seen.add(node as object)
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        visit(v, k)
      }
    }
  }

  for (const p of parts) {
    visit(p, 'root')
  }
  return out
}

function enhanceRowStatsWithDeepPluck (
  rowStats: ReturnType<typeof mergeStatObjects>,
  chain: unknown[]
): ReturnType<typeof mergeStatObjects> {
  const sum =
    rowStats.views +
    rowStats.likes +
    rowStats.shares +
    rowStats.comments +
    rowStats.collections
  if (sum > 0) return rowStats
  const d = deepPluckStatsFromObjects(chain)
  return {
    views: Math.max(rowStats.views, d.views),
    likes: Math.max(rowStats.likes, d.likes),
    comments: Math.max(rowStats.comments, d.comments),
    shares: Math.max(rowStats.shares, d.shares),
    collections: Math.max(rowStats.collections, d.collections)
  }
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
  return t
    .replace(/[\u200b\ufeff\u00a0]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
}

type FlatRow = {
  linkSn: string | null
  titleNorm: string | null
  /** 与 `appmsg_info` 行及外层 inner 的 appmsgid / copy_appmsg_id / draft_msgid 等对齐，对应 ContentPlatform.platformContentId */
  wechatIdKeys: string[]
  views: number
  likes: number
  shares: number
  comments: number
  collections: number
}

const WECHAT_ID_FIELD_KEYS = [
  'appmsgid',
  'appmsg_id',
  'msgid',
  'copy_appmsg_id',
  'copyAppmsgId',
  'draft_msgid',
  'new_copy_msg_id'
] as const

/**
 * 库里的 `platformContentId` 或任务 `platformPostId` 可能为 `appmsgid`、正式 msgid 或 `copy_appmsg_id` 草稿 id；与发表记录多字段对任意一项即算命中。
 */
export function normalizeWechatPlatformContentIdForListMatch (
  raw: string | null | undefined
): string | null {
  if (raw == null) return null
  const t = String(raw).trim()
  if (t.length === 0) return null
  if (/^\d{5,20}$/.test(t)) return t
  const m = t.match(/\b(\d{5,20})\b/)
  return m ? m[1] : null
}

function addWechatIdKey (into: Set<string>, v: unknown): void {
  if (v == null) return
  const s = String(v).trim()
  if (!/^\d{5,20}$/.test(s)) return
  into.add(s)
}

function collectWechatIdKeysFromObject (o: Record<string, unknown> | null, into: Set<string>): void {
  if (!o) return
  for (const k of WECHAT_ID_FIELD_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(o, k)) continue
    addWechatIdKey(into, o[k])
  }
}

function collectWechatIdKeysForBundle (
  appmsgRow: Record<string, unknown> | null,
  inner: Record<string, unknown>,
  pubRec: Record<string, unknown> | null,
  item: Record<string, unknown>
): string[] {
  const into = new Set<string>()
  if (appmsgRow) collectWechatIdKeysFromObject(appmsgRow, into)
  collectWechatIdKeysFromObject(inner, into)
  collectWechatIdKeysFromObject(pubRec, into)
  collectWechatIdKeysFromObject(item, into)
  return [...into]
}

/**
 * 发表记录列表**按时间/状态排序**，旧实现「首个模糊命中即返回」会误配：
 * 例如 wantTitle 包含短标题 "4.23" 或 "Test" 时先命中 0 阅读的旧文。
 * 需限制「短串 ⊂ 长串」的包含比例，并与 {@link matchPublishListRow} 的优先级/总分配合。
 */
function titleFuzzySafe (wantTitle: string, rowTitle: string | null): boolean {
  if (!rowTitle || wantTitle.length < 2) return false
  if (rowTitle === wantTitle) return false
  if (rowTitle.includes(wantTitle) || wantTitle.includes(rowTitle)) {
    const a = rowTitle.length
    const b = wantTitle.length
    const short = Math.min(a, b)
    const long = Math.max(a, b)
    if (short < 4) return false
    if (long > 0 && short / long < 0.45) return false
    return true
  }
  return false
}

function rowEngagementTotal (r: FlatRow): number {
  return (
    r.views +
    r.shares +
    r.likes +
    r.comments +
    (r.collections ?? 0)
  )
}

/**
 * 匹配优先级：平台侧 contentId / sn（同档）> 标题全等 > 严格模糊；同优先级取互动分更高，避免首条误配全 0。
 */
function matchPublishListRow (
  r: FlatRow,
  wantSn: string | null,
  wantWechatId: string | null,
  wantTitle: string
): 0 | 1 | 2 | 3 {
  if (wantWechatId && r.wechatIdKeys.includes(wantWechatId)) return 3
  const snMatch = Boolean(
    wantSn && r.linkSn && r.linkSn === wantSn
  )
  const titleExact = Boolean(
    wantTitle.length > 0 &&
      r.titleNorm != null &&
      r.titleNorm === wantTitle
  )
  if (snMatch) return 3
  if (titleExact) return 2
  if (titleFuzzySafe(wantTitle, r.titleNorm)) return 1
  return 0
}

/**
 * 从已发布图文链取 **sn**（`/s/xxx`），仅用于和「发表记录」JSON 里 `appmsg_info[].content_url` 对齐；
 * 本库**不会**对该 URL 发起页面请求拉数。
 */
export function wechatMpArticleSnKey (url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  let u = url.trim()
  if (/^http:\/\/mp\.weixin\.qq\.com/i.test(u)) {
    u = `https://${u.slice(7)}`
  }
  const m1 = u.match(/\/s\/([A-Za-z0-9_-]+)/i)
  if (m1?.[1]) return m1[1].toLowerCase()
  const m2 = u.match(/[?&#]sn=([A-Za-z0-9_-]+)/i)
  if (m2?.[1]) return m2[1].toLowerCase()
  return null
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

/** 新版可能把 `stat` / `ext` 叠在单条上；全部参与挑字段 */
function statMergeChain (...os: unknown[]): unknown[] {
  const out: unknown[] = []
  for (const o of os) {
    if (o == null) continue
    out.push(o)
    if (typeof o === 'object' && !Array.isArray(o)) {
      const r = o as Record<string, unknown>
      for (const k of [
        'stat',
        'stats',
        'data_stat',
        'read_stat',
        'ext',
        'count_info'
      ]) {
        const v = r[k]
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          out.push(v)
        }
      }
    }
  }
  return out
}

/**
 * 全页 HTML 内嵌的 `publish_info` 里常见 `&quot;` 等实体，不替换则 `JSON.parse` 会失败，整表被跳过，接口仍「成功」但全 0。
 */
function decodeWeChatEscapedJsonString (s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
}

function tryJsonParseWeChat (raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    try {
      return JSON.parse(decodeWeChatEscapedJsonString(raw)) as Record<
        string,
        unknown
      >
    } catch {
      return null
    }
  }
}

/**
 * 发表列表里 `publish_info` 为 JSON 串或对象。解析后单条图文统计多在 **`appmsg_info[]`**
 *（`read_num` / `like_num` / `comment_num` / `share_num` / `content_url` / `title`），`appmsgex` 常为空。
 */
function parsePublishInfoToInner (item: Record<string, unknown>): Record<
  string,
  unknown
> | null {
  const pi = item.publish_info
  if (pi == null) {
    if (
      item.appmsgex != null ||
      item.appmsg_info != null ||
      item.appMsg_info != null ||
      item.title
    ) {
      return item
    }
    return null
  }
  if (typeof pi === 'string') {
    const parsed = tryJsonParseWeChat(pi)
    if (parsed) return parsed
    // 内层被截断/转义异常时，发表项 root 上仍可能带 appmsg 数组（与 publish_info 串并列）
    if (
      item.appmsgex != null ||
      item.appmsg_info != null ||
      item.appMsg_info != null
    ) {
      return item
    }
    return null
  }
  if (typeof pi === 'object' && !Array.isArray(pi)) {
    return pi as Record<string, unknown>
  }
  return null
}

/**
 * 发表记录接口里 `appmsg_info` / `appmsgex` 单行上就有 read_num 等，直接取数最稳，避免各种 merge 判成 0。
 */
function statsFromAppmsgListRow (r: Record<string, unknown>): {
  views: number
  likes: number
  shares: number
  comments: number
  collections: number
} {
  return {
    views: coerceInt(r.read_num) ?? pickInt(r, READ_KEYS) ?? 0,
    likes: pickLikesFromObject(r) ?? 0,
    shares: pickInt(r, SHARE_KEYS) ?? 0,
    comments: pickInt(r, CMT_KEYS) ?? 0,
    collections: pickInt(r, COLLECT_KEYS) ?? 0
  }
}

function parsePublishPageRoot (raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  if (typeof raw === 'string' && raw.length > 20) {
    return tryJsonParseWeChat(raw)
  }
  return null
}

const APPMSG_ROW_ARRAY_KEYS = [
  'appmsgex',
  'appmsg_info',
  'appMsg_info',
  'appmsgInfo'
] as const

function firstNonEmptyAppmsgArray (
  o: Record<string, unknown> | null | undefined
): unknown[] | null {
  if (!o) return null
  for (const k of APPMSG_ROW_ARRAY_KEYS) {
    const a = o[k] as unknown
    if (Array.isArray(a) && a.length > 0) return a
  }
  return null
}

/**
 * 接口改版时 appmsg 行数组可能在 `inner` 根上、在嵌套 `inner.publish_info` 对象里，或与 `publish_info` 串同级挂在 list item 上。
 */
function collectAppmsgRowsForListItem (
  inner: Record<string, unknown>,
  item: Record<string, unknown>,
  pubRec: Record<string, unknown> | null
): unknown[] {
  for (const bucket of [inner, pubRec, item]) {
    const ex = firstNonEmptyAppmsgArray(bucket)
    if (ex) return ex
  }
  return []
}

function flattenPublishPageRows (j: Record<string, unknown>): FlatRow[] {
  const page = parsePublishPageRoot(j.publish_page)
  if (!page) return []
  const list = page.publish_list
  if (!Array.isArray(list)) return []
  const out: FlatRow[] = []

  for (const it of list) {
    if (!it || typeof it !== 'object') continue
    const item = it as Record<string, unknown>
    const inner = parsePublishInfoToInner(item)
    if (!inner) continue
    const pubInner = inner.publish_info
    const pubRec =
      pubInner && typeof pubInner === 'object'
        ? (pubInner as Record<string, unknown>)
        : null

    /**
     * 新版「发表记录」多为 `appmsg_info` 带 read_num/share_num，而 `appmsgex` 为空 [];
     * 旧版走 `appmsgex`；部分响应把数组挂在内层 `publish_info` 或 `item` 上。
     */
    const ex = collectAppmsgRowsForListItem(inner, item, pubRec)

    if (ex.length > 0) {
      for (const row of ex) {
        if (!row || typeof row !== 'object') continue
        const r = row as Record<string, unknown>
        const link =
          (typeof r.link === 'string' && r.link.trim()) ||
          (typeof r.content_url === 'string' && r.content_url.trim()) ||
          ''
        const title = typeof r.title === 'string' ? r.title.trim() : ''
        let rowStats = statsFromAppmsgListRow(r)
        const sumDirect =
          rowStats.views +
          rowStats.likes +
          rowStats.shares +
          rowStats.comments +
          rowStats.collections
        if (sumDirect === 0) {
          const fromRow = statMergeChain(r)
          const forDeep = statMergeChain(r, inner, pubRec, item)
          rowStats = mergeStatObjects(...fromRow)
          rowStats = enhanceRowStatsWithDeepPluck(rowStats, forDeep)
        }
        out.push({
          linkSn: wechatMpArticleSnKey(link || null),
          titleNorm: title ? normTitle(title) : null,
          wechatIdKeys: collectWechatIdKeysForBundle(r, inner, pubRec, item),
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
        (typeof inner.content_url === 'string' && inner.content_url) ||
        (typeof item.link === 'string' && item.link) ||
        ''
      const titleRaw =
        (typeof inner.title === 'string' && inner.title) ||
        (typeof item.title === 'string' && item.title) ||
        ''
      const chain = statMergeChain(inner, pubRec, item)
      let rowStats = mergeStatObjects(...chain)
      rowStats = enhanceRowStatsWithDeepPluck(rowStats, chain)
      out.push({
        linkSn: wechatMpArticleSnKey(linkRaw || null),
        titleNorm: titleRaw ? normTitle(titleRaw) : null,
        wechatIdKeys: collectWechatIdKeysForBundle(null, inner, pubRec, item),
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

function totalCountHint (j: Record<string, unknown>): number {
  const page = parsePublishPageRoot(j.publish_page)
  if (!page) return 0
  const t = page.total_count ?? page.publish_total_count ?? page.totalCount
  if (typeof t === 'number' && Number.isFinite(t)) return Math.max(0, t)
  return 0
}

export async function fetchWechatMpArticleInsightViaSession (
  userId: string,
  options: {
    publishedUrl: string | null | undefined
    title: string
    /** 对应 ContentPlatform.platformContentId 或发布任务里保存的 `appmsgid` / 草稿 id */
    platformContentId?: string | null
  }
): Promise<
  | { ok: true; data: WechatMpSessionInsightTotals }
  | { ok: false; error: string }
> {
  const wantSn = wechatMpArticleSnKey(options.publishedUrl)
  const wantWechatId = normalizeWechatPlatformContentIdForListMatch(
    options.platformContentId
  )
  const wantTitle = normTitle(options.title)
  if (!wantSn && !wantWechatId && !wantTitle) {
    return {
      ok: false,
      error:
        '缺少正文链、平台侧图文物料 ID 或标题，无法从发表记录（publish_list / appmsg_info）匹配该篇'
    }
  }

  const pageSize = 20
  const maxPages = 30
  let totalHint = 0
  type Best = { r: FlatRow; pri: number; score: number }
  let best: Best | null = null
  /** 仅标题全等（pri=2）下互动最高的一条，用于纠正「sn/素材 id 误配为全 0 但仍压过标题行」 */
  let bestTitleExact: Best | null = null
  const consider = (cand: Best): void => {
    if (!best) {
      best = cand
      return
    }
    if (cand.pri > best.pri) {
      best = cand
      return
    }
    if (cand.pri < best.pri) return
    if (cand.score > best.score) best = cand
  }

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
      const pri = matchPublishListRow(r, wantSn, wantWechatId, wantTitle)
      if (pri === 0) continue
      const score = rowEngagementTotal(r)
      const cand: Best = { r, pri, score }
      consider(cand)
      if (pri === 2) {
        if (!bestTitleExact || score > bestTitleExact.score) {
          bestTitleExact = cand
        }
      }
    }

    if (totalHint > 0 && begin + pageSize >= totalHint) break
    if (rows.length < pageSize) break
  }

  if (
    best != null &&
    bestTitleExact != null &&
    rowEngagementTotal(best.r) === 0 &&
    bestTitleExact.score > 0 &&
    best.pri > bestTitleExact.pri
  ) {
    best = bestTitleExact
  }

  if (best) {
    return {
      ok: true,
      data: {
        views: best.r.views,
        comments: best.r.comments,
        likes: best.r.likes,
        shares: best.r.shares,
        collections: best.r.collections
      }
    }
  }

  return {
    ok: false,
    error:
      '在已拉取的发表记录中未匹配到该篇（可核对正文链接是否与后台一致，或文章较旧需翻页更多）'
  }
}
