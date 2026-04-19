/**
 * 微博内部 ID：`1022:230940…` 类 object_id 若被压成纯数字会变成 1022230940…，
 * 既不能用于 ajax/statuses/show，也会导致时间线匹配失败。集中做识别与剥离。
 */

/** 合并形态：1022 + 18～28 位头条/文章 object_id 数字 */
export function digitStringIsMerged1022ArticleBlob (raw: string): boolean {
  const d = raw.replace(/\D/g, '')
  return (
    d.startsWith('1022') &&
    d.length >= 22 &&
    /^\d{18,28}$/.test(d.slice(4))
  )
}

/**
 * 时间线反查、创作者接口等使用的 object_id 数字（去掉错误的 1022 前缀粘连）。
 */
export function normalizeWeiboArticleOidDigitsForLookup (raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (digitStringIsMerged1022ArticleBlob(d)) return d.slice(4)
  const m = raw.trim().match(/^1022:(\d{10,40})$/i)
  if (m?.[1]) return m[1]
  return d
}
