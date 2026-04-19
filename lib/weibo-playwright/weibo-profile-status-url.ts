import { digitStringIsMerged1022ArticleBlob } from '@/lib/weibo-playwright/weibo-internal-ids'

/** m.weibo.cn / 开放接口常见 mid 长度会超过 25 位，上限放宽避免误判 */
const WEIBO_POST_ID_DIGITS_RE = /^\d{5,40}$/

/**
 * 从发布记录里的原始串解析可用于 statuses/show 的数字 mid（支持整段 URL）。
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
  const fromM = t.match(/m\.weibo\.cn\/status\/(\d{5,40})(?:\?|#|$|\/)/i)
  if (fromM?.[1]) return fromM[1]
  /** 头条展示页 ?id= 为 object_id，与 timelines mid 不同，不可用于 statuses/show */
  if (/\/ttarticle\/p\/show/i.test(t) && /[?&]id=\d+/i.test(t)) {
    return null
  }
  const digits = t.replace(/\D/g, '')
  if (!WEIBO_POST_ID_DIGITS_RE.test(digits)) return null
  /** 1022 与 object_id 去分隔符后粘连成的串，不是时间线 mid，不能用于 statuses/show */
  if (digitStringIsMerged1022ArticleBlob(digits)) return null
  return digits
}

/**
 * PC 端微博单帖 URL：`https://weibo.com/{博主uid}/{帖mid或idstr}`，
 * 末尾数字段即为时间线帖 id，可用于 m.weibo.cn statuses/show 等。
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
  if (
    uid &&
    pid &&
    WEIBO_POST_ID_DIGITS_RE.test(pid) &&
    !isWeiboTtarticlePublishedUrl(url)
  ) {
    url = weiboProfileStatusUrl(uid, pid)
  }
  return { platformPostId: pid, publishedUrl: url }
}
