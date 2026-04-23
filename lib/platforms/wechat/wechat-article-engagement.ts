/**
 * 微信公众号单篇互动：**仅**通过运营后台会话请求 `appmsgpublish`（`publish_page` → `appmsg_info[]`），
 * 与浏览器里「发表记录」列表接口同源；**从不**请求 `https://mp.weixin.qq.com/s/...` 正文（C 端页与互动口径无关，且常环境异常/验证）。
 *
 * `publishedUrl` 只用于从路径里取出 **sn**（`/s/` 后段），与列表里 `content_url` 的 sn 对齐；**不是**去抓该 URL 的页面。
 * 需本机已绑定 mp 运营后台浏览器会话。`wechatConfigId` 仅结构兼容。
 */
import {
  fetchWechatMpArticleInsightViaSession,
  normalizeWechatPlatformContentIdForListMatch
} from '@/lib/wechat-playwright/wechat-mp-session-publish-insights'
import { wechatPlaywrightSessionExists } from '@/lib/wechat-playwright/session-files'

export interface WechatArticleEngagementTotals {
  views: number
  comments: number
  likes: number
  shares: number
  collections?: number
}

export interface FetchWechatArticleEngagementInput {
  userId: string
  /** 保留与发布记录结构一致；本模块不用于拉数 */
  wechatConfigId: string | null
  publishedUrl: string | null | undefined
  title: string
  /** 与发表记录中 appmsgid / copy_appmsg_id 等一致时优先命中，不依赖 sn */
  platformContentId?: string | null
}

function toTotals (d: {
  views: number
  comments: number
  likes: number
  shares: number
  collections?: number
}): WechatArticleEngagementTotals {
  return {
    views: d.views,
    comments: d.comments,
    likes: d.likes,
    shares: d.shares,
    collections: d.collections ?? 0
  }
}

/**
 * 数据概览 / 内容分析 / 发布任务 insights：仅 MP 运营后台会话路径。
 */
export async function fetchWechatArticleEngagementMetrics (
  input: FetchWechatArticleEngagementInput
): Promise<
  | { ok: true; data: WechatArticleEngagementTotals }
  | { ok: false; warn: string }
> {
  const { userId, publishedUrl, title, platformContentId } = input
  const titleTrim = title.trim()
  const idForMatch = normalizeWechatPlatformContentIdForListMatch(
    platformContentId
  )
  if (!titleTrim && !idForMatch) {
    return {
      ok: false,
      warn: '微信发布记录缺少作品标题或图文物料（平台）ID，无法匹配发表记录中的统计'
    }
  }

  if (!wechatPlaywrightSessionExists(userId)) {
    return {
      ok: false,
      warn:
        '微信公众号数据需从公众平台**运营后台**（发表记录 / 内容分析）拉取，请先完成「连接微信（本机浏览器）」登录 mp.weixin.qq.com。'
    }
  }

  const r = await fetchWechatMpArticleInsightViaSession(userId, {
    publishedUrl,
    title: titleTrim,
    platformContentId
  })

  if (!r.ok) {
    return {
      ok: false,
      warn: `微信（公众平台后台）${r.error}`
    }
  }

  return { ok: true, data: toTotals(r.data) }
}
