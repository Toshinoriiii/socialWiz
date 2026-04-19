/**
 * 知乎专栏文章互动：仅使用创作者中心「内容分析」按日统计接口（与后台一致），
 * 不请求专栏正文页或公开文章详情 API。
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
  if (!/^\d{5,20}$/.test(id)) {
    return { ok: false, error: '知乎文章 id 无效' }
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
  if (!creatorsFirst.ok) {
    return {
      ok: false,
      error: `知乎创作者数据接口 HTTP ${creatorsFirst.status}: ${creatorsFirst.text.slice(0, 200)}`
    }
  }

  try {
    const parsed = JSON.parse(creatorsFirst.text) as unknown
    const fromCreators = parseCreatorsAnalysisDaily(parsed)
    if (fromCreators) {
      return { ok: true, data: fromCreators }
    }
  } catch {
    return { ok: false, error: '知乎创作者数据返回非 JSON' }
  }

  return {
    ok: false,
    error:
      '创作者中心暂无该文的按日统计（可能无权限、非本人内容或统计尚未产出）。数据分析仅使用创作者后台接口，不读取专栏正文页。'
  }
}
