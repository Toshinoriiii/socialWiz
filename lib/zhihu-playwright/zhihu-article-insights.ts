/**
 * 知乎专栏文章互动（多层回退，均带同一浏览器会话）：
 * 1. 创作者中心「我的内容」`creators/creations/v2/all` 列表项上的 `reaction`（与创作后台列表一致，含 read_count 等，新文常有数据）；
 * 2. 「内容分析」按日 `creators/analysis/realtime/content/daily` 累加；
 * 3. `api/v4/articles/{id}` 单篇资源。
 * `platformContentId` 若被截断，会在列表中按 `id` 唯一前缀匹配整篇 id。
 */
import { cookieHeaderForUrl } from '@/lib/weibo-playwright/weibo-storage-cookies'
import type { StorageStateCookie } from '@/lib/weibo-playwright/weibo-storage-cookies'
import { readZhihuPlaywrightStorageCookies } from '@/lib/zhihu-playwright/zhihu-session-cookies'
import { zhihuJsonHeaders } from '@/lib/zhihu-playwright/zhihu-http'

const WWW = 'https://www.zhihu.com'
const ZHUANLAN = 'https://zhuanlan.zhihu.com'

export interface ZhihuArticleEngagement {
  views: number
  likes: number
  comments: number
  shares: number
  collections: number
}

/** 知乎部分计数在 JSON 里为字符串，需与数字一并解析 */
function nonnegInt (v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Math.max(0, Math.floor(v))
  }
  if (typeof v === 'string') {
    const s = v.trim().replace(/,/g, '')
    if (/^\d+$/.test(s)) return Math.max(0, parseInt(s, 10))
  }
  return 0
}

/** 合并多域下可见的 Cookie，避免 z_c0 等只挂在 zhuanlan / api 域时 www 请求缺鉴权 */
function mergeZhihuCookieHeader (
  cookies: StorageStateCookie[],
  urls: string[]
): string {
  const map = new Map<string, string>()
  for (const u of urls) {
    const h = cookieHeaderForUrl(u, cookies)
    for (const part of h.split(';').map((s) => s.trim()).filter(Boolean)) {
      const eq = part.indexOf('=')
      if (eq <= 0) continue
      const name = part.slice(0, eq).trim()
      const value = part.slice(eq + 1)
      map.set(name, value)
    }
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

function ymdShanghai (d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d)
}

/** 创作后台 `creations/v2/all` 中每条下的 reaction（与列表展示一致） */
function engagementFromCreationsV2Reaction (
  reaction: unknown
): ZhihuArticleEngagement | null {
  if (!reaction || typeof reaction !== 'object') return null
  const r = reaction as Record<string, unknown>
  const views = Math.max(
    nonnegInt(r.read_count),
    nonnegInt(r.view_count)
  )
  const likes =
    nonnegInt(r.vote_up_count) +
    nonnegInt(r.like_count) +
    nonnegInt(r['new_like_count'])
  const comments = nonnegInt(r.comment_count)
  const collections = nonnegInt(r.collect_count)
  const shares = nonnegInt(r.repin_count)
  return {
    views,
    likes,
    comments,
    collections,
    shares
  }
}

function itemDataId (item: Record<string, unknown>): string {
  const data = item.data
  if (!data || typeof data !== 'object') return ''
  const d = data as Record<string, unknown>
  if (d.id != null) return String(d.id)
  if (d.url_token != null) return String(d.url_token)
  return ''
}

/**
 * 在单页 `data` 中查找 type=article 且 id 匹配；支持唯一前缀回退（库内 id 被截断时）。
 */
function matchArticleRowInCreationsData (
  raw: unknown,
  wantDigits: string
): { reaction: unknown } | null {
  if (!raw || typeof raw !== 'object') return null
  const root = raw as Record<string, unknown>
  const list = root.data
  if (!Array.isArray(list)) return null
  const articles: Record<string, unknown>[] = []
  for (const x of list) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    if (o.type === 'article') articles.push(o)
  }
  const want = wantDigits.replace(/\D/g, '')

  for (const item of articles) {
    if (itemDataId(item) === want) {
      return { reaction: item.reaction }
    }
  }
  if (want.length >= 10) {
    const byPrefix = articles.filter(
      (item) => itemDataId(item).length > 0 && itemDataId(item).startsWith(want)
    )
    if (byPrefix.length === 1) {
      return { reaction: byPrefix[0]!.reaction }
    }
  }
  return null
}

type CreationsV2FetchResult =
  | { data: ZhihuArticleEngagement }
  | { authFailed: true }
  | null

/**
 * 分页拉取「我的内容」，直到找到目标文章或到末页。
 * @see https://www.zhihu.com/api/v4/creators/creations/v2/all
 */
async function fetchEngagementFromCreationsV2All (
  wantDigits: string,
  cookieMerged: string,
  xsrf: string
): Promise<CreationsV2FetchResult> {
  const pageSize = 20
  const maxPages = 30
  for (let page = 0; page < maxPages; page++) {
    const url =
      `${WWW}/api/v4/creators/creations/v2/all?` +
      new URLSearchParams({
        start: '0',
        end: '0',
        limit: String(pageSize),
        offset: String(page * pageSize),
        need_co_creation: '1',
        sort_type: 'created'
      }).toString()
    const res = await fetchJson(url, {
      ...zhihuJsonHeaders(xsrf),
      Cookie: cookieMerged,
      Referer: `${WWW}/creator`
    })
    if (res.status === 401 || res.status === 403) {
      return { authFailed: true }
    }
    if (!res.ok) {
      return null
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(res.text) as unknown
    } catch {
      return null
    }
    const row = matchArticleRowInCreationsData(parsed, wantDigits)
    if (row) {
      const m = engagementFromCreationsV2Reaction(row.reaction)
      if (m) {
        return { data: m }
      }
    }
    const root = parsed as Record<string, unknown>
    const p = root.paging
    if (
      p &&
      typeof p === 'object' &&
      (p as Record<string, unknown>).is_end === true
    ) {
      return null
    }
    if (!Array.isArray(root.data) || (root.data as unknown[]).length < pageSize) {
      return null
    }
  }
  return null
}

/**
 * 创作者中心「内容分析」按日明细：token 为内容 id（与专栏文章 id 一致），多日行需累加。
 * @see https://www.zhihu.com/api/v4/creators/analysis/realtime/content/daily
 */
function parseCreatorsAnalysisDaily (raw: unknown): ZhihuArticleEngagement | null {
  const rows = Array.isArray(raw)
    ? raw
    : raw &&
        typeof raw === 'object' &&
        Array.isArray((raw as Record<string, unknown>).data)
      ? ((raw as Record<string, unknown>).data as unknown[])
      : null
  if (!rows?.length) return null

  let pv = 0
  let play = 0
  let show = 0
  let upvote = 0
  let comment = 0
  let like = 0
  let collect = 0
  let share = 0
  let reaction = 0
  let likeAndReaction = 0

  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    pv += nonnegInt(o.pv)
    play += nonnegInt(o.play)
    show += nonnegInt(o.show)
    upvote += nonnegInt(o.upvote)
    comment += nonnegInt(o.comment)
    like += nonnegInt(o.like)
    collect += nonnegInt(o.collect)
    share += nonnegInt(o.share)
    reaction += nonnegInt(o.reaction)
    likeAndReaction += nonnegInt(o.like_and_reaction)
  }

  let views = pv + play
  if (views === 0 && show > 0) views = show

  const likes = upvote + like + likeAndReaction + reaction

  if (
    views + likes + comment + collect + share ===
    0
  ) {
    return null
  }

  return {
    views,
    likes,
    comments: comment,
    collections: collect,
    shares: share
  }
}

const ARTICLE_V4_INCLUDE = [
  'voteup_count',
  'comment_count',
  'favlists_count',
  'visit_count',
  'title'
].join(',')

/**
 * 单篇 v4 资源：与 Web 端打开专栏页时加载的 `GET /api/v4/articles/{id}` 一致（需同一会话 Cookie）。
 * 不替代创作者按日曲线；仅在按日未就绪时作为快照。
 */
function parseArticleV4Payload (raw: unknown): ZhihuArticleEngagement | null {
  if (!raw || typeof raw !== 'object') return null
  const root = raw as Record<string, unknown>
  if (root.error && typeof root.error === 'object') return null
  let o: Record<string, unknown> = root
  if (
    o.data &&
    typeof o.data === 'object' &&
    !Array.isArray(o.data) &&
    o.data !== null
  ) {
    o = o.data as Record<string, unknown>
  }
  const views = Math.max(
    nonnegInt(o.visit_count),
    nonnegInt(o.read_count)
  )
  const likes = nonnegInt(o.voteup_count)
  const comments = nonnegInt(o.comment_count)
  const collect =
    nonnegInt(o.favlists_count) + nonnegInt(o.favorite_count)
  const shares = nonnegInt(o['share_count']) + nonnegInt(o.repin_count)
  if (o.id == null && o['url_token'] == null) return null
  return {
    views,
    likes,
    comments,
    collections: collect,
    shares
  }
}

async function fetchArticleV4Engagement (
  id: string,
  cookieMerged: string,
  xsrf: string
): Promise<ZhihuArticleEngagement | null> {
  const url =
    `${WWW}/api/v4/articles/${encodeURIComponent(id)}?` +
    new URLSearchParams({ include: ARTICLE_V4_INCLUDE }).toString()
  const headers = {
    ...zhihuJsonHeaders(xsrf),
    Cookie: cookieMerged,
    Referer: `${ZHUANLAN}/p/${encodeURIComponent(id)}`
  }
  const res = await fetchJson(url, headers)
  if (!res.ok || (res.status !== 200 && res.status !== 404)) {
    return null
  }
  try {
    const parsed = JSON.parse(res.text) as unknown
    return parseArticleV4Payload(parsed)
  } catch {
    return null
  }
}

async function fetchJson (
  url: string,
  headers: Record<string, string>
): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetch(url, {
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000)
  })
  const text = await res.text()
  return { ok: res.ok, status: res.status, text }
}

export async function fetchZhihuArticleEngagement (
  userId: string,
  articleId: string
): Promise<
  | { ok: true; data: ZhihuArticleEngagement }
  | { ok: false; error: string }
> {
  const id = String(articleId).replace(/\D/g, '')
  if (!/^\d{5,25}$/.test(id)) {
    return { ok: false, error: '知乎文章 id 无效（需为 5～25 位数字，可与专栏 /p/ 后或创作列表 id 一致）' }
  }

  const cookies = readZhihuPlaywrightStorageCookies(userId)
  if (!cookies?.length) {
    return {
      ok: false,
      error: '未找到知乎会话文件，请在账号管理中完成「连接知乎（浏览器）」'
    }
  }

  const byName = new Map(cookies.map((c) => [c.name, c.value]))
  if (!byName.get('z_c0')?.trim() || !byName.get('_xsrf')?.trim()) {
    return {
      ok: false,
      error: '知乎 Cookie 不完整（需 z_c0、_xsrf），请重新绑定浏览器会话'
    }
  }

  const xsrf = byName.get('_xsrf')?.trim() ?? ''
  const cookieMerged = mergeZhihuCookieHeader(cookies, [
    `${WWW}/`,
    `${ZHUANLAN}/`,
    'https://api.zhihu.com/'
  ])
  if (!cookieMerged) {
    return { ok: false, error: '无法为知乎域名拼装 Cookie，请重新绑定' }
  }

  const fromCreations = await fetchEngagementFromCreationsV2All(
    id,
    cookieMerged,
    xsrf
  )
  if (fromCreations && 'authFailed' in fromCreations) {
    return {
      ok: false,
      error:
        '知乎创作中心内容列表鉴权失败（401/403）。请确认已绑定本账号浏览器会话，并重新连接后再试。'
    }
  }
  if (fromCreations && 'data' in fromCreations) {
    return { ok: true, data: fromCreations.data }
  }

  const end = ymdShanghai(new Date())
  const start = ymdShanghai(new Date(Date.now() - 89 * 86400000))
  const creatorsDailyUrl =
    `${WWW}/api/v4/creators/analysis/realtime/content/daily?` +
    new URLSearchParams({
      type: 'article',
      token: id,
      start,
      end
    }).toString()
  const creatorsHeaders = {
    ...zhihuJsonHeaders(xsrf),
    Cookie: cookieMerged,
    Referer: `${WWW}/creator`
  }

  const creatorsFirst = await fetchJson(creatorsDailyUrl, creatorsHeaders)
  if (creatorsFirst.status === 401 || creatorsFirst.status === 403) {
    return {
      ok: false,
      error:
        '知乎创作者数据鉴权失败（401/403）。请确认已绑定知乎浏览器会话、账号开通创作者权限，并重新连接后再试。'
    }
  }

  if (creatorsFirst.ok) {
    try {
      const parsed = JSON.parse(creatorsFirst.text) as unknown
      const fromCreators = parseCreatorsAnalysisDaily(parsed)
      if (fromCreators) {
        return { ok: true, data: fromCreators }
      }
    } catch {
      /* 非 JSON 时仍回退 v4 */
    }
  }

  const fromV4 = await fetchArticleV4Engagement(id, cookieMerged, xsrf)
  if (fromV4) {
    return { ok: true, data: fromV4 }
  }

  if (!creatorsFirst.ok) {
    return {
      ok: false,
      error: `知乎创作者数据接口 HTTP ${creatorsFirst.status}，且 v4 文章接口未取到数据：${creatorsFirst.text.slice(0, 160)}`
    }
  }

  return {
    ok: false,
    error:
      '创作者中心该文暂无按日统计，且专栏文章 v4 接口未返回可解析数据（新文可能未索引、id 与正文 /p/ 后一致、或需稍后重试）。'
  }
}
