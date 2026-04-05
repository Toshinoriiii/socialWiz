import {
  tryPublishWeiboTextViaWebAjax,
  type WeiboWebPublishOptions
} from '@/lib/weibo-playwright/weibo-web-publish'

/** 与 tryPublishWeiboTextViaWebAjax 中长微博上限大致一致 */
const MAX_TEXT = 20_000

export interface WeiboComposeStartResult {
  ok: boolean
  error?: string
  detail?: string
  hint?: string
  platformPostId?: string
  publishedUrl?: string
}

/**
 * 微博会话发博：HTTP 复现（普通帖 aj/mblog/add；头条文章 card.weibo saveorupdate），不启动 Chromium compose。
 */
export async function startWeiboPlaywrightComposeProcess (
  userId: string,
  text: string,
  publishOptions?: WeiboWebPublishOptions
): Promise<WeiboComposeStartResult> {
  const urlCount = publishOptions?.imageUrls?.filter(Boolean).length ?? 0
  let trimmed = text.trim()
  if (!trimmed && urlCount > 0) {
    trimmed =
      publishOptions?.title?.trim() ||
      '分享图片'
  }
  if (!trimmed) {
    return { ok: false, error: 'text 不能为空' }
  }
  if (trimmed.length > MAX_TEXT) {
    return { ok: false, error: `正文不超过 ${MAX_TEXT} 字` }
  }

  const r = await tryPublishWeiboTextViaWebAjax(userId, trimmed, publishOptions)
  if (r.ok) {
    return {
      ok: true,
      platformPostId: r.platformPostId,
      publishedUrl: r.publishedUrl,
      hint: r.publishedUrl
        ? undefined
        : '请求已成功，若时间线无帖请核对 Cookie / 接口是否变更'
    }
  }
  const isArticle = publishOptions?.contentType === 'article'
  return {
    ok: false,
    error: r.error,
    detail: r.detail,
    hint: isArticle
      ? '头条文章走 card v5 草稿链路（draft/save + draft/publish），与普通微博不同。失败请重新绑定会话或对照 weibo-headline-article-publish.ts。'
      : '请重新绑定会话或抓包核对 aj/mblog/add 参数'
  }
}
