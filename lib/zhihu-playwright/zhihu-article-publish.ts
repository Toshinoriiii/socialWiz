/**
 * 知乎「专栏文章」发布（无图）：zhuanlan.zhihu.com/api
 * 对齐 BAIGUANGMEI/zhihu-cli ZhihuClient.create_article 文本路径：
 * POST /articles/drafts → PATCH /articles/{id}/draft → PUT /articles/{id}/publish
 *
 * 配置项：投稿问题（search_v3 首条）、话题（/ 分割最多 3 个，按名搜索）、专栏（/api/columns）、创作声明（disclaimer_type 推测值，以抓包为准）。
 * 封面：api.zhihu.com/images + OSS；轮询结果优先取 pic-private.zhihu.com 链写入 titleImage，
 * 并附带 isTitleImageFullScreen / delta_time / can_reward（与专栏写作台抓包一致）。
 */

import { cookieHeaderForUrl } from '@/lib/weibo-playwright/weibo-storage-cookies'
import { readZhihuPlaywrightStorageCookies } from '@/lib/zhihu-playwright/zhihu-session-cookies'
import { zhihuZhuanlanJsonHeaders } from '@/lib/zhihu-playwright/zhihu-http'
import {
  zhihuResolveColumnPublishValue,
  zhihuSearchFirstQuestionId,
  zhihuSearchTopicIdByName
} from '@/lib/zhihu-playwright/zhihu-publish-resolve'
import { uploadZhihuImageFromBuffer } from '@/lib/zhihu-playwright/zhihu-image-upload'
import { markdownToHtml } from '@/lib/utils/markdown-to-html'
import type {
  ZhihuArticleCreationDeclaration,
  ZhihuPublishConfigData
} from '@/types/platform-config.types'

const WWW_ORIGIN = 'https://www.zhihu.com'
const ZHUANLAN_ORIGIN = 'https://zhuanlan.zhihu.com'
const ZHUANLAN_API = `${ZHUANLAN_ORIGIN}/api`

const REQUIRED_COOKIE_NAMES = ['z_c0', '_xsrf'] as const

function cookieMap (cookies: { name: string; value: string }[]): Map<string, string> {
  return new Map(cookies.map((c) => [c.name, c.value]))
}

function commentPermissionForPublish (
  c: ZhihuPublishConfigData | undefined
): string {
  return c?.articleCommentPermission === 'nobody' ? 'nobody' : 'anyone'
}

/** 创作声明 → 草稿 PATCH；枚举为推测映射，若发文报错请对照浏览器抓包调整。 */
function disclaimerFieldsForDraftPatch (
  d: ZhihuArticleCreationDeclaration | undefined
): Record<string, unknown> {
  if (!d || d === 'none') return {}
  const map: Record<
  Exclude<ZhihuArticleCreationDeclaration, 'none'>,
  number
  > = {
      ai_generated: 1,
      fictional: 2,
      investment: 3,
      medical: 4,
      commercial: 5
    }
  const n = map[d]
  if (n == null) return {}
  return { disclaimer_type: n }
}

function parsePublishedArticleId (data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return
  const d = data as Record<string, unknown>
  const id = d.id ?? d.url_token
  if (id != null) {
    const s = String(id).trim()
    if (s) return s
  }
  return
}

export interface ZhihuArticlePublishResult {
  ok: boolean
  error?: string
  detail?: string
  platformPostId?: string
  publishedUrl?: string
}

function parseTopicLabels (line: string | undefined): string[] {
  if (!line?.trim()) return []
  return line
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
}

export interface ZhihuArticleCoverInput {
  buffer: Buffer
  contentType?: string
}

/**
 * 使用 Playwright 落盘的 storageState 发布一篇专栏文章（正文为 Markdown 或 HTML）。
 * @param coverImage 可选封面，上传至知乎图床并写入草稿 titleImage。
 */
export async function publishZhihuArticleFromSession (
  userId: string,
  title: string,
  bodyMarkdownOrHtml: string,
  zhihuPublishConfig?: ZhihuPublishConfigData,
  coverImage?: ZhihuArticleCoverInput | null
): Promise<ZhihuArticlePublishResult> {
  const cookies = readZhihuPlaywrightStorageCookies(userId)
  if (!cookies?.length) {
    return {
      ok: false,
      error: '未找到知乎会话文件',
      detail: '请先完成「连接知乎（浏览器）」绑定'
    }
  }
  const byName = cookieMap(cookies)
  for (const n of REQUIRED_COOKIE_NAMES) {
    if (!byName.get(n)?.trim()) {
      return {
        ok: false,
        error: '知乎 Cookie 不完整',
        detail: `缺少 ${n}，请重新在浏览器中登录知乎后绑定`
      }
    }
  }
  const xsrf = byName.get('_xsrf') ?? ''
  const cookieHeaderWww = cookieHeaderForUrl(`${WWW_ORIGIN}/`, cookies)
  const cookieHeaderZhuanlan = cookieHeaderForUrl(`${ZHUANLAN_ORIGIN}/`, cookies)
  const cookieHeaderForApiZhihu = cookieHeaderForUrl(
    'https://api.zhihu.com/',
    cookies
  )
  const baseHeaders = {
    ...zhihuZhuanlanJsonHeaders(xsrf),
    Cookie: cookieHeaderZhuanlan
  }

  const trimmedTitle = title.trim()
  if (!trimmedTitle) {
    return { ok: false, error: '文章标题不能为空' }
  }

  const htmlBody = markdownToHtml(bodyMarkdownOrHtml.trim())
  if (!htmlBody.trim()) {
    return { ok: false, error: '正文不能为空' }
  }

  let questionId: string | undefined
  const qKw = zhihuPublishConfig?.articleSubmitToQuestionKeywords?.trim()
  if (qKw) {
    const qr = await zhihuSearchFirstQuestionId(qKw, cookieHeaderWww, xsrf)
    if (!qr.ok) {
      return { ok: false, error: qr.error, detail: qr.detail }
    }
    questionId = qr.id
  }

  const topicLabels = parseTopicLabels(zhihuPublishConfig?.articleTopicsLine)
  const topicIds: string[] = []
  for (const label of topicLabels) {
    const tid = await zhihuSearchTopicIdByName(label, cookieHeaderWww, xsrf)
    if (tid) topicIds.push(tid)
  }

  let columnPublish: string | null = null
  const colName = zhihuPublishConfig?.zhuanlanColumnName?.trim()
  if (colName) {
    const col = await zhihuResolveColumnPublishValue(
      colName,
      cookieHeaderZhuanlan,
      xsrf
    )
    if (!col.ok) {
      return { ok: false, error: col.error, detail: col.detail }
    }
    columnPublish = col.column
  }

  let draftId: string
  try {
    const draftRes = await fetch(`${ZHUANLAN_API}/articles/drafts`, {
      method: 'POST',
      headers: {
        ...baseHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })
    const draftText = await draftRes.text()
    if (draftRes.status === 401) {
      return {
        ok: false,
        error: '知乎登录已失效',
        detail: '请重新绑定浏览器会话'
      }
    }
    if (!draftRes.ok) {
      return {
        ok: false,
        error: `创建文章草稿失败（HTTP ${draftRes.status}）`,
        detail: draftText.slice(0, 500)
      }
    }
    let draftJson: unknown
    try {
      draftJson = JSON.parse(draftText) as Record<string, unknown>
    } catch {
      return {
        ok: false,
        error: '创建草稿返回非 JSON',
        detail: draftText.slice(0, 300)
      }
    }
    const dj = draftJson as { id?: string }
    draftId = String(dj.id ?? '').trim()
    if (!draftId) {
      return {
        ok: false,
        error: '创建草稿未返回 id',
        detail: draftText.slice(0, 400)
      }
    }
  } catch (e) {
    return {
      ok: false,
      error: '创建草稿请求失败',
      detail: e instanceof Error ? e.message.slice(0, 400) : String(e)
    }
  }

  const patchBody: Record<string, unknown> = {
    title: trimmedTitle.slice(0, 200),
    content: htmlBody,
    ...disclaimerFieldsForDraftPatch(
      zhihuPublishConfig?.articleCreationDeclaration
    )
  }
  if (topicIds.length) {
    patchBody.topics = topicIds
  }
  if (questionId) {
    patchBody.question = questionId
  }

  if (coverImage?.buffer && coverImage.buffer.length > 0) {
    const up = await uploadZhihuImageFromBuffer({
      imageBytes: coverImage.buffer,
      cookieHeaderForApiZhihu,
      xsrf,
      source: 'article'
    })
    if (!up.ok) {
      return { ok: false, error: up.error, detail: up.detail }
    }
    patchBody.titleImage = up.info.src
    patchBody.isTitleImageFullScreen = false
    patchBody.delta_time = 0
    patchBody.can_reward = false
  }

  const patchDraftOnce = async (
    body: Record<string, unknown>
  ): Promise<{ ok: boolean; status: number; text: string }> => {
    const patchRes = await fetch(
      `${ZHUANLAN_API}/articles/${encodeURIComponent(draftId)}/draft`,
      {
        method: 'PATCH',
        headers: {
          ...baseHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    )
    const patchText = await patchRes.text()
    if (patchRes.status === 401) {
      return { ok: false, status: patchRes.status, text: patchText }
    }
    if (patchRes.status !== 200 && patchRes.status !== 204) {
      return { ok: false, status: patchRes.status, text: patchText }
    }
    return { ok: true, status: patchRes.status, text: patchText }
  }

  try {
    let patchResult = await patchDraftOnce(patchBody)
    if (
      !patchResult.ok &&
      patchResult.status !== 401 &&
      coverImage?.buffer &&
      typeof patchBody.titleImage === 'string'
    ) {
      const alt: Record<string, unknown> = { ...patchBody }
      const url = alt.titleImage
      const delta = alt.delta_time
      const reward = alt.can_reward
      delete alt.titleImage
      delete alt.isTitleImageFullScreen
      delete alt.delta_time
      delete alt.can_reward
      alt.title_image = url
      alt.is_title_image_full_screen = false
      if (delta !== undefined) alt.delta_time = delta
      if (reward !== undefined) alt.can_reward = reward
      patchResult = await patchDraftOnce(alt)
    }
    if (!patchResult.ok) {
      if (patchResult.status === 401) {
        return {
          ok: false,
          error: '知乎登录已失效',
          detail: '请重新绑定浏览器会话'
        }
      }
      return {
        ok: false,
        error: `保存草稿失败（HTTP ${patchResult.status}）`,
        detail: patchResult.text.slice(0, 500)
      }
    }
  } catch (e) {
    return {
      ok: false,
      error: '保存草稿请求失败',
      detail: e instanceof Error ? e.message.slice(0, 400) : String(e)
    }
  }

  const publishBody = {
    column: columnPublish,
    commentPermission: commentPermissionForPublish(zhihuPublishConfig)
  }

  try {
    const pubRes = await fetch(
      `${ZHUANLAN_API}/articles/${encodeURIComponent(draftId)}/publish`,
      {
        method: 'PUT',
        headers: {
          ...baseHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(publishBody)
      }
    )
    const pubText = await pubRes.text()
    if (pubRes.status === 401) {
      return {
        ok: false,
        error: '知乎登录已失效',
        detail: '请重新绑定浏览器会话'
      }
    }
    if (!pubRes.ok) {
      return {
        ok: false,
        error: `发布失败（HTTP ${pubRes.status}）`,
        detail: pubText.slice(0, 600)
      }
    }
    let pubJson: unknown
    try {
      pubJson = pubText.trim() ? JSON.parse(pubText) : {}
    } catch {
      return {
        ok: false,
        error: '发布接口返回非 JSON',
        detail: pubText.slice(0, 400)
      }
    }
    const platformPostId =
      parsePublishedArticleId(pubJson) ?? draftId
    const publishedUrl = `https://zhuanlan.zhihu.com/p/${platformPostId}`
    return { ok: true, platformPostId, publishedUrl }
  } catch (e) {
    return {
      ok: false,
      error: '发布请求失败',
      detail: e instanceof Error ? e.message.slice(0, 400) : String(e)
    }
  }
}
