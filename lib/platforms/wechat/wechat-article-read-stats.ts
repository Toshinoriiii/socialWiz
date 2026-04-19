/**
 * 微信公众号单篇阅读等统计：datacube getarticleread（发表内容）+ getarticletotal（群发累计，作标题回退）。
 * 需认证公众号且开通数据统计权限；数据通常滞后，建议查询「昨日」及前几日。
 */

const WECHAT_API = 'https://api.weixin.qq.com'

export interface WechatArticleInsightTotals {
  views: number
  comments: number
  likes: number
  shares: number
  /** getarticletotaldetail.detail_list 中的微信收藏人数 */
  collections?: number
}

function normTitle (t: string): string {
  return t.trim().replace(/\s+/g, ' ')
}

function ymdShanghai (d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d)
}

function shanghaiYmdDaysAgo (daysAgo: number): string {
  return ymdShanghai(new Date(Date.now() - daysAgo * 86400000))
}

function coerceDatacubeInt (v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Math.max(0, Math.floor(v))
  }
  if (typeof v === 'string') {
    const s = v.trim().replace(/,/g, '')
    if (/^\d+$/.test(s)) return Math.max(0, parseInt(s, 10))
  }
  return 0
}

/** 接口 msgid 形如 2247490098_1；库内可能仅存数字主 id */
function msgidMatchesRow (apiMsgid: string, stored: string | null | undefined): boolean {
  if (!stored?.trim()) return false
  const s = stored.trim()
  const a = apiMsgid.trim()
  if (a === s) return true
  if (!s.includes('_')) {
    return a === s || a.startsWith(`${s}_`)
  }
  return false
}

function latestDetailFromTotalDetail (
  detailList: unknown
): Record<string, unknown> | null {
  if (!Array.isArray(detailList) || detailList.length === 0) return null
  let best: Record<string, unknown> | null = null
  let bestDate = ''
  for (const row of detailList) {
    if (!row || typeof row !== 'object') continue
    const d = row as Record<string, unknown>
    const sd = typeof d.stat_date === 'string' ? d.stat_date : ''
    if (sd >= bestDate) {
      bestDate = sd
      best = d
    }
  }
  return best
}

/**
 * getarticletotaldetail：detail_list 含阅读/分享/两种赞/留言/收藏（与 getarticleread 仅阅读不同）。
 */
function readFromGetArticleTotalDetail (
  data: Record<string, unknown>,
  opts: { msgid?: string | null; title: string }
): WechatArticleInsightTotals | null {
  const wantMsg = opts.msgid?.trim()
  const wantTitle = normTitle(opts.title)
  const list = data.list
  if (!Array.isArray(list)) return null

  for (const row of list) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const mid = o.msgid != null ? String(o.msgid) : ''
    const t = typeof o.title === 'string' ? normTitle(o.title) : ''
    const msgMatch = wantMsg && mid && msgidMatchesRow(mid, wantMsg)
    const titleMatch =
      wantTitle.length > 0 && t.length > 0 && t === wantTitle
    if (!msgMatch && !titleMatch) continue

    const best = latestDetailFromTotalDetail(o.detail_list)
    if (!best) continue

    const views = coerceDatacubeInt(best.read_user)
    const shares = coerceDatacubeInt(best.share_user)
    const likes =
      coerceDatacubeInt(best.zaikan_user) + coerceDatacubeInt(best.like_user)
    const comments = coerceDatacubeInt(best.comment_count)
    const collections = coerceDatacubeInt(best.collection_user)

    return {
      views,
      shares,
      likes,
      comments,
      collections: collections > 0 ? collections : undefined
    }
  }
  return null
}

async function postDatacube (
  path: string,
  accessToken: string,
  body: Record<string, string>
): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string }
> {
  const url = `${WECHAT_API}${path}?access_token=${encodeURIComponent(accessToken)}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000)
    })
    const text = await res.text()
    let data: Record<string, unknown>
    try {
      data = JSON.parse(text) as Record<string, unknown>
    } catch {
      return { ok: false, error: `非 JSON 响应: ${text.slice(0, 200)}` }
    }
    const err = data.errcode
    if (typeof err === 'number' && err !== 0) {
      return {
        ok: false,
        error: `${data.errmsg ?? 'datacube 错误'} (${err})`
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

function readFromGetArticleRead (
  data: Record<string, unknown>,
  msgid: string
): WechatArticleInsightTotals | null {
  const list = data.list
  if (!Array.isArray(list)) return null
  for (const row of list) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const mid = o.msgid != null ? String(o.msgid) : ''
    if (mid !== msgid) continue
    const detail = o.detail
    if (!detail || typeof detail !== 'object') continue
    const d = detail as Record<string, unknown>
    const readUser = coerceDatacubeInt(d.read_user)
    return { views: readUser, comments: 0, likes: 0, shares: 0 }
  }
  return null
}

function readFromGetArticleTotal (
  data: Record<string, unknown>,
  title: string
): WechatArticleInsightTotals | null {
  const want = normTitle(title)
  if (!want) return null
  const list = data.list
  if (!Array.isArray(list)) return null
  for (const row of list) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const t = typeof o.title === 'string' ? normTitle(o.title) : ''
    if (t !== want) continue
    const details = o.details
    if (!Array.isArray(details) || details.length === 0) continue
    let best: Record<string, unknown> | null = null
    let bestDate = ''
    for (const d of details) {
      if (!d || typeof d !== 'object') continue
      const dd = d as Record<string, unknown>
      const sd = typeof dd.stat_date === 'string' ? dd.stat_date : ''
      if (sd >= bestDate) {
        bestDate = sd
        best = dd
      }
    }
    if (!best) continue
    const views =
      typeof best.int_page_read_count === 'number'
        ? Math.max(0, Math.floor(best.int_page_read_count))
        : 0
    const shares =
      typeof best.share_count === 'number'
        ? Math.max(0, Math.floor(best.share_count))
        : 0
    return { views, comments: 0, likes: 0, shares }
  }
  return null
}

export async function fetchWechatPublishedArticleInsight (
  accessToken: string,
  options: {
    /** 与接口返回 msgid 一致，如 msg_data_id_1 */
    datacubeMsgid?: string | null
    articleTitle: string
    /** 用于 getarticletotal 按发表日拉列表（北京时间日历日） */
    publishedAtApprox: Date
  }
): Promise<
  | { ok: true; data: WechatArticleInsightTotals }
  | { ok: false; error: string }
> {
  const { datacubeMsgid, articleTitle, publishedAtApprox } = options

  const detailDayOffsets = [0, -1, 1, -2, 2, -3, 3]
  const detailYmds = [
    ...new Set(
      detailDayOffsets.map((delta) =>
        ymdShanghai(new Date(publishedAtApprox.getTime() + delta * 86400000))
      )
    )
  ]

  for (const ymd of detailYmds) {
    const r = await postDatacube('/datacube/getarticletotaldetail', accessToken, {
      begin_date: ymd,
      end_date: ymd
    })
    if (!r.ok) continue
    const fromDetail = readFromGetArticleTotalDetail(r.data, {
      msgid: datacubeMsgid,
      title: articleTitle
    })
    if (fromDetail) {
      return { ok: true, data: fromDetail }
    }
  }

  if (datacubeMsgid?.trim()) {
    const mid = datacubeMsgid.trim()
    for (let day = 1; day <= 7; day++) {
      const ymd = shanghaiYmdDaysAgo(day)
      const r = await postDatacube('/datacube/getarticleread', accessToken, {
        begin_date: ymd,
        end_date: ymd
      })
      if (!r.ok) {
        break
      }
      const slice = readFromGetArticleRead(r.data, mid)
      if (slice) {
        return { ok: true, data: slice }
      }
    }
  }

  const pubYmd = ymdShanghai(publishedAtApprox)
  const totalR = await postDatacube('/datacube/getarticletotal', accessToken, {
    begin_date: pubYmd,
    end_date: pubYmd
  })
  if (totalR.ok) {
    const fromTotal = readFromGetArticleTotal(totalR.data, articleTitle)
    if (fromTotal) {
      return { ok: true, data: fromTotal }
    }
  }

  if (datacubeMsgid?.trim()) {
    return {
      ok: false,
      error:
        '未在 datacube 中找到该图文（getarticletotaldetail 需认证号与统计权限；数据可能延迟，或 msgid/标题与后台不一致）。'
    }
  }

  if (!totalR.ok) {
    return { ok: false, error: totalR.error }
  }
  return {
    ok: false,
    error:
      '未匹配到标题对应的群发统计（请确认发表日期与标题与后台一致，或重新发布以写入 msgid）。'
  }
}
