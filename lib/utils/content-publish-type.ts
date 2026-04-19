/**
 * 发布页 / 作品列表共用的「文章 vs 图文」判定（与无 contentType 的旧草稿推断一致）。
 */

export function effectivePublishContentTypeFromRecord (c: {
  contentType?: string | null
  images?: string[] | null
  coverImage?: string | null
}): 'article' | 'image-text' {
  const raw = (c.contentType ?? '').trim()
  if (raw === 'image-text') return 'image-text'
  if (raw === 'article') return 'article'

  const hasCoverImage = !!(c.coverImage && String(c.coverImage).trim())
  const hasImages =
    Array.isArray(c.images) &&
    c.images.some((s) => typeof s === 'string' && s.trim().length > 0)
  if (hasImages && !hasCoverImage) return 'image-text'
  return 'article'
}
