/**
 * 微博浏览器发博：与发布页 draftEffectivePublishContentType 对齐，并处理无 contentType 的旧数据，
 * 避免多图作品误走头条文章（card v5）导致「图文发不出去」。
 */

export function effectiveWeiboContentTypeFromRecord (c: {
  contentType?: string | null
  images?: string[] | null
  coverImage?: string | null
}): 'article' | 'image-text' {
  const raw = (c.contentType ?? '').trim()
  if (raw === 'image-text') return 'image-text'
  if (raw === 'article') return 'article'

  const nImg = c.images?.length ?? 0
  const hasCover = !!(c.coverImage && String(c.coverImage).trim())
  // 未显式标注时：多图更符合信息流组图；仅配图无封面亦属图文常见形态
  if (nImg >= 2) return 'image-text'
  if (nImg > 0 && !hasCover) return 'image-text'
  return 'article'
}

/** 有配图时允许正文为空（微博仍需要可见字符时由调用方兜底） */
export function weiboPublishBodyTextFallback (params: {
  text: string
  imageUrls?: string[] | null | undefined
  title?: string | null | undefined
}): string {
  const t = params.text.trim()
  if (t) return t
  const hasImg = (params.imageUrls?.length ?? 0) > 0
  if (!hasImg) return ''
  return (params.title?.trim() || '分享图片').slice(0, 20_000)
}
