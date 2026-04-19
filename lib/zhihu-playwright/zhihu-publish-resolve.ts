/**
 * 知乎发文前解析：问题 / 话题 / 专栏（搜索与专栏 API，需登录 Cookie）。
 * 响应结构随产品迭代可能变化，以实际抓包为准。
 */

import { zhihuJsonHeaders, zhihuZhuanlanJsonHeaders } from '@/lib/zhihu-playwright/zhihu-http'

const WWW_ORIGIN = 'https://www.zhihu.com'
const ZHIHU_API_V4 = `${WWW_ORIGIN}/api/v4`
const ZHUANLAN_ORIGIN = 'https://zhuanlan.zhihu.com'
const ZHUANLAN_API = `${ZHUANLAN_ORIGIN}/api`

const SEARCH_PARAMS_BASE: Record<string, string> = {
  gk_version: 'gz-gaokao',
  correction: '1',
  filter_fields: 'lc_idx',
  lc_idx: '0',
  show_all_topics: '0',
  search_source: 'Normal'
}

function questionIdFromObject (ob: Record<string, unknown>): string | undefined {
  if (ob.type !== 'question') return
  const id = ob.id ?? ob.url_token
  if (id == null) return
  const s = String(id).trim()
  return s || undefined
}

/** 从 search_v3 单条结果取问题 id（优先 object）。 */
function questionIdFromSearchItem (item: unknown): string | undefined {
  if (!item || typeof item !== 'object') return
  const o = item as Record<string, unknown>
  const obj = o.object
  if (obj && typeof obj === 'object') {
    const id = questionIdFromObject(obj as Record<string, unknown>)
    if (id) return id
  }
  return questionIdFromObject(o)
}

/** 从 search_v3 单条结果取话题 id。 */
function topicIdFromSearchItem (item: unknown): string | undefined {
  if (!item || typeof item !== 'object') return
  const o = item as Record<string, unknown>
  const obj = o.object
  if (obj && typeof obj === 'object') {
    const ob = obj as Record<string, unknown>
    if (ob.type === 'topic') {
      const id = ob.id ?? ob.url_token
      if (id != null) {
        const s = String(id).trim()
        if (s) return s
      }
    }
  }
  if (o.type === 'topic') {
    const id = o.id ?? o.url_token
    if (id != null) {
      const s = String(id).trim()
      if (s) return s
    }
  }
  return
}

function firstQuestionIdFromSearchV3 (json: unknown): string | undefined {
  if (!json || typeof json !== 'object') return
  const data = (json as { data?: unknown }).data
  if (Array.isArray(data)) {
    for (const item of data) {
      const id = questionIdFromSearchItem(item)
      if (id) return id
    }
  }
  return
}

function firstTopicIdFromSearchV3 (json: unknown): string | undefined {
  if (!json || typeof json !== 'object') return
  const data = (json as { data?: unknown }).data
  if (Array.isArray(data)) {
    for (const item of data) {
      const id = topicIdFromSearchItem(item)
      if (id) return id
    }
  }
  return
}

function searchV3Url (t: string, q: string, limit: string): string {
  const params = new URLSearchParams({
    ...SEARCH_PARAMS_BASE,
    t,
    q,
    offset: '0',
    limit
  })
  return `${ZHIHU_API_V4}/search_v3?${params}`
}

export async function zhihuSearchFirstQuestionId (
  keyword: string,
  cookieHeader: string,
  xsrf: string
): Promise<{ ok: true; id: string } | { ok: false; error: string; detail?: string }> {
  const kw = keyword.trim()
  if (!kw) return { ok: false, error: '问题关键词为空' }
  const url = searchV3Url('general', kw, '15')
  try {
    const res = await fetch(url, {
      headers: {
        ...zhihuJsonHeaders(xsrf),
        Cookie: cookieHeader
      }
    })
    const text = await res.text()
    if (!res.ok) {
      return {
        ok: false,
        error: `搜索问题失败（HTTP ${res.status}）`,
        detail: text.slice(0, 400)
      }
    }
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      return { ok: false, error: '搜索返回非 JSON', detail: text.slice(0, 200) }
    }
    const id = firstQuestionIdFromSearchV3(json)
    if (!id) {
      return {
        ok: false,
        error: '未找到匹配的问题',
        detail: '请更换关键词或留空「投稿至问题」'
      }
    }
    return { ok: true, id }
  } catch (e) {
    return {
      ok: false,
      error: '搜索问题请求失败',
      detail: e instanceof Error ? e.message : String(e)
    }
  }
}

export async function zhihuSearchTopicIdByName (
  name: string,
  cookieHeader: string,
  xsrf: string
): Promise<string | undefined> {
  const kw = name.trim()
  if (!kw) return
  const url = searchV3Url('topic', kw, '8')
  try {
    const res = await fetch(url, {
      headers: {
        ...zhihuJsonHeaders(xsrf),
        Cookie: cookieHeader
      }
    })
    if (!res.ok) return
    const json = JSON.parse(await res.text()) as unknown
    return firstTopicIdFromSearchV3(json)
  } catch {
    return
  }
}

export async function zhihuResolveColumnPublishValue (
  columnNameOrSlug: string,
  cookieHeader: string,
  xsrf: string
): Promise<{ ok: true; column: string } | { ok: false; error: string; detail?: string }> {
  const slug = columnNameOrSlug.trim()
  if (!slug) return { ok: false, error: '专栏名称为空' }
  const url = `${ZHUANLAN_API}/columns/${encodeURIComponent(slug)}`
  try {
    const res = await fetch(url, {
      headers: {
        ...zhihuZhuanlanJsonHeaders(xsrf),
        Cookie: cookieHeader
      }
    })
    const text = await res.text()
    if (!res.ok) {
      return {
        ok: false,
        error: `解析专栏失败（HTTP ${res.status}）`,
        detail: text.slice(0, 300)
      }
    }
    let json: unknown
    try {
      json = JSON.parse(text) as Record<string, unknown>
    } catch {
      return { ok: false, error: '专栏接口返回非 JSON', detail: text.slice(0, 200) }
    }
    const j = json as Record<string, unknown>
    const id = j.id ?? j.url_token
    const col = id != null ? String(id).trim() : ''
    if (!col) {
      return { ok: false, error: '专栏响应中无有效 id', detail: text.slice(0, 200) }
    }
    return { ok: true, column: col }
  } catch (e) {
    return {
      ok: false,
      error: '专栏请求失败',
      detail: e instanceof Error ? e.message : String(e)
    }
  }
}
