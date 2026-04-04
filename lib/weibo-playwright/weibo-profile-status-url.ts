/**
 * PC 端微博单帖 URL：`https://weibo.com/{博主uid}/{帖mid或idstr}`，
 * 末尾数字段即为时间线帖 id，可用于 m.weibo.cn statuses/show 等。
 */
export function weiboProfileStatusUrl (weiboUid: string, postId: string): string {
  const uid = weiboUid.replace(/\D/g, '')
  const mid = postId.replace(/\D/g, '') || postId.trim()
  return `https://weibo.com/${uid}/${mid}`
}

export function normalizeWeiboSessionPublishMeta (
  weiboUid: string | null | undefined,
  platformPostId: string | null | undefined,
  publishedUrl: string | null | undefined
): { platformPostId: string | null; publishedUrl: string | null } {
  const uid = weiboUid?.replace(/\D/g, '') ?? ''
  let pid = platformPostId?.trim() || null
  const pidDigits = pid ? pid.replace(/\D/g, '') : ''
  if (pidDigits.length >= 5) pid = pidDigits

  let url = publishedUrl?.trim() || null
  if (uid && pid && /^\d{5,25}$/.test(pid)) {
    url = weiboProfileStatusUrl(uid, pid)
  }
  return { platformPostId: pid, publishedUrl: url }
}
