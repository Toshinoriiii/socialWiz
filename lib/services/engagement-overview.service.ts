import type { ContentPlatform, PlatformAccount, WeiboAppConfig } from '@prisma/client'
import { Platform } from '@/types/platform.types'
import { prisma } from '@/lib/db/prisma'

/** schema 更新后若未 prisma generate，或 dev 仍缓存旧 Client，delegate 会不存在 */
function engagementSnapshotModel (): {
  upsert: (args: Record<string, unknown>) => Promise<unknown>
  findMany: (args: Record<string, unknown>) => Promise<
    Array<{
      day: Date
      views: number
      comments: number
      likes: number
      shares: number
    }>
  >
} | null {
  const raw = prisma as unknown as Record<string, unknown>
  const m = raw.userEngagementDailySnapshot as
    | {
        upsert?: unknown
        findMany?: unknown
      }
    | undefined
  if (!m || typeof m.upsert !== 'function' || typeof m.findMany !== 'function') {
    return null
  }
  return m as {
    upsert: (args: Record<string, unknown>) => Promise<unknown>
    findMany: (args: Record<string, unknown>) => Promise<
      Array<{
        day: Date
        views: number
        comments: number
        likes: number
        shares: number
      }>
    >
  }
}
import {
  fetchWeiboPostInsightsForAccount,
  WEIBO_IMAGE_TEXT_READ_STATS_HINT
} from '@/lib/platforms/weibo/weibo-post-insights'
import { effectivePublishContentTypeFromRecord } from '@/lib/utils/content-publish-type'
import { fetchZhihuArticleEngagement } from '@/lib/zhihu-playwright/zhihu-article-insights'
import {
  extractTtarticleObjectIdFromUrl,
  fetchWeiboTtarticleInsightsWithSessionCookies
} from '@/lib/weibo-playwright/weibo-ttarticle-insights'
import { normalizeWeiboStatusPostId } from '@/lib/weibo-playwright/weibo-profile-status-url'
import {
  findFeedMidByWeiboArticleObjectIdWithRetry,
  isWeiboArticleNumericObjectId
} from '@/lib/weibo-playwright/weibo-status-cookie'
import { wechatMpArticleSnKey } from '@/lib/wechat-playwright/wechat-mp-session-publish-insights'
import { wechatPlaywrightSessionExists } from '@/lib/wechat-playwright/session-files'
import { fetchWechatArticleEngagementMetrics } from '@/lib/platforms/wechat/wechat-article-engagement'

export interface EngagementTotals {
  views: number
  comments: number
  likes: number
  shares: number
  /** 收藏（当前主要知乎有值，其余平台多为 0） */
  collections?: number
}

export interface EngagementOverviewResult {
  totals: EngagementTotals
  postsConsidered: number
  postsSucceeded: number
  warnings: string[]
  wechatExcluded: boolean
}

type Row = ContentPlatform & {
  platformAccount: (PlatformAccount & { weiboAppConfig: WeiboAppConfig | null }) | null
  wechatConfig: { id: string } | null
  content: { title: string; contentType: string | null; publishedAt: Date | null }
}

function emptyTotals (): EngagementTotals {
  return { views: 0, comments: 0, likes: 0, shares: 0, collections: 0 }
}

function addTotals (a: EngagementTotals, b: EngagementTotals): EngagementTotals {
  return {
    views: a.views + b.views,
    comments: a.comments + b.comments,
    likes: a.likes + b.likes,
    shares: a.shares + b.shares,
    collections: (a.collections ?? 0) + (b.collections ?? 0)
  }
}

function utcDayStart (d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function weiboCoerceInt (v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Math.max(0, Math.floor(v))
  }
  if (typeof v === 'string') {
    const raw = v.trim().replace(/[，,]/g, '')
    if (/^\d+$/.test(raw)) return Math.max(0, parseInt(raw, 10))
  }
  return undefined
}

function weiboDataToTotals (data: unknown): EngagementTotals {
  const t = emptyTotals()
  if (!data || typeof data !== 'object') return t
  const o = data as Record<string, unknown>
  const reads =
    weiboCoerceInt(o.reads_count) ??
    weiboCoerceInt(o.read_count) ??
    0
  t.views = reads
  t.comments =
    weiboCoerceInt(o.comments_count) ??
    weiboCoerceInt(o.comment_count) ??
    0
  t.likes =
    weiboCoerceInt(o.attitudes_count) ??
    weiboCoerceInt(o.attitude_count) ??
    weiboCoerceInt(o.like_count) ??
    0
  t.shares =
    weiboCoerceInt(o.reposts_count) ??
    weiboCoerceInt(o.repost_count) ??
    0
  t.collections = 0
  return t
}

function dedupeRows (rows: Row[]): Row[] {
  const map = new Map<string, Row>()
  for (const row of rows) {
    const plat =
      row.wechatConfigId != null
        ? 'WECHAT'
        : row.platformAccount?.platform
    if (!plat) continue

    let k: string | null = null
    if (plat === Platform.WEIBO) {
      const tt = extractTtarticleObjectIdFromUrl(row.publishedUrl)
      if (tt) k = `${plat}:tt:${tt}`
      else {
        const pid = row.platformContentId?.trim()
        if (!pid) continue
        k = `${plat}:${normalizeWeiboStatusPostId(pid) ?? pid}`
      }
    } else if (plat === Platform.WECHAT) {
      const sn = wechatMpArticleSnKey(row.publishedUrl)
      const pid = row.platformContentId?.trim()
      if (sn) k = `${plat}:sn:${sn}`
      else if (pid) k = `${plat}:${pid}`
      else if (row.contentId) k = `${plat}:c:${row.contentId}`
      else continue
    } else {
      const pid = row.platformContentId?.trim()
      if (!pid) continue
      k = `${plat}:${pid}`
    }
    if (!k) continue

    const prev = map.get(k)
    if (!prev || row.createdAt > prev.createdAt) map.set(k, row)
  }
  return [...map.values()]
}

async function metricsForRow (
  row: Row,
  userId: string
): Promise<{ totals: EngagementTotals; ok: boolean; warn?: string }> {
  const pid = row.platformContentId?.trim()

  const platKind =
    row.wechatConfigId != null
      ? Platform.WECHAT
      : row.platformAccount?.platform
  const wechatCfgId =
    row.wechatConfigId ?? row.platformAccount?.wechatAccountConfigId ?? null
  if (platKind === Platform.WECHAT) {
    const wx = await fetchWechatArticleEngagementMetrics({
      userId,
      wechatConfigId: wechatCfgId,
      publishedUrl: row.publishedUrl,
      title: row.content?.title?.trim() ?? '',
      platformContentId: row.platformContentId
    })
    if (wx.ok) {
      return {
        totals: {
          views: wx.data.views,
          comments: wx.data.comments,
          likes: wx.data.likes,
          shares: wx.data.shares,
          collections: wx.data.collections ?? 0
        },
        ok: true
      }
    }
    return { totals: emptyTotals(), ok: false, warn: wx.warn }
  }

  const acc = row.platformAccount
  if (!acc) {
    return { totals: emptyTotals(), ok: false, warn: '无平台账号' }
  }

  if (acc.platform === Platform.WEIBO) {
    const weiboContentKind = effectivePublishContentTypeFromRecord(row.content)
    const weiboInsightsOpts =
      weiboContentKind === 'image-text'
        ? ({ contentPublishKind: 'image-text' } as const)
        : undefined

    const ttFromUrl = extractTtarticleObjectIdFromUrl(row.publishedUrl)
    const pidDigits = pid?.replace(/\D/g, '') ?? ''
    const articleObjectId =
      ttFromUrl ??
      (pidDigits && isWeiboArticleNumericObjectId(pidDigits) ? pidDigits : null)

    let feedMidFromArticle: string | null = null
    if (articleObjectId) {
      feedMidFromArticle = await findFeedMidByWeiboArticleObjectIdWithRetry(
        userId,
        articleObjectId,
        { pauseMsAfterFail: [1500, 2800] }
      )
    }

    const storedTimelineMid = row.weiboTimelineMid?.trim() || null

    let statusId: string | null = null
    if (feedMidFromArticle) {
      /** 头条 object_id 与 time line mid 不同：以时间线为准（与 ajax/statuses/show?id=mid 一致） */
      statusId = feedMidFromArticle
    } else if (storedTimelineMid) {
      statusId = storedTimelineMid
    } else {
      statusId =
        normalizeWeiboStatusPostId(pid) ??
        normalizeWeiboStatusPostId(row.publishedUrl)
      if (statusId && isWeiboArticleNumericObjectId(statusId)) {
        const mid = await findFeedMidByWeiboArticleObjectIdWithRetry(
          userId,
          statusId,
          { pauseMsAfterFail: [1500, 2800] }
        )
        if (mid) statusId = mid
      }
    }

    if (articleObjectId) {
      const tr = await fetchWeiboTtarticleInsightsWithSessionCookies(
        userId,
        articleObjectId
      )
      if (tr.ok) {
        /**
         * 头条侧先读 ttarticle 页 HTML/内嵌 JSON，再以 aj、m 站与时间线
         * statuses/show 补全转评赞。
         */
        if (statusId) {
          const sr = await fetchWeiboPostInsightsForAccount(
            acc,
            userId,
            statusId,
            weiboInsightsOpts
          )
          if (sr.ok) {
            const tt = weiboDataToTotals(tr.data)
            const st = weiboDataToTotals(sr.data)
            return {
              totals: {
                views: tt.views > 0 ? tt.views : st.views,
                likes: st.likes,
                comments: st.comments,
                shares: st.shares,
                collections: tt.collections ?? 0
              },
              ok: true
            }
          }
        }
        return { totals: weiboDataToTotals(tr.data), ok: true }
      }
    }

    if (!statusId) {
      return {
        totals: emptyTotals(),
        ok: false,
        warn:
          '微博缺少时间线 mid：请绑定会话并确认发布记录含 weibo.com/{uid}/{mid}，或保留头条 id 以便从时间线反查'
      }
    }
    const r = await fetchWeiboPostInsightsForAccount(
      acc,
      userId,
      statusId,
      weiboInsightsOpts
    )
    if (!r.ok) {
      return {
        totals: emptyTotals(),
        ok: false,
        warn: `微博 ${statusId.slice(0, 12)}… ${r.error}`
      }
    }
    return { totals: weiboDataToTotals(r.data), ok: true }
  }

  if (acc.platform === Platform.ZHIHU) {
    if (!pid) {
      return { totals: emptyTotals(), ok: false, warn: '缺少 platformContentId' }
    }
    const r = await fetchZhihuArticleEngagement(userId, pid)
    if (!r.ok) {
      return {
        totals: emptyTotals(),
        ok: false,
        warn: `知乎 ${pid.slice(0, 12)}… ${r.error}`
      }
    }
    const d = r.data
    return {
      totals: {
        views: d.views,
        comments: d.comments,
        likes: d.likes,
        shares: d.shares,
        collections: d.collections ?? 0
      },
      ok: true
    }
  }

  return {
    totals: emptyTotals(),
    ok: false,
    warn: `平台 ${acc.platform} 暂未接入单帖互动`
  }
}

async function mapWithConcurrency<T, R> (
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  async function worker (): Promise<void> {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx]!)
    }
  }
  const n = Math.min(limit, Math.max(1, items.length))
  await Promise.all(Array.from({ length: n }, () => worker()))
  return out
}

function platformLabelCn (p: Platform | null | undefined): string {
  switch (p) {
    case Platform.WECHAT:
      return '微信'
    case Platform.WEIBO:
      return '微博'
    case Platform.ZHIHU:
      return '知乎'
    case Platform.DOUYIN:
      return '抖音'
    case Platform.XIAOHONGSHU:
      return '小红书'
    default:
      return '其他'
  }
}

function contentTypeLabelCn (ct: string | null | undefined): string {
  if (ct === 'image-text') return '图文'
  return '文章'
}

function rowPlatformKind (r: Row): Platform | null {
  if (r.wechatConfigId != null) return Platform.WECHAT
  return r.platformAccount?.platform ?? null
}

function includeInContentAnalysis (r: Row, hasWechatSession: boolean): boolean {
  const p = rowPlatformKind(r)
  if (p === Platform.WEIBO || p === Platform.ZHIHU) return true
  if (p === Platform.WECHAT) {
    return (
      r.wechatConfigId != null ||
      r.platformAccount?.wechatAccountConfigId != null ||
      hasWechatSession
    )
  }
  return false
}

export interface ContentAnalysisRow {
  id: string
  contentId: string
  title: string
  accountName: string
  platform: string
  contentType: string
  views: number
  likes: number
  comments: number
  collections: number
  shares: number
  publishedAt: string
  metricsOk: boolean
  metricsWarn?: string
}

/** 每条成功发布记录一行，含各平台实时互动（与数据概览同源拉取逻辑） */
export async function computeContentAnalysisRowsForUser (
  userId: string
): Promise<ContentAnalysisRow[]> {
  const hasWechatSession = wechatPlaywrightSessionExists(userId)
  const raw = await prisma.contentPlatform.findMany({
    where: {
      publishStatus: 'SUCCESS',
      content: { userId }
    },
    include: {
      platformAccount: { include: { weiboAppConfig: true } },
      wechatConfig: { select: { id: true } },
      content: { select: { title: true, contentType: true, publishedAt: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  const rows = (raw as Row[]).filter((r) =>
    includeInContentAnalysis(r, hasWechatSession)
  )

  return mapWithConcurrency(rows, 4, async (r) => {
    const m = await metricsForRow(r, userId)
    const p = rowPlatformKind(r)
    const title = r.content?.title?.trim() || '（无标题）'
    let accountName = r.platformAccount?.platformUsername?.trim()
    if (!accountName) {
      accountName = p === Platform.WECHAT ? '微信公众号' : '—'
    }
    const published = r.content?.publishedAt ?? r.createdAt
    return {
      id: r.id,
      contentId: r.contentId,
      title,
      accountName,
      platform: p != null ? platformLabelCn(p) : '—',
      contentType: contentTypeLabelCn(r.content?.contentType),
      views: m.totals.views,
      likes: m.totals.likes,
      comments: m.totals.comments,
      collections: m.totals.collections ?? 0,
      shares: m.totals.shares,
      publishedAt: published.toISOString(),
      metricsOk: m.ok,
      metricsWarn: m.warn
    }
  })
}

export async function computeEngagementOverviewForUser (
  userId: string
): Promise<EngagementOverviewResult> {
  const raw = await prisma.contentPlatform.findMany({
    where: {
      publishStatus: 'SUCCESS',
      content: { userId }
    },
    include: {
      platformAccount: { include: { weiboAppConfig: true } },
      wechatConfig: { select: { id: true } },
      content: { select: { title: true, contentType: true, publishedAt: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  const hasWechatSession = wechatPlaywrightSessionExists(userId)
  const wechatExcluded = raw.some(
    (r) =>
      r.publishStatus === 'SUCCESS' &&
      r.platformAccount?.platform === Platform.WECHAT &&
      r.wechatConfigId == null &&
      r.platformAccount?.wechatAccountConfigId == null &&
      !hasWechatSession
  )
  const rows = dedupeRows(raw as Row[])
  const actionable = rows.filter((r) => {
    const p =
      r.wechatConfigId != null ? Platform.WECHAT : r.platformAccount?.platform
    if (p === Platform.WEIBO || p === Platform.ZHIHU) return true
    if (p === Platform.WECHAT) {
      return (
        r.wechatConfigId != null ||
        r.platformAccount?.wechatAccountConfigId != null ||
        hasWechatSession
      )
    }
    return false
  })

  const warnings: string[] = []
  if (wechatExcluded) {
    warnings.push(
      '部分微信公众号发布未配置开发者凭证且未绑定浏览器会话，数据概览无法计入微信阅读。'
    )
  }

  const hasWeiboImageText = actionable.some(
    (r) =>
      r.platformAccount?.platform === Platform.WEIBO &&
      effectivePublishContentTypeFromRecord(r.content) === 'image-text'
  )
  if (hasWeiboImageText) {
    warnings.push(WEIBO_IMAGE_TEXT_READ_STATS_HINT)
  }

  if (actionable.length === 0) {
    return {
      totals: emptyTotals(),
      postsConsidered: 0,
      postsSucceeded: 0,
      warnings,
      wechatExcluded
    }
  }

  const parts = await mapWithConcurrency(actionable, 4, (row) =>
    metricsForRow(row, userId)
  )

  let totals = emptyTotals()
  let okCount = 0
  for (const p of parts) {
    if (p.warn) warnings.push(p.warn)
    if (p.ok) {
      okCount++
      totals = addTotals(totals, p.totals)
    }
  }

  return {
    totals,
    postsConsidered: actionable.length,
    postsSucceeded: okCount,
    warnings: warnings.slice(0, 12),
    wechatExcluded
  }
}

export async function upsertTodayEngagementSnapshot (
  userId: string,
  totals: EngagementTotals
): Promise<void> {
  const M = engagementSnapshotModel()
  if (!M) {
    console.warn(
      '[engagement] 跳过日快照：Prisma Client 中无 userEngagementDailySnapshot。请执行 npx prisma generate 并重启 next dev。'
    )
    return
  }
  const day = utcDayStart(new Date())
  await M.upsert({
    where: {
      userId_day: { userId, day }
    },
    create: {
      userId,
      day,
      views: totals.views,
      comments: totals.comments,
      likes: totals.likes,
      shares: totals.shares
    },
    update: {
      views: totals.views,
      comments: totals.comments,
      likes: totals.likes,
      shares: totals.shares
    }
  })
}

export interface EngagementSeriesPoint {
  label: string
  dayIso: string
  views: number
  comments: number
  likes: number
  shares: number
}

export async function loadEngagementSeriesForUser (
  userId: string,
  days: number
): Promise<EngagementSeriesPoint[]> {
  const end = utcDayStart(new Date())
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (days - 1))

  const M = engagementSnapshotModel()
  const snaps = M
    ? await M.findMany({
        where: {
          userId,
          day: { gte: start, lte: end }
        },
        orderBy: { day: 'asc' }
      })
    : []

  const byDay = new Map(
    snaps.map((s) => [s.day.toISOString().slice(0, 10), s])
  )

  const out: EngagementSeriesPoint[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    const key = d.toISOString().slice(0, 10)
    const s = byDay.get(key)
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    out.push({
      label: `${mm}/${dd}`,
      dayIso: key,
      views: s?.views ?? 0,
      comments: s?.comments ?? 0,
      likes: s?.likes ?? 0,
      shares: s?.shares ?? 0
    })
  }
  return out
}
