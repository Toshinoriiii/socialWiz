import { digitStringIsMerged1022ArticleBlob } from '@/lib/weibo-playwright/weibo-internal-ids'

/** m.weibo.cn / 开放接口常见 mid 长度会超过 25 位，上限放宽避免误判 */
const WEIBO_POST_ID_DIGITS_RE = /^\d{5,40}$/

/** PC 单帖 URL 第二段除纯数字外，也常见 Base62 型（如 `QC9ST4NQk`） */
const WEIBO_MID_PATH_SEGMENT = /^[0-9A-Za-z_\-]{4,32}$/

/**
 * 从接口字段中取出单帖 id 段：纯数字 **mid** 或 **Base62 slug**；勿对 slug 做「只保留数字」处理。
 */
export function normalizeWeiboMblogIdSegment (v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  if (WEIBO_MID_PATH_SEGMENT.test(s)) {
    if (/[A-Za-z]/.test(s)) return s
    if (WEIBO_POST_ID_DIGITS_RE.test(s)) return s
    return s.length >= 5 ? s : null
  }
  const digits = s.replace(/\D/g, '')
  if (WEIBO_POST_ID_DIGITS_RE.test(digits)) return digits
  return null
}

/**
 * 从平台 contentId/URL/原始串中解析**帖 id**（数字或 Base62，支持 `weibo.com/uid/xxx` 两种末段形态）。
 */
export function normalizeWeiboStatusPostId (
  raw: string | null | undefined
): string | null {
  if (raw == null) return null
  const t = String(raw).trim()
  if (!t) return null
  const fromPc = t.match(
    /(?:www\.)?(?:weibo\.com|weibo\.cn)\/\d+\/(\d{5,40})(?:\?|#|$|\/)/i
  )
  if (fromPc?.[1]) return fromPc[1]
  const fromPcSlug = t.match(
    /(?:www\.)?(?:weibo\.com|weibo\.cn)\/\d+\/([0-9A-Za-z_\-]{4,32})(?:\?|#|$|\/)/i
  )
  if (fromPcSlug?.[1] && /[A-Za-z]/.test(fromPcSlug[1])) {
    return fromPcSlug[1]
  }
  const fromM = t.match(/m\.weibo\.cn\/status\/(\d{5,40})(?:\?|#|$|\/)/i)
  if (fromM?.[1]) return fromM[1]
  const fromMslug = t.match(
    /m\.weibo\.cn\/status\/([0-9A-Za-z_\-]{4,32})(?:\?|#|$|\/)/i
  )
  if (fromMslug?.[1] && /[A-Za-z]/.test(fromMslug[1])) {
    return fromMslug[1]
  }
  /** 头条展示页 ?id= 为 object_id，与 timelines mid 不同，不可用于 statuses/show */
  if (/\/ttarticle\/p\/show/i.test(t) && /[?&]id=\d+/i.test(t)) {
    return null
  }
  const slugOnly = normalizeWeiboMblogIdSegment(t)
  if (slugOnly && /[A-Za-z]/.test(slugOnly)) return slugOnly
  const digits = t.replace(/\D/g, '')
  if (!WEIBO_POST_ID_DIGITS_RE.test(digits)) return null
  /** 1022 与 object_id 去分隔符后粘连成的串，不是时间线 mid，不能用于 statuses/show */
  if (digitStringIsMerged1022ArticleBlob(digits)) return null
  return digits
}

/**
 * PC 端微博单帖 URL：`https://weibo.com/{博主uid}/{帖 mid 或 Base62 段}`，
 * 第二段为纯数字**或**如 `QC9ST4NQk` 的字母数字 slug。
 */
export function weiboProfileStatusUrl (weiboUid: string, postId: string): string {
  const uid = weiboUid.replace(/\D/g, '')
  const mid = postId.replace(/\D/g, '') || postId.trim()
  return `https://weibo.com/${uid}/${mid}`
}

/** 发布记录应保留头条展示页 URL，不要改成个人主页下的时间线帖链接 */
export function isWeiboTtarticlePublishedUrl (
  url: string | null | undefined
): boolean {
  if (!url?.trim()) return false
  return /\/ttarticle\/p\/show/i.test(url) && /[?&]id=\d+/i.test(url)
}

export function normalizeWeiboSessionPublishMeta (
  weiboUid: string | null | undefined,
  platformPostId: string | null | undefined,
  publishedUrl: string | null | undefined
): { platformPostId: string | null; publishedUrl: string | null } {
  const uid = weiboUid?.replace(/\D/g, '') ?? ''
  let pid =
    normalizeWeiboStatusPostId(platformPostId) ||
    normalizeWeiboStatusPostId(publishedUrl) ||
    null

  let url = publishedUrl?.trim() || null
  const canCanonicalPc =
    pid != null &&
    (WEIBO_POST_ID_DIGITS_RE.test(pid) || /^[0-9A-Za-z_\-]{4,32}$/.test(pid))
  if (uid && pid && canCanonicalPc && !isWeiboTtarticlePublishedUrl(url)) {
    url = weiboProfileStatusUrl(uid, pid)
  }
  return { platformPostId: pid, publishedUrl: url }
}
