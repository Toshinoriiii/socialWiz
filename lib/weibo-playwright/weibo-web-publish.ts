import { readWeiboPlaywrightProfile } from '@/lib/weibo-playwright/session-files'
import {
  loadImagePartForWeibo,
  uploadWeiboImagesAsPicIdString,
  type ImagePart
} from '@/lib/weibo-playwright/weibo-web-pic-upload'
import {
  cookieHeaderForUrl,
  readWeiboPlaywrightStorageCookies
} from '@/lib/weibo-playwright/weibo-storage-cookies'
import {
  extractXsrfFromHtml,
  fetchWeiboHomeHtml,
  resolveXsrf,
  xsrfTokenFromCookies
} from '@/lib/weibo-playwright/weibo-xsrf'
import { resolveMblogMetaFromProfileTimeline } from '@/lib/weibo-playwright/weibo-mblog-meta-resolve'
import { normalizeWeiboMblogIdSegment } from '@/lib/weibo-playwright/weibo-profile-status-url'
import { isWeiboArticleNumericObjectId } from '@/lib/weibo-playwright/weibo-status-cookie'
import {
  tryPublishWeiboHeadlineArticle,
  type WeiboHeadlinePublishInput
} from '@/lib/weibo-playwright/weibo-headline-article-publish'
import type {
  WeiboPublishConfigData,
  WeiboVisibilityLevel
} from '@/types/platform-config.types'
import { stripMarkdownFromTitle } from '@/lib/utils/strip-markdown-title'

function pickWeiboHeadlinePublish (
  cfg: WeiboPublishConfigData | undefined
): WeiboHeadlinePublishInput | undefined {
  if (!cfg || cfg.type !== 'weibo') return undefined
  return {
    articleColumnName: cfg.articleColumnName,
    articleFollowersOnlyFullText: cfg.articleFollowersOnlyFullText,
    articleContentDeclaration: cfg.articleContentDeclaration,
    articleWeiboStatusText: cfg.articleWeiboStatusText
  }
}

/** aj/mblog/add 常见 visible：公开不传；仅自己 1；好友圈 10（以抓包为准） */
function weiboFeedVisibleParam (
  v: WeiboVisibilityLevel | undefined
): string | undefined {
  if (!v || v === 'public') return undefined
  if (v === 'self') return '1'
  if (v === 'friends') return '10'
  return undefined
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** 帖 id / mid：与 {@link normalizeWeiboMblogIdSegment} 一致，支持 Base62 末段 */
function normalizeMblogId (v: unknown): string | null {
  return normalizeWeiboMblogIdSegment(v)
}

function extractPostMeta (
  j: Record<string, unknown>,
  fallbackWeiboUid: string
): { platformPostId: string; publishedUrl: string } | null {
  let idstr: string | undefined
  let bloggerUid: string | undefined

  const fromMblog = (mblog: Record<string, unknown>) => {
    const n = normalizeMblogId(mblog.idstr ?? mblog.mid ?? mblog.id)
    if (n) idstr = n
    const u = mblog.user
    if (u && typeof u === 'object') {
      const uo = u as Record<string, unknown>
      const uid = uo.idstr ?? uo.id
      if (uid != null) bloggerUid = String(uid).replace(/\D/g, '')
    }
  }

  let data: unknown = j.data
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data) as unknown
    } catch {
      data = undefined
    }
  }
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    const top = normalizeMblogId(d.idstr ?? d.mid ?? d.id)
    if (top) {
      idstr = top
      const u = d.user
      if (u && typeof u === 'object') {
        const uo = u as Record<string, unknown>
        const uid = uo.idstr ?? uo.id
        if (uid != null) bloggerUid = String(uid).replace(/\D/g, '')
      }
    }
    for (const key of ['mblog', 'status', 'ret', 'feed']) {
      const o = d[key]
      if (o && typeof o === 'object') fromMblog(o as Record<string, unknown>)
    }
  }

  /**
   * 图文 / 新版接口可能把 mblog 嵌在 data 深层或 `st` 等字段，仅扫固定 key 会拿不到 id。
   * 在「明面」解析失败后，对整棵 JSON 做一次浅深限制的全树扫描，找含 idstr+user 的节点。
   */
  if (!idstr) {
    const deep = deepPluckMblogMetaFromObject(j, fallbackWeiboUid, 0)
    if (deep) return deep
  }

  if (!idstr) return null
  const uid = (bloggerUid || fallbackWeiboUid || '').replace(/\D/g, '')
  const publishedUrl = uid
    ? `https://weibo.com/${uid}/${idstr}`
    : `https://weibo.com/detail/${idstr}`
  return { platformPostId: idstr, publishedUrl }
}

const DEEP_Mblog_MAX = 12

function deepPluckMblogMetaFromObject (
  node: unknown,
  fallbackWeiboUid: string,
  depth: number
): { platformPostId: string; publishedUrl: string } | null {
  if (depth > DEEP_Mblog_MAX || node == null) return null
  if (Array.isArray(node)) {
    for (const x of node) {
      const r = deepPluckMblogMetaFromObject(x, fallbackWeiboUid, depth + 1)
      if (r) return r
    }
    return null
  }
  if (typeof node !== 'object') return null
  const o = node as Record<string, unknown>
  const mid = normalizeMblogId(o.idstr ?? o.mid ?? o.id)
  let uDigits: string | undefined
  const u = o.user
  if (u && typeof u === 'object') {
    const uo = u as Record<string, unknown>
    const uid = uo.idstr ?? uo.id
    if (uid != null) uDigits = String(uid).replace(/\D/g, '')
  }
  if (mid && uDigits && /^\d{5,20}$/.test(uDigits)) {
    return {
      platformPostId: mid,
      publishedUrl: `https://weibo.com/${uDigits}/${mid}`
    }
  }
  const looksLikeMblog =
    typeof o.text === 'string' ||
    o.source != null ||
    o.created_at != null ||
    o.mblogid != null ||
    o.isLongText != null
  if (
    mid &&
    !uDigits &&
    looksLikeMblog &&
    fallbackWeiboUid.replace(/\D/g, '')
  ) {
    const uid = fallbackWeiboUid.replace(/\D/g, '')
    return {
      platformPostId: mid,
      publishedUrl: `https://weibo.com/${uid}/${mid}`
    }
  }
  for (const v of Object.values(o)) {
    const r = deepPluckMblogMetaFromObject(v, fallbackWeiboUid, depth + 1)
    if (r) return r
  }
  return null
}

/** 接口 JSON 结构多变时的兜底：从原始字符串里抠 idstr/mid（不用 object_id，避免误作时间线 mid） */
function metaFromRawResponseText (
  raw: string,
  fallbackWeiboUid: string
): { platformPostId: string; publishedUrl: string } | null {
  for (const p of [
    /"idstr"\s*:\s*"([0-9A-Za-z_\-]+)"/,
    /"mid"\s*:\s*"([0-9A-Za-z_\-]+)"/,
    /"mblogid"\s*:\s*"([0-9A-Za-z_\-]+)"/i,
    /"bid"\s*:\s*"([0-9A-Za-z_\-]+)"/i,
    /"idstr"\s*:\s*"?(\d{8,})"?/,
    /"mid"\s*:\s*"?(\d{8,})"?/
  ]) {
    const m = raw.match(p)
    if (!m?.[1]) continue
    const idRaw = m[1]
    if (/^\d+$/.test(idRaw)) {
      const idDigits = idRaw.replace(/\D/g, '')
      if (isWeiboArticleNumericObjectId(idDigits)) continue
      const idstr = idDigits
      const uid = fallbackWeiboUid.replace(/\D/g, '')
      const publishedUrl = uid
        ? `https://weibo.com/${uid}/${idstr}`
        : `https://weibo.com/detail/${idstr}`
      return { platformPostId: idstr, publishedUrl }
    }
    if (/[A-Za-z]/.test(idRaw) && /^[0-9A-Za-z_\-]{4,32}$/.test(idRaw)) {
      const uid = fallbackWeiboUid.replace(/\D/g, '')
      const publishedUrl = uid
        ? `https://weibo.com/${uid}/${idRaw}`
        : `https://weibo.com/detail/${idRaw}`
      return { platformPostId: idRaw, publishedUrl }
    }
  }
  return null
}

/**
 * 发博接口偶把链接嵌在长 JSON 的其它字段、或 `https:\\/\\/weibo.com\\/…` 转义里，
 * 不做结构解析时直接扫**整段**报文体，能抠出与 {@link extractPostMeta} 同形的链接。
 */
function pluckMblogFromAddResponseLoose (
  raw: string,
  fallbackWeiboUid: string
): { platformPostId: string; publishedUrl: string } | null {
  const s = raw.replace(/\\\//g, '/')
  const m = s.match(
    /https?:\/\/(?:www\.)?weibo\.com\/(\d{5,20})\/([0-9A-Za-z_\-]{4,32})(?=[\s"'}\],#?]|$)/i
  )
  if (m?.[1] && m[2]) {
    return {
      platformPostId: m[2],
      publishedUrl: `https://weibo.com/${m[1]}/${m[2]}`
    }
  }
  const uid0 = fallbackWeiboUid.replace(/\D/g, '')
  if (uid0) {
    const m2 = s.match(
      new RegExp(
        `weibo\\.com\\/${uid0}\\/([0-9A-Za-z_\\-]{4,32})(?=[\\s"'#?},\\]]|$)`,
        'i'
      )
    )
    if (m2?.[1]) {
      const seg = m2[1]
      return {
        platformPostId: seg,
        publishedUrl: `https://weibo.com/${uid0}/${seg}`
      }
    }
  }
  return null
}

async function finalizePublishMeta (
  userId: string,
  wbUid: string,
  bodyText: string,
  meta: { platformPostId: string; publishedUrl: string } | undefined
): Promise<{ platformPostId?: string; publishedUrl?: string }> {
  let platformPostId = meta?.platformPostId
  let publishedUrl = meta?.publishedUrl
  const uid = wbUid.replace(/\D/g, '')
  if (platformPostId && !publishedUrl && uid) {
    publishedUrl = `https://weibo.com/${uid}/${platformPostId}`
  }
  if (platformPostId && publishedUrl) {
    return { platformPostId, publishedUrl }
  }
  if (!wbUid) {
    return { platformPostId, publishedUrl }
  }
  /** 图文/长微博接口偶晚于时间线索引，略加长再拉 m 站首页，提高兜底命中率 */
  await new Promise((r) => setTimeout(r, 1100))
  let recovered = await resolveMblogMetaFromProfileTimeline(
    userId,
    wbUid,
    bodyText
  )
  if (recovered) {
    platformPostId = platformPostId ?? recovered.platformPostId
    publishedUrl = publishedUrl ?? recovered.publishedUrl
  }
  if (!platformPostId && !publishedUrl) {
    await new Promise((r) => setTimeout(r, 1500))
    recovered = await resolveMblogMetaFromProfileTimeline(
      userId,
      wbUid,
      bodyText
    )
    if (recovered) {
      platformPostId = platformPostId ?? recovered.platformPostId
      publishedUrl = publishedUrl ?? recovered.publishedUrl
    }
  }
  return { platformPostId, publishedUrl }
}

function parseAjMblogAddResponse (
  text: string,
  fallbackWeiboUid: string
): {
  ok: boolean
  msg?: string
  meta?: { platformPostId: string; publishedUrl: string }
} {
  const t = text.trim()
  if (!t) return { ok: false, msg: '(空响应)' }
  try {
    const j = JSON.parse(t) as Record<string, unknown>
    const code = j.code
    let ok = false
    if (code === '100000' || code === 100000) ok = true
    else if (j.ok === 1 || j.ok === '1') ok = true
    else if (j.retcode === 0 || j.retcode === '0' || j.retcode === 20000000) {
      ok = true
    } else {
      const data = j.data
      if (data && typeof data === 'object') {
        const d = data as Record<string, unknown>
        if (d.ok === 1 || d.ok === '1' || d.success === true) ok = true
      }
    }
    if (!ok) {
      const msg = [j.msg, j.message, j.error]
        .filter((x) => typeof x === 'string')
        .join(' — ')
      return {
        ok: false,
        msg: msg || JSON.stringify(j).slice(0, 400)
      }
    }
    const meta =
      extractPostMeta(j, fallbackWeiboUid) ??
      metaFromRawResponseText(t, fallbackWeiboUid) ??
      pluckMblogFromAddResponseLoose(t, fallbackWeiboUid) ??
      undefined
    return { ok: true, meta }
  } catch {
    return { ok: false, msg: t.slice(0, 400) }
  }
}

function buildBaseHeaders (
  cookieHeader: string,
  xsrf: string | null
): Record<string, string> {
  const h: Record<string, string> = {
    Cookie: cookieHeader,
    Referer: 'https://weibo.com/',
    Origin: 'https://weibo.com',
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json, text/plain, */*',
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': UA
  }
  if (xsrf) {
    h['X-Xsrf-Token'] = xsrf
  }
  return h
}

type BodyVariant = Record<string, string>

function bodyVariants (
  text: string,
  wbUid: string,
  extras?: {
    picId?: string
    isLongtext?: boolean
    visible?: string
    mblogStatement?: string
  }
): BodyVariant[] {
  const locHome = wbUid ? `page_100505_${wbUid}_home` : 'home'
  const locIssue = wbUid ? `page_100505_${wbUid}_home` : 'home'
  const base: BodyVariant = {
    text,
    style_type: '1',
    rank: '0',
    rankid: '',
    sync_mblog: '1',
    is_pos: '0'
  }
  if (extras?.picId) {
    base.pic_id = extras.picId
  }
  if (extras?.isLongtext) {
    base.is_longtext = '1'
  }
  if (extras?.visible) {
    base.visible = extras.visible
  }
  if (extras?.mblogStatement != null && extras.mblogStatement !== '') {
    base.mblog_statement = extras.mblogStatement
  }
  return [
    {
      ...base,
      pub_type: 'dialog',
      pub_source: 'main_',
      module: 'stissue',
      location: locHome
    },
    {
      ...base,
      pub_type: 'feed',
      pub_source: 'main_',
      module: 'stissue',
      location: locIssue
    },
    {
      ...base,
      pub_type: 'dialog',
      pub_source: 'main_',
      module: 'miniblog',
      location: locHome,
      _t: '0'
    },
    {
      ...base,
      pub_type: 'dialog',
      pub_source: '',
      module: 'stissue',
      location: 'home'
    }
  ]
}

async function postMblogAdd (
  ajwvr: string,
  cookieHeader: string,
  xsrf: string | null,
  fields: BodyVariant
): Promise<{ status: number; raw: string }> {
  const url = `https://weibo.com/aj/mblog/add?ajwvr=${ajwvr}&__rnd=${Date.now()}`
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(fields)) {
    body.set(k, v)
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: buildBaseHeaders(cookieHeader, xsrf),
    body: body.toString(),
    cache: 'no-store'
  })
  const raw = await res.text()
  return { status: res.status, raw }
}

export type WeiboWebPublishResult =
  | { ok: true; platformPostId?: string; publishedUrl?: string }
  | { ok: false; error: string; detail?: string }

export type WeiboWebPublishOptions = {
  /** 可下载的图片 URL，服务端拉取后上传图床 */
  imageUrls?: string[]
  /**
   * 头条文章封面：与 imageUrls 首图二选一优先（统一发布 multipart 传入）。
   * 可避免服务端再 HTTP 拉 /content-images 失败导致无封面。
   */
  coverImagePart?: ImagePart
  /** 已上传的 pic_id，多张用 | 连接 */
  picId?: string
  /** 长文/图文标题，会加在正文前 */
  title?: string
  /** image-text：信息流图文；article：头条文章（card.weibo HTML 编辑器接口） */
  contentType?: string
  /** 平台发布配置（会话发博时生效） */
  weiboPublishConfig?: WeiboPublishConfigData
}

/**
 * Cookie 会话下发博。
 * - `contentType !== article`：信息流 `aj/mblog/add` + 可选图床。
 * - `contentType === article`：仅 card 域头条文章保存接口（Markdown→HTML）；与普通微博不同路径，不降级。
 */
export async function tryPublishWeiboTextViaWebAjax (
  userId: string,
  text: string,
  options?: WeiboWebPublishOptions
): Promise<WeiboWebPublishResult> {
  const ct = options?.contentType
  const title = options?.title?.trim()
    ? stripMarkdownFromTitle(options.title.trim())
    : undefined
  if (ct === 'article') {
    if (!title) {
      return { ok: false, error: '发布头条文章需要标题' }
    }
    /** 封面：优先二进制；否则 imageUrls 首图（作品 cover + images 在 PublishService 中拼装） */
    const cover = options?.imageUrls?.filter(Boolean)[0]
    return tryPublishWeiboHeadlineArticle(userId, title, text, {
      coverImagePart: options?.coverImagePart,
      coverImageUrl: cover,
      weiboPublish: pickWeiboHeadlinePublish(options?.weiboPublishConfig)
    })
  }

  let bodyText = text.trim()
  if (title && ct === 'image-text') {
    bodyText = `【${title}】\n\n${bodyText}`.slice(0, 20_000)
  }

  let picIdJoined = options?.picId?.trim() ?? ''
  const urls = options?.imageUrls?.filter(Boolean) ?? []
  if (!picIdJoined && urls.length > 0) {
    const parts: ImagePart[] = []
    const failed: string[] = []
    for (const u of urls) {
      const p = await loadImagePartForWeibo(u)
      if (p) parts.push(p)
      else failed.push(u)
    }
    if (parts.length === 0) {
      return {
        ok: false,
        error: '图片无法读取或不是有效图片',
        detail:
          failed.length > 0
            ? `请确认图片仍可访问（本站图会先读磁盘；外链需配置 NEXT_PUBLIC_BASE_URL / INTERNAL_MEDIA_BASE_URL）。失败项：${failed
              .slice(0, 3)
              .map((s) => s.slice(0, 96))
              .join(' | ')}`
            : undefined
      }
    }
    const up = await uploadWeiboImagesAsPicIdString(userId, parts)
    if (!up.ok) {
      return { ok: false, error: '微博图床上传失败', detail: up.error }
    }
    picIdJoined = up.picIdStr
  }

  const isLongtext = bodyText.length > 2000 || Boolean(picIdJoined)

  const cookies = readWeiboPlaywrightStorageCookies(userId)
  if (!cookies?.length) {
    return { ok: false, error: '无会话 Cookie' }
  }

  const baseUrl = 'https://weibo.com/aj/mblog/add'
  const cookieHeader = cookieHeaderForUrl(baseUrl, cookies)
  if (!cookieHeader) {
    return { ok: false, error: '无法为 weibo.com 拼出 Cookie' }
  }

  const profile = readWeiboPlaywrightProfile(userId)
  const wbUid = profile?.weiboUid?.replace(/\D/g, '') ?? ''

  let xsrf = await resolveXsrf(cookies, cookieHeader)
  const wcfg = options?.weiboPublishConfig
  const feedVis = weiboFeedVisibleParam(
    wcfg?.imageTextVisibility ?? wcfg?.visibility
  )
  const feedStmt = wcfg?.imageTextContentDeclaration ?? '0'

  const variants = bodyVariants(bodyText, wbUid, {
    picId: picIdJoined || undefined,
    isLongtext,
    visible: feedVis,
    mblogStatement: feedStmt
  })
  const ajwvrList = ['6', '4']

  const attempts: string[] = []

  for (const ajwvr of ajwvrList) {
    for (const fields of variants) {
      try {
        const { status, raw } = await postMblogAdd(
          ajwvr,
          cookieHeader,
          xsrf,
          fields
        )
        const parsed = parseAjMblogAddResponse(raw, wbUid)
        if (parsed.ok) {
          const fin = await finalizePublishMeta(userId, wbUid, bodyText, parsed.meta)
          return {
            ok: true,
            platformPostId: fin.platformPostId,
            publishedUrl: fin.publishedUrl
          }
        }

        const hint = parsed.msg ?? raw.slice(0, 300)
        attempts.push(`ajwvr=${ajwvr} ${JSON.stringify(fields.pub_type)}/${fields.module}: HTTP ${status} ${hint}`)

        // 若像 token 问题，再拉一次首页刷新 xsrf 后只重试第一组 body
        if (
          /xsrf|csrf|100027|100016|登录/i.test(hint) &&
          xsrf === xsrfTokenFromCookies(cookies)
        ) {
          const html = await fetchWeiboHomeHtml(cookieHeader)
          const fromHtml = html ? extractXsrfFromHtml(html) : null
          if (fromHtml && fromHtml !== xsrf) {
            xsrf = fromHtml
            const retry = await postMblogAdd(
              ajwvr,
              cookieHeader,
              xsrf,
              variants[0]
            )
            const retryParsed = parseAjMblogAddResponse(retry.raw, wbUid)
            if (retryParsed.ok) {
              const fin = await finalizePublishMeta(
                userId,
                wbUid,
                bodyText,
                retryParsed.meta
              )
              return {
                ok: true,
                platformPostId: fin.platformPostId,
                publishedUrl: fin.publishedUrl
              }
            }
          }
        }
      } catch (e) {
        attempts.push(
          `ajwvr=${ajwvr}: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }
  }

  return {
    ok: false,
    error: '站内 HTTP 发博均未成功',
    detail: attempts.slice(-4).join(' | ')
  }
}
