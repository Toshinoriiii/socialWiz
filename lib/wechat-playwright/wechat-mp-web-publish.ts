/**
 * 微信公众号：用 Playwright 落盘的 Cookie 复现 mp.weixin.qq.com 网页端链路。
 * 接口形态参考开源分析（operate_appmsg / masssend），以线上实际响应为准；改版需重抓包。
 */
import { randomBytes } from 'crypto'
import { readWechatPlaywrightStorageCookies, cookieHeaderForUrl } from '@/lib/wechat-playwright/wechat-storage-cookies'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const MP = 'https://mp.weixin.qq.com'

export interface WechatMpWebPublishInput {
  title: string
  /** 已含图文 HTML（通常为 Markdown 转 HTML） */
  html: string
  digest: string
  /** 须可被微信服务器抓取的绝对 URL（配图封面） */
  coverImageUrl: string
  contentSourceUrl?: string
  author?: string
}

export interface WechatMpWebPublishResult {
  ok: boolean
  error?: string
  detail?: string
  hint?: string
  appMsgId?: string
  publishedUrl?: string
}

interface MpAdminContext {
  token: string
  ticket: string
  userName: string
  operationSeq: string
  massProtect: boolean
  cookieHeader: string
  /** 版权检测等接口与安全校验需要，来自后台页面内嵌脚本 */
  fingerprint?: string
}

/** 与浏览器 Network 中 get_appmsg_copyright_stat 一致，32 位 hex */
function extractFingerprintFromMpHtml (html: string): string | null {
  if (!html || html.length < 80) return null
  const patterns = [
    /["']fingerprint["']\s*:\s*["']([a-f0-9]{32})["']/i,
    /fingerprint\s*[:=]\s*["']([a-f0-9]{32})["']/i,
    /cgiData\.fingerprint\s*=\s*["']([a-f0-9]{32})["']/i,
    /wx\.cgiData\s*=\s*\{[\s\S]{0,800}?fingerprint\s*:\s*["']([a-f0-9]{32})["']/i,
    /fingerprint["']?\s*:\s*["']([a-f0-9]{32})["']/i,
    /"fingerprint"\s*:\s*"([a-f0-9]{32})"/i
  ]
  for (const re of patterns) {
    const m = html.match(re)
    const v = m?.[1]
    if (v && /^[a-f0-9]{32}$/i.test(v)) return v.toLowerCase()
  }
  return null
}

function reqId32 (): string {
  return randomBytes(16).toString('hex')
}

async function followUntilToken (
  cookieHeader: string
): Promise<{ token: string | null }> {
  let currentUrl: string = `${MP}/`
  for (let i = 0; i < 14; i++) {
    const r: Response = await fetch(currentUrl, {
      redirect: 'manual',
      headers: { Cookie: cookieHeader, 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' }
    })
    const loc: string | null = r.headers.get('location')
    if (r.status >= 300 && r.status < 400 && loc) {
      const next: string = new URL(loc, currentUrl).href
      const m = next.match(/[?&#]token=(\d+)/)
      if (m) return { token: m[1] }
      currentUrl = next
      continue
    }
    const text = await r.text().catch(() => '')
    const m2 = text.match(/token:\s*'?(\d+)'?/) || text.match(/"token"\s*:\s*"?(\d+)"?/)
    if (m2) return { token: m2[1] }
    break
  }
  return { token: null }
}

/** 创建图文后间隔一段时间再群发时，群发页会轮换 operation_seq；应用前一刻重新拉取可显著提高 masssend 成功率 */
async function mergeMassSendPageFresh (
  ctx: MpAdminContext
): Promise<MpAdminContext> {
  const fresh = await loadMassSendPageData(ctx.token, ctx.cookieHeader)
  if (!fresh) return ctx
  return {
    ...ctx,
    ticket: fresh.ticket,
    userName: fresh.userName,
    operationSeq: fresh.operationSeq,
    massProtect: fresh.massProtect,
    ...(fresh.fingerprint ? { fingerprint: fresh.fingerprint } : {})
  }
}

async function loadMassSendPageData (
  token: string,
  cookieHeader: string
): Promise<Omit<MpAdminContext, 'token' | 'cookieHeader'> | null> {
  const ref = `${MP}/cgi-bin/masssendpage?t=mass/send&token=${token}&lang=zh_CN`
  const r = await fetch(ref, {
    headers: {
      Cookie: cookieHeader,
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      Referer: `${MP}/`
    }
  })
  const html = await r.text()
  const ticketMatch = html.match(/ticket:\s*"([^"]+)"/)
  const userNameMatch = html.match(/user_name:\s*"([^"]+)"/)
  const operationMatch = html.match(/operation_seq:\s*"([^"]+)"/)
  const massProtectMatch = html.match(/"protect_status":(\d+)/)
  if (!ticketMatch || !userNameMatch) return null
  const massProtect =
    massProtectMatch != null && (2 & Number(massProtectMatch[1])) === 2
  let fingerprint = extractFingerprintFromMpHtml(html) ?? undefined
  if (!fingerprint) {
    try {
      const homeR = await fetch(
        `${MP}/cgi-bin/home?t=home/index&token=${encodeURIComponent(token)}&lang=zh_CN`,
        {
          headers: {
            Cookie: cookieHeader,
            'User-Agent': UA,
            Accept: 'text/html,application/xhtml+xml',
            Referer: `${MP}/`
          }
        }
      )
      if (homeR.ok) {
        const h2 = await homeR.text()
        fingerprint = extractFingerprintFromMpHtml(h2) ?? undefined
      }
    } catch {
      /* ignore */
    }
  }
  return {
    ticket: ticketMatch[1],
    userName: userNameMatch[1],
    operationSeq: operationMatch ? operationMatch[1] : '',
    massProtect,
    fingerprint
  }
}

async function resolveMpContext (userId: string): Promise<MpAdminContext | null> {
  const cookies = readWechatPlaywrightStorageCookies(userId)
  if (!cookies?.length) return null
  const cookieHeader = cookieHeaderForUrl(MP + '/', cookies)
  if (!cookieHeader) return null
  const { token } = await followUntilToken(cookieHeader)
  if (!token) return null
  const rest = await loadMassSendPageData(token, cookieHeader)
  if (!rest) return null
  return { token, cookieHeader, ...rest }
}

async function resolveMpTokenAndCookie (
  userId: string
): Promise<{ token: string; cookieHeader: string } | null> {
  const cookies = readWechatPlaywrightStorageCookies(userId)
  if (!cookies?.length) return null
  const cookieHeader = cookieHeaderForUrl(MP + '/', cookies)
  if (!cookieHeader) return null
  const { token } = await followUntilToken(cookieHeader)
  if (!token) return null
  return { token, cookieHeader }
}

/** 供 misc/appmsganalysis 等仅需 token + Cookie 的页面拉取 */
export async function resolveWechatMpTokenAndCookie (
  userId: string
): Promise<{ token: string; cookieHeader: string } | null> {
  return resolveMpTokenAndCookie(userId)
}

const MP_SESSION_PROBE_MS = 12_000

/**
 * 仅用 Cookie 跟随重定向解析公众平台 token，判断 mp 登录是否仍有效（账号列表探测，不做群发页拉取）。
 * @returns true 能拿到 token；false 有 Cookie 但拿不到 token（多已登出）；null 超时或无法判断。
 */
export async function probeWechatMpPlaywrightSessionAlive (
  userId: string
): Promise<boolean | null> {
  const cookies = readWechatPlaywrightStorageCookies(userId)
  if (!cookies?.length) return null
  const cookieHeader = cookieHeaderForUrl(MP + '/', cookies)
  if (!cookieHeader) return null

  const raced = await Promise.race([
    followUntilToken(cookieHeader).then((x) => ({ kind: 'done' as const, token: x.token })),
    new Promise<{ kind: 'timeout' }>((resolve) => {
      setTimeout(() => resolve({ kind: 'timeout' }), MP_SESSION_PROBE_MS)
    })
  ])

  if (raced.kind === 'timeout') return null
  if (raced.token != null && String(raced.token).length > 0) return true
  return false
}

function normalizeMpNickname (raw: string | undefined | null): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (s.length === 0 || s.length > 80) return null
  // gh_ 常为内部 user_name，不作为展示名
  if (s.startsWith('gh_')) return null
  return s
}

function extractNicknameFromMpHtml (html: string): string | null {
  if (!html || html.length < 20) return null
  const patterns: RegExp[] = [
    /nick_name\s*:\s*"([^"\\]+)"/,
    /["']nick_name["']\s*:\s*["']([^"']+)["']/,
    /["']nickname["']\s*:\s*["']([^"']+)["']/i,
    /nickname\s*:\s*"([^"\\]+)"/i,
    /cgiData\.nick_name\s*=\s*["']([^"']+)["']/,
    /wx\.cgiData\.nick_name\s*=\s*["']([^"']+)["']/,
    /user_name\s*:\s*"([^"\\]+)"/,
    /<strong[^>]*class="[^"]*nickname[^"]*"[^>]*>([^<]+)<\/strong>/i
  ]
  for (const re of patterns) {
    const m = html.match(re)
    const n = normalizeMpNickname(m?.[1])
    if (n) return n
  }
  return null
}

async function parseHomeResponseForNickname (r: Response): Promise<string | null> {
  const ct = (r.headers.get('content-type') || '').toLowerCase()
  const text = await r.text().catch(() => '')
  if (!text) return null
  if (ct.includes('json')) {
    try {
      const j = JSON.parse(text) as Record<string, unknown>
      const pick = (o: unknown): string | null => {
        if (o == null || typeof o !== 'object') return null
        const rec = o as Record<string, unknown>
        const candidates = [
          rec.nick_name,
          rec.nickname,
          rec.nickName,
          rec.user_name,
          (rec.data as Record<string, unknown> | undefined)?.nick_name,
          (rec.data as Record<string, unknown> | undefined)?.nickname,
          (rec.user_info as Record<string, unknown> | undefined)?.nick_name,
          (rec.user_info as Record<string, unknown> | undefined)?.nickname,
          (rec.mp_admin_info as Record<string, unknown> | undefined)?.nick_name
        ]
        for (const c of candidates) {
          const n = normalizeMpNickname(c != null ? String(c) : null)
          if (n) return n
        }
        return null
      }
      const fromTop = pick(j)
      if (fromTop) return fromTop
    } catch {
      /* fall through HTML */
    }
  }
  return extractNicknameFromMpHtml(text)
}

async function fetchMpDisplayName (
  token: string,
  cookieHeader: string
): Promise<string | null> {
  const refererHome = `${MP}/cgi-bin/home?t=home/index&lang=zh_CN&token=${token}`
  const tryUrls: Array<{ url: string; headers: Record<string, string> }> = [
    {
      url: `${MP}/cgi-bin/home?t=home/index&token=${encodeURIComponent(token)}&lang=zh_CN`,
      headers: {
        Cookie: cookieHeader,
        'User-Agent': UA,
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: refererHome
      }
    },
    {
      url: `${MP}/cgi-bin/home?t=home/index&lang=zh_CN&token=${encodeURIComponent(token)}`,
      headers: {
        Cookie: cookieHeader,
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        Referer: `${MP}/`
      }
    },
    {
      url: `${MP}/cgi-bin/settingpage?t=setting/index&action=index&token=${encodeURIComponent(token)}&lang=zh_CN`,
      headers: {
        Cookie: cookieHeader,
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        Referer: refererHome
      }
    }
  ]
  for (const { url, headers } of tryUrls) {
    try {
      const r = await fetch(url, { headers, redirect: 'follow' })
      if (!r.ok) continue
      const nick = await parseHomeResponseForNickname(r)
      if (nick) return nick
    } catch {
      /* next */
    }
  }
  return null
}

/**
 * 用工单里保存的 Cookie 向 mp 请求首页/设置页，解析公众号展示昵称（绑定脚本失败时的兜底）。
 */
export async function resolveWechatPublicAccountDisplayName (
  userId: string
): Promise<string | null> {
  const tc = await resolveMpTokenAndCookie(userId)
  if (!tc) return null
  return fetchMpDisplayName(tc.token, tc.cookieHeader)
}

async function uploadImg2Cdn (
  ctx: MpAdminContext,
  imgUrl: string
): Promise<string> {
  const body = new URLSearchParams({
    imgurl: imgUrl,
    t: 'ajax-editor-upload-img'
  })
  const r = await fetch(`${MP}/cgi-bin/uploadimg2cdn?token=${encodeURIComponent(ctx.token)}`, {
    method: 'POST',
    headers: {
      Cookie: ctx.cookieHeader,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Referer: `${MP}/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=10&isMul=1&isNew=1&token=${ctx.token}&lang=zh_CN`,
      'User-Agent': UA,
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest'
    },
    body
  })
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>
  if (j.errcode === 0 && typeof j.url === 'string') return j.url
  const errMsg = [j.errmsg, j.err_msg].filter((x) => typeof x === 'string').join(' — ')
  throw new Error(errMsg || JSON.stringify(j).slice(0, 400))
}

async function uploadCoverViaFiletransfer (
  ctx: MpAdminContext,
  imageBuffer: Buffer,
  filename: string,
  contentType: string
): Promise<{ fileid: string; cdn_url: string }> {
  const url = `${MP}/cgi-bin/filetransfer?action=upload_material&f=json&scene=1&writetype=doublewrite&groupid=1&ticket_id=${encodeURIComponent(ctx.userName)}&ticket=${encodeURIComponent(ctx.ticket)}&svr_time=${Math.floor(Date.now() / 1000)}&seq=1&token=${encodeURIComponent(ctx.token)}`
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: contentType || 'image/jpeg' })
  const fd = new FormData()
  fd.append('file', blob, filename)
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Cookie: ctx.cookieHeader,
      Referer: `${MP}/cgi-bin/filepage?type=2&begin=0&count=12&t=media/img_list&token=${ctx.token}&lang=zh_CN`,
      'User-Agent': UA
    },
    body: fd
  })
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>
  const ret = j.base_resp as { ret?: number } | undefined
  if (ret?.ret === 0 && j.content != null && j.cdn_url != null) {
    return { fileid: String(j.content), cdn_url: String(j.cdn_url) }
  }
  throw new Error(JSON.stringify(j).slice(0, 500))
}

/** 打开新建图文页，便于服务端校验 Referer/Cookie 会话（减少 ret 154011 等默认错误） */
async function warmupMpMaterialEditor (ctx: MpAdminContext): Promise<void> {
  const url =
    `${MP}/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=10&isMul=1&isNew=1&lang=zh_CN&token=${encodeURIComponent(ctx.token)}`
  await fetch(url, {
    headers: {
      Cookie: ctx.cookieHeader,
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      Referer: `${MP}/`
    }
  }).catch(() => undefined)
}

/** 与线上编辑器地址一致：新编辑器多为 type=77，未点「发表」前 isFreePublish=0（与 Network 中 location 一致） */
function appmsgEditPageUrl (
  ctx: MpAdminContext,
  appmsgid: string,
  editorType: '10' | '77'
): string {
  return `${MP}/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=${editorType}&appmsgid=${encodeURIComponent(appmsgid)}&isMul=1&replaceScene=0&isSend=1&isFreePublish=0&token=${encodeURIComponent(ctx.token)}&lang=zh_CN`
}

/** 创建完成后打开该图文编辑页，利于会话与 Referer 对齐 */
async function warmupExistingAppmsgEditor (
  ctx: MpAdminContext,
  appmsgid: string
): Promise<void> {
  for (const typ of ['10', '77'] as const) {
    await fetch(appmsgEditPageUrl(ctx, appmsgid, typ), {
      headers: {
        Cookie: ctx.cookieHeader,
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        Referer: `${MP}/`
      }
    }).catch(() => undefined)
  }
}

/**
 * 从图文编辑页 HTML 解析 fingerprint；群发页解析不到时版权预检易 ret=154011。
 */
async function enrichFingerprintFromAppmsgPages (
  ctx: MpAdminContext,
  appmsgid: string
): Promise<MpAdminContext> {
  for (const typ of ['77', '10'] as const) {
    try {
      const r = await fetch(appmsgEditPageUrl(ctx, appmsgid, typ), {
        headers: {
          Cookie: ctx.cookieHeader,
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          Referer: `${MP}/`
        }
      })
      if (!r.ok) continue
      const html = await r.text()
      const found = extractFingerprintFromMpHtml(html)
      if (found) return { ...ctx, fingerprint: found }
    } catch {
      /* ignore */
    }
  }
  return ctx
}

/**
 * 浏览器在从编辑器进入群发/发表前会请求 masssendpage JSON 并带 preview_appmsgid，用于服务端绑定待发图文与群发上下文。
 * 缺这一步时 get_appmsg_copyright_stat 易 ret=154011。/advanced/mplog 仅为埋点上报，可忽略。
 */
async function fetchMasssendpagePreviewAppmsg (
  ctx: MpAdminContext,
  appmsgid: string
): Promise<void> {
  const qs = new URLSearchParams({
    f: 'json',
    preview_appmsgid: appmsgid,
    token: ctx.token,
    lang: 'zh_CN',
    ajax: '1',
    random: String(Math.random())
  })
  if (ctx.fingerprint) qs.set('fingerprint', ctx.fingerprint)
  const url = `${MP}/cgi-bin/masssendpage?${qs.toString()}`
  const referer = appmsgEditPageUrl(ctx, appmsgid, '77')
  await fetch(url, {
    headers: {
      Cookie: ctx.cookieHeader,
      'User-Agent': UA,
      Accept: 'application/json, text/javascript, */*; q=0.01',
      Referer: referer,
      'X-Requested-With': 'XMLHttpRequest'
    }
  }).catch(() => undefined)
}

/** 与浏览器「发表记录」列表请求一致（含 type / free_publish_type / sub_action=list_ex） */
function buildAppmsgpublishListQuery (
  ctx: MpAdminContext,
  listOpts?: { begin?: number; count?: number }
): URLSearchParams {
  const begin = listOpts?.begin ?? 0
  const count = listOpts?.count ?? 10
  const qs = new URLSearchParams({
    sub: 'list',
    begin: String(begin),
    count: String(count),
    query: '',
    type: '101_1_102_103',
    show_type: '',
    free_publish_type: '1_102_103',
    sub_action: 'list_ex',
    search_card: '0',
    token: ctx.token,
    lang: 'zh_CN',
    f: 'json',
    ajax: '1',
    random: String(Math.random())
  })
  if (ctx.fingerprint) qs.set('fingerprint', ctx.fingerprint)
  return qs
}

/**
 * operate_appmsg 返回的 appMsgId 是素材/草稿 id，在发表列表里对应 publish_info.draft_msgid；
 * 正式群发 msg 的 appmsgid（如 2247483726）与草稿 id 不同，必须用 draft_msgid 对齐才能取到 link。
 */
function extractWxLinkFromAppmsgpublishResponse (
  j: Record<string, unknown>,
  draftMsgId: string
): string | null {
  const raw = j.publish_page
  if (typeof raw !== 'string' || raw.length < 20) return null
  try {
    const page = JSON.parse(raw) as Record<string, unknown>
    const list = page.publish_list
    if (Array.isArray(list)) {
      for (const item of list) {
        if (item == null || typeof item !== 'object') continue
        const pInfoStr = (item as Record<string, unknown>).publish_info
        if (typeof pInfoStr !== 'string') continue
        try {
          const inner = JSON.parse(pInfoStr) as Record<string, unknown>
          const pubMeta = inner.publish_info
          if (pubMeta == null || typeof pubMeta !== 'object') continue
          const draft = (pubMeta as Record<string, unknown>).draft_msgid
          if (draft == null || String(draft) !== String(draftMsgId)) continue
          const ex = inner.appmsgex
          if (!Array.isArray(ex)) continue
          for (const row of ex) {
            if (row == null || typeof row !== 'object') continue
            const link = (row as Record<string, unknown>).link
            if (typeof link !== 'string') continue
            const t = link.trim()
            const sub =
              extractMpArticleUrlFromText(t) ?? (isWxArticlePublicUrl(t) ? t : null)
            if (sub) return sub
          }
        } catch {
          const sub = extractLinkNearDraftInRawPublishPage(pInfoStr, draftMsgId)
          if (sub) return sub
        }
      }
    }
  } catch {
    /* publish_page 整段解析失败时走下方兜底 */
  }
  return extractLinkNearDraftInRawPublishPage(raw, draftMsgId)
}

/** 「发表」页会先拉 appmsgpublish?sub=list；与 masssend + is_release_publish_page=1 同属新发表链路，作会话预热。 */
async function fetchAppmsgpublishListWarmup (
  ctx: MpAdminContext,
  appmsgid: string
): Promise<void> {
  const qs = buildAppmsgpublishListQuery(ctx)
  const url = `${MP}/cgi-bin/appmsgpublish?${qs.toString()}`
  await fetch(url, {
    headers: {
      Cookie: ctx.cookieHeader,
      'User-Agent': UA,
      Accept: 'application/json, text/javascript, */*; q=0.01',
      Referer: appmsgEditPageUrl(ctx, appmsgid, '77'),
      'X-Requested-With': 'XMLHttpRequest'
    }
  }).catch(() => undefined)
}

function sleepMs (ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 群发后对外可读的正文链接，形如 https://mp.weixin.qq.com/s/v_8UH-gTqaa5HrwRPqQrmg
 *（与 [该文](https://mp.weixin.qq.com/s/v_8UH-gTqaa5HrwRPqQrmg) 同形态；也可能只在 JSON 里出现 sn 或嵌在更长字符串中）
 */
function isWxArticlePublicUrl (s: string): boolean {
  const t = s.trim()
  return /^https?:\/\/mp\.weixin\.qq\.com\/s[\/?#]/i.test(t)
}

const RE_MP_ARTICLE_S_URL =
  /https?:\/\/mp\.weixin\.qq\.com\/s(?:\/[^?\s"'<>]+|\?[^\s"'<>]+)/i

/** 从任意字符串中抠出第一段 mp 图文正式链（接口里可能包在 HTML/JSON 片段中） */
function extractMpArticleUrlFromText (s: string): string | null {
  const normalized = s.includes('\\/') ? s.replace(/\\\//g, '/') : s
  const m = normalized.match(RE_MP_ARTICLE_S_URL)
  if (!m) return null
  let u = m[0].replace(/[,;.)'`\]}>]+$/, '')
  if (u.length > 500) return null
  return u
}

/**
 * publish_page 整段里仍是转义后的 JSON 文本（如 \"link\":\"https:\\/\\/mp.weixin...\"）；
 * 若嵌套 parse 失败，可在 draft_msgid 附近截取再正则抠 link，避免漏提取。
 */
function extractLinkNearDraftInRawPublishPage (
  raw: string,
  draftMsgId: string
): string | null {
  /** publish_page 字符串里内层仍带 JSON 转义：\"draft_msgid\"、https:\/\/mp… */
  const norm = raw.replace(/\\\//g, '/')
  const markers = [
    `"draft_msgid":${draftMsgId}`,
    `"draft_msgid":"${draftMsgId}"`,
    `\"draft_msgid\":${draftMsgId}`,
    `\"draft_msgid\":\"${draftMsgId}\"`
  ]
  for (const needle of markers) {
    const idx = norm.indexOf(needle)
    if (idx === -1) continue
    const slice = norm.slice(idx, Math.min(idx + 12000, norm.length))
    const u = extractMpArticleUrlFromText(slice)
    if (u) return u
  }
  return null
}

function mpArticleUrlFromSn (sn: string): string | null {
  const t = sn.trim()
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(t)) return null
  return `https://mp.weixin.qq.com/s/${t}`
}

function extractWxArticleUrlDeep (data: unknown): string | null {
  if (data == null) return null
  if (typeof data === 'string') {
    const t = data.trim()
    const sub = extractMpArticleUrlFromText(t)
    if (sub) return sub
    return isWxArticlePublicUrl(t) ? t : null
  }
  if (Array.isArray(data)) {
    for (const x of data) {
      const u = extractWxArticleUrlDeep(x)
      if (u) return u
    }
    return null
  }
  if (typeof data === 'object') {
    for (const v of Object.values(data as Record<string, unknown>)) {
      const u = extractWxArticleUrlDeep(v)
      if (u) return u
    }
  }
  return null
}

function extractUrlForAppmsgId (data: unknown, appmsgid: string): string | null {
  if (data == null) return null
  if (Array.isArray(data)) {
    for (const x of data) {
      const u = extractUrlForAppmsgId(x, appmsgid)
      if (u) return u
    }
    return null
  }
  if (typeof data !== 'object') return null
  const o = data as Record<string, unknown>
  const idRaw =
    o.appmsgid ??
    o.app_msg_id ??
    o.appMsgId ??
    o.appmsg_id ??
    o.aid ??
    o.msgid ??
    o.Aid
  const idMatch = idRaw != null && String(idRaw) === String(appmsgid)
  if (idMatch) {
    for (const k of [
      'url',
      'link',
      'content_url',
      'contentUrl',
      'msg_link',
      'article_url',
      'share_url',
      'msgUrl',
      'cdn_url',
      'item_url'
    ]) {
      const v = o[k]
      if (typeof v !== 'string') continue
      const sub = extractMpArticleUrlFromText(v) ?? (isWxArticlePublicUrl(v) ? v.trim() : null)
      if (sub) return sub
    }
    const snRaw = o.sn ?? o.msg_sn
    if (typeof snRaw === 'string') {
      const fromSn = mpArticleUrlFromSn(snRaw)
      if (fromSn) return fromSn
    }
    const deep = extractWxArticleUrlDeep(o)
    if (deep) return deep
  }
  for (const v of Object.values(o)) {
    const u = extractUrlForAppmsgId(v, appmsgid)
    if (u) return u
  }
  return null
}

async function fetchAppmsgpublishListJson (
  ctx: MpAdminContext,
  referer: string,
  listOpts?: { begin?: number; count?: number }
): Promise<Record<string, unknown> | null> {
  const qs = buildAppmsgpublishListQuery(ctx, listOpts)
  const url = `${MP}/cgi-bin/appmsgpublish?${qs.toString()}`
  const r = await fetch(url, {
    headers: {
      Cookie: ctx.cookieHeader,
      'User-Agent': UA,
      Accept: 'application/json, text/javascript, */*; q=0.01',
      Referer: referer,
      'X-Requested-With': 'XMLHttpRequest'
    }
  })
  const j = (await r.json().catch(() => null)) as Record<string, unknown> | null
  return j && typeof j === 'object' ? j : null
}

/**
 * 使用本机绑定的公众平台浏览器会话拉取「发表记录」列表 JSON（与后台
 * `cgi-bin/appmsgpublish?sub=list&…` 一致），供数据概览等在无开发者凭证时读阅读/互动。
 */
export async function fetchMpAppmsgpublishListJsonForUser (
  userId: string,
  listOpts?: { begin?: number; count?: number }
): Promise<Record<string, unknown> | null> {
  const ctx = await resolveMpContext(userId)
  if (!ctx) return null
  const refHome = `${MP}/cgi-bin/home?t=home/index&token=${ctx.token}&lang=zh_CN`
  const j = await fetchAppmsgpublishListJson(ctx, refHome, listOpts)
  if (!j) return null
  const br = j.base_resp as { ret?: number } | undefined
  const hasPage =
    typeof j.publish_page === 'string' && (j.publish_page as string).length > 20
  if (br && br.ret != null && br.ret !== 0 && !hasPage) return null
  return j
}

/** 素材/记录列表；常含 app_msg_list[].link（与 mp.weixin.qq.com/s/... 同形） */
async function fetchAppmsgListExJson (
  ctx: MpAdminContext,
  referer: string
): Promise<Record<string, unknown> | null> {
  const fakeid = ctx.userName?.trim()
  if (!fakeid) return null
  const qs = new URLSearchParams({
    action: 'list_ex',
    begin: '0',
    count: '10',
    type: '9',
    query: '1',
    fakeid,
    token: ctx.token,
    lang: 'zh_CN',
    f: 'json',
    ajax: '1',
    random: String(Math.random())
  })
  const url = `${MP}/cgi-bin/appmsg?${qs.toString()}`
  const r = await fetch(url, {
    headers: {
      Cookie: ctx.cookieHeader,
      'User-Agent': UA,
      Accept: 'application/json, text/javascript, */*; q=0.01',
      Referer: referer,
      'X-Requested-With': 'XMLHttpRequest'
    }
  })
  const j = (await r.json().catch(() => null)) as Record<string, unknown> | null
  if (!j || typeof j !== 'object') return null
  const br = j.base_resp as { ret?: number } | undefined
  const hasList =
    j.app_msg_list != null ||
    j.appMsgList != null ||
    j.publish_list != null ||
    j.list != null
  if (br && br.ret != null && br.ret !== 0 && !hasList) return null
  return j
}

/**
 * 正式文章链接：优先从 masssend 响应取，否则 list_ex / appmsgpublish 轮询（新文入库略有延迟）。
 * 不再使用 get_temp_url 作为 publishedUrl（临时预览链会很快失效）。
 */
async function resolvePublishedMpArticleUrl (
  ctx: MpAdminContext,
  appmsgid: string,
  masssendResponse: Record<string, unknown>
): Promise<string | null> {
  let u = extractUrlForAppmsgId(masssendResponse, appmsgid)
  if (!u) u = extractWxArticleUrlDeep(masssendResponse)
  if (u) return u

  const refHome = `${MP}/cgi-bin/home?t=home/index&token=${ctx.token}&lang=zh_CN`
  let ctxPoll = ctx
  for (let i = 0; i < 6; i++) {
    if (i > 0) await sleepMs(1200)
    ctxPoll = await mergeMassSendPageFresh(ctxPoll)
    const listPub = await fetchAppmsgpublishListJson(ctxPoll, refHome)
    if (listPub) {
      u =
        extractWxLinkFromAppmsgpublishResponse(listPub, appmsgid) ??
        extractUrlForAppmsgId(listPub, appmsgid) ??
        extractWxArticleUrlDeep(listPub)
      if (u) return u
    }
    const listEx = await fetchAppmsgListExJson(ctxPoll, refHome)
    if (listEx) {
      u = extractUrlForAppmsgId(listEx, appmsgid) ?? extractWxArticleUrlDeep(listEx)
      if (u) return u
    }
  }
  return null
}

interface OperateAppmsgVariant {
  showCoverPic: '0' | '1'
  needOpenComment: '0' | '1'
  copyrightType: string
}

async function postOperateAppmsgCreateOnce (
  ctx: MpAdminContext,
  input: WechatMpWebPublishInput & { coverCdnUrl: string; fileId: string },
  v: OperateAppmsgVariant
): Promise<
  | { ok: true; appMsgId: string }
  | { ok: false; ret: number; err_msg: string; snippet: string }
> {
  const params = new URLSearchParams()
  params.set('token', ctx.token)
  params.set('f', 'json')
  params.set('ajax', '1')
  params.set('random', String(Math.random()))
  params.set('count', '1')
  params.set('title0', input.title)
  params.set('content0', input.html)
  params.set('digest0', input.digest)
  params.set('author0', input.author ?? '')
  params.set('fileid0', input.fileId ?? '')
  params.set('cdn_url0', input.coverCdnUrl)
  params.set('sourceurl0', input.contentSourceUrl ?? '')
  params.set('show_cover_pic0', v.showCoverPic)
  params.set('need_open_comment0', v.needOpenComment)
  params.set('music_id0', '')
  params.set('video_id0', '')
  params.set('shortvideofileid0', '')
  params.set('copyright_type0', v.copyrightType)
  params.set('only_fans_can_comment0', '0')
  params.set('fee0', '')
  params.set('voteid0', '')
  params.set('voteismlt0', '')
  params.set('ad_id0', '')

  // 与 wechat-mp-hack 一致：Referer 不带 lang（部分账号对 Referer 校验较严）
  const refererEdit = `${MP}/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=10&isMul=1&isNew=1&token=${ctx.token}`

  const r = await fetch(
    `${MP}/cgi-bin/operate_appmsg?t=ajax-response&sub=create&type=10&lang=zh_CN&token=${encodeURIComponent(ctx.token)}`,
    {
      method: 'POST',
      headers: {
        Cookie: ctx.cookieHeader,
        Origin: MP,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Referer: refererEdit,
        'User-Agent': UA,
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: params
    }
  )
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>
  const br = j.base_resp as { ret?: number; err_msg?: string } | undefined
  if (br?.ret === 0 && j.appMsgId != null) {
    return { ok: true, appMsgId: String(j.appMsgId) }
  }
  return {
    ok: false,
    ret: br?.ret ?? -1,
    err_msg: String(br?.err_msg ?? ''),
    snippet: JSON.stringify(j).slice(0, 500)
  }
}

async function operateAppmsgCreate (
  ctx: MpAdminContext,
  input: WechatMpWebPublishInput & {
    coverCdnUrl: string
    fileId: string
  }
): Promise<string> {
  await warmupMpMaterialEditor(ctx)

  const hasFileId = Boolean((input.fileId ?? '').trim())
  // ret 154011 无明确文案：多组合重试（封面展示/评论开关/原创类型字段）
  const variants: OperateAppmsgVariant[] = [
    {
      showCoverPic: hasFileId ? '1' : '0',
      needOpenComment: '0',
      copyrightType: '0'
    },
    { showCoverPic: hasFileId ? '0' : '1', needOpenComment: '0', copyrightType: '0' },
    {
      showCoverPic: hasFileId ? '1' : '0',
      needOpenComment: '1',
      copyrightType: '0'
    },
    { showCoverPic: hasFileId ? '1' : '0', needOpenComment: '0', copyrightType: '' }
  ]

  const tried: string[] = []
  for (const v of variants) {
    const label = `show=${v.showCoverPic},comment=${v.needOpenComment},cr=${v.copyrightType || '(空)'}`
    const result = await postOperateAppmsgCreateOnce(ctx, input, v)
    if (result.ok) return result.appMsgId
    tried.push(`${label}→ret=${result.ret}`)
    if (result.ret !== 154011) {
      throw new Error(
        `operate_appmsg ret=${result.ret} err_msg=${result.err_msg} | ${result.snippet}`
      )
    }
  }

  throw new Error(
    `operate_appmsg ret=154011（已尝试 ${variants.length} 组参数仍失败） | ${tried.join('；')}`
  )
}

function copyrightStatBody (
  ctx: MpAdminContext,
  appmsgid: string,
  first: number
): URLSearchParams {
  const body = new URLSearchParams({
    token: ctx.token,
    lang: 'zh_CN',
    f: 'json',
    ajax: '1',
    random: String(Math.random()),
    first_check: String(first),
    appmsgid,
    /** 浏览器里该接口始终为图文 type=10；请求体写 type=77 会 ret=200002 invalid args */
    type: '10',
    reprint_info: '',
    reprint_confirm: '0'
  })
  if (ctx.fingerprint) body.set('fingerprint', ctx.fingerprint)
  if (ctx.operationSeq) body.set('operation_seq', ctx.operationSeq)
  return body
}

/** 与 Network 一致时 base_resp.ret=0；转载/广告相关账号可能 ret=154009 + open_ad_reprint_status，仍可继续 masssend */
function copyrightStatResponseOk (j: Record<string, unknown>): boolean {
  const br = j.base_resp as { ret?: number; err_msg?: string } | undefined
  if (br?.ret === 0) return true
  const ad = j.open_ad_reprint_status
  if (
    br?.ret === 154009 &&
    typeof ad === 'string' &&
    (ad === 'EN_CAN_OPEN_AD_REPRINT' || ad.includes('REPRINT'))
  ) {
    return true
  }
  return false
}

async function copyrightChecks (ctx: MpAdminContext, appmsgid: string): Promise<void> {
  if (process.env.WECHAT_MP_SKIP_COPYRIGHT === '1' || process.env.WECHAT_MP_SKIP_COPYRIGHT === 'true') {
    return
  }

  const statUrl = `${MP}/cgi-bin/masssend?action=get_appmsg_copyright_stat&lang=zh_CN&token=${encodeURIComponent(ctx.token)}`
  const referers: { label: string; referer: string }[] = [
    { label: 'appmsg_edit_77', referer: appmsgEditPageUrl(ctx, appmsgid, '77') },
    { label: 'appmsg_edit_10', referer: appmsgEditPageUrl(ctx, appmsgid, '10') },
    {
      label: 'masssend_preview_html',
      referer: `${MP}/cgi-bin/masssendpage?t=mass/send&token=${encodeURIComponent(ctx.token)}&lang=zh_CN&preview_appmsgid=${encodeURIComponent(appmsgid)}`
    },
    {
      label: 'mass_send',
      referer: `${MP}/cgi-bin/masssendpage?t=mass/send&token=${ctx.token}&lang=zh_CN`
    }
  ]

  const failures: string[] = []
  for (const { label, referer } of referers) {
    for (const first of [1, 0]) {
      const body = copyrightStatBody(ctx, appmsgid, first)
      const r = await fetch(statUrl, {
        method: 'POST',
        headers: {
          Cookie: ctx.cookieHeader,
          Origin: MP,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Referer: referer,
          'User-Agent': UA,
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body
      })
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>
      if (copyrightStatResponseOk(j)) return
      const br = j.base_resp as { ret?: number; err_msg?: string } | undefined
      const snippet = JSON.stringify(j).slice(0, 280)
      failures.push(
        `${label} first_check=${first} ret=${String(br?.ret ?? '')} err_msg=${String(br?.err_msg ?? '')} ${snippet}`
      )
    }
  }
  /**
   * 全部组合均为 ret=154011 时，实际浏览器里仍可能群发成功；严格模式可设 WECHAT_MP_STRICT_COPYRIGHT=1 保持抛错。
   * 与手动设 WECHAT_MP_SKIP_COPYRIGHT=1 不同：仅在此种「全是 154011』时让步并继续 masssend。
   */
  const strictCopyright =
    process.env.WECHAT_MP_STRICT_COPYRIGHT === '1' ||
    process.env.WECHAT_MP_STRICT_COPYRIGHT === 'true'
  if (
    !strictCopyright &&
    failures.length > 0 &&
    failures.every((f) => f.includes('ret=154011'))
  ) {
    return
  }
  throw new Error(`get_appmsg_copyright_stat ${failures.join(' || ')}`.slice(0, 1200))
}

async function massSendGraphic (
  ctx: MpAdminContext,
  appmsgid: string
): Promise<Record<string, unknown>> {
  if (ctx.massProtect) {
    throw new Error(
      'MASS_PROTECT:公众号开启了群发二次验证，请在公众平台关闭保护或改用后台手动群发'
    )
  }
  /**
   * 与后台「发表」流程一致：URL 带 is_release_publish_page=1，表单含 isFreePublish / share_page / sync_version 等；
   * 旧版群发页 masssend（groupid=-1、无 is_release_publish_page）在仅走新编辑器时可能 ret 失败。
   */
  const params = new URLSearchParams({
    token: ctx.token,
    lang: 'zh_CN',
    f: 'json',
    ajax: '1',
    random: String(Math.random()),
    ack: '',
    code: '',
    reprint_info: '',
    reprint_confirm: '0',
    list: '',
    groupid: '',
    sex: '0',
    country: '',
    province: '',
    city: '',
    send_time: '0',
    type: '10',
    share_page: '1',
    synctxweibo: '0',
    operation_seq: ctx.operationSeq || '',
    req_id: reqId32(),
    req_time: String(Date.now()),
    sync_version: '1',
    isFreePublish: 'true',
    appmsgid,
    isMulti: '0',
    direct_send: '1'
  })
  if (ctx.fingerprint) params.set('fingerprint', ctx.fingerprint)

  const sendUrl = `${MP}/cgi-bin/masssend?t=ajax-response&is_release_publish_page=1&lang=zh_CN&token=${encodeURIComponent(ctx.token)}`
  const refererEdit = appmsgEditPageUrl(ctx, appmsgid, '77')

  const r = await fetch(sendUrl, {
    method: 'POST',
    headers: {
      Cookie: ctx.cookieHeader,
      Origin: MP,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Referer: refererEdit,
      'User-Agent': UA,
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: params
  })
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>
  const br = j.base_resp as { ret?: number; err_msg?: string } | undefined
  if (br?.ret === 0) return j
  const snippet = JSON.stringify(j).slice(0, 700)
  throw new Error(
    `masssend ret=${String(br?.ret ?? '')} err_msg=${String(br?.err_msg ?? '')} | ${snippet}`
  )
}

/**
 * @param imageFallback 若 CDN 拉取封面失败，可用正文配套 Buffer 走 filetransfer
 */
export async function tryPublishWechatMpViaWebSession (
  userId: string,
  input: WechatMpWebPublishInput,
  imageFallback?: { buffer: Buffer; filename: string; contentType: string }
): Promise<WechatMpWebPublishResult> {
  try {
    const ctx = await resolveMpContext(userId)
    if (!ctx) {
      return {
        ok: false,
        error: '无法解析公众平台登录态（token / 群发页票据）',
        hint: '请重新用「本机浏览器」绑定，并确认已进入 mp.weixin.qq.com 后台'
      }
    }

    let coverCdn = ''
    let fileId = ''

    const applyFiletransfer = async (
      buffer: Buffer,
      filename: string,
      contentType: string
    ) => {
      const up = await uploadCoverViaFiletransfer(ctx, buffer, filename, contentType)
      coverCdn = up.cdn_url
      fileId = up.fileid
    }

    /**
     * 优先走 filetransfer（同时拿到 fileid + cdn_url）。仅 uploadimg2cdn 往往没有 fileid，
     * 易在 operate_appmsg 收到 ret 154011 等含糊错误。
     */
    try {
      if (imageFallback) {
        await applyFiletransfer(
          imageFallback.buffer,
          imageFallback.filename,
          imageFallback.contentType
        )
      } else {
        const ac = new AbortController()
        const to = setTimeout(() => ac.abort(), 25000)
        try {
          const imgRes = await fetch(input.coverImageUrl, {
            redirect: 'follow',
            signal: ac.signal
          })
          if (!imgRes.ok) throw new Error(`封面 URL 响应 ${imgRes.status}`)
          const buf = Buffer.from(await imgRes.arrayBuffer())
          const ct = imgRes.headers.get('content-type') || 'image/jpeg'
          const fn = ct.includes('png') ? 'cover.png' : 'cover.jpg'
          await applyFiletransfer(buf, fn, ct)
        } finally {
          clearTimeout(to)
        }
      }
    } catch (e) {
      try {
        coverCdn = await uploadImg2Cdn(ctx, input.coverImageUrl)
        fileId = ''
      } catch (e2) {
        if (imageFallback) {
          try {
            await applyFiletransfer(
              imageFallback.buffer,
              imageFallback.filename,
              imageFallback.contentType
            )
          } catch (e3) {
            return {
              ok: false,
              error: '封面上传失败',
              detail: [
                e instanceof Error ? e.message : String(e),
                e2 instanceof Error ? e2.message : String(e2),
                e3 instanceof Error ? e3.message : String(e3)
              ].join(' | '),
              hint: '请保证封面图为公网可抓取 URL；或发布时附带封面文件'
            }
          }
        } else {
          return {
            ok: false,
            error: '封面上传失败',
            detail: [
              e instanceof Error ? e.message : String(e),
              e2 instanceof Error ? e2.message : String(e2)
            ].join(' | '),
            hint: '请保证封面图为公网 HTTPS 直链；或配置 NEXT_PUBLIC_BASE_URL 使本站图可被本机访问'
          }
        }
      }
    }

    if (!coverCdn) {
      return {
        ok: false,
        error: '封面上传失败',
        detail: '未得到可用的封面 cdn_url',
        hint: '请确认封面 URL 可访问，或发布时附带封面图片'
      }
    }

    const appMsgId = await operateAppmsgCreate(ctx, {
      ...input,
      coverCdnUrl: coverCdn,
      fileId
    })

    try {
      let ctxWork = await mergeMassSendPageFresh(ctx)
      await warmupExistingAppmsgEditor(ctxWork, appMsgId)
      await fetchMasssendpagePreviewAppmsg(ctxWork, appMsgId)
      await fetchAppmsgpublishListWarmup(ctxWork, appMsgId)
      ctxWork = await mergeMassSendPageFresh(ctxWork)
      ctxWork = await enrichFingerprintFromAppmsgPages(ctxWork, appMsgId)
      ctxWork = await mergeMassSendPageFresh(ctxWork)
      await copyrightChecks(ctxWork, appMsgId)
      const ctxForSend = await mergeMassSendPageFresh(ctxWork)
      if (ctxForSend.massProtect) {
        return {
          ok: false,
          error: '公众号已开启群发二次验证，无法自动完成最后一步',
          detail: 'MASS_PROTECT',
          appMsgId,
          hint:
            '图文已进入素材库。请用手机扫码完成群发确认，或在微信公众平台关闭群发保护后再从本系统重试；也可在后台群发里手动选用该图文。'
        }
      }
      const masssendJson = await massSendGraphic(ctxForSend, appMsgId)
      const publishedUrl =
        (await resolvePublishedMpArticleUrl(ctxForSend, appMsgId, masssendJson)) ??
        undefined

      return {
        ok: true,
        appMsgId,
        publishedUrl,
        hint: publishedUrl
          ? undefined
          : '群发已成功；正式链接同步可能有延迟，请稍后在公众平台「发表记录」复制链接，或在发布记录中刷新后重试。'
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.startsWith('MASS_PROTECT')) {
        return {
          ok: false,
          error: '群发保护阻止了自动发送',
          detail: msg,
          appMsgId,
          hint:
            '图文已写好。请到 mp.weixin.qq.com 关闭群发二次验证或按后台提示扫码后，再群发；素材中已有一条对应的图文。'
        }
      }
      const isCopyrightStat = msg.startsWith('get_appmsg_copyright_stat')
      const copyrightHint =
        isCopyrightStat && msg.includes('154011')
          ? '若本条为旧版报错：当前代码已尝试从编辑页补 fingerprint、请求体带 operation_seq，并在「全部为 ret=154011」时自动跳过版权预检继续群发。仍失败请重新绑定浏览器会话，或设 WECHAT_MP_STRICT_COPYRIGHT=1 恢复严格预检并用 WECHAT_MP_SKIP_COPYRIGHT=1 排查。'
          : isCopyrightStat
            ? '版权预检失败。请到后台对**同一篇图文**完整走一遍「群发」（含可能出现的扫码），必要时用开发者工具对比 get_appmsg_copyright_stat 的请求体与指纹等字段。勿泄露完整 Cookie。'
            : '若以 masssend ret= 开头，多为群发接口拒绝：同样常见需管理员在后台扫码确认；也可对照浏览器里最终群发 XHR 的表单字段。'
      return {
        ok: false,
        error: '图文已保存，但群发未成功',
        detail: msg.slice(0, 900),
        appMsgId,
        hint: copyrightHint
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.startsWith('MASS_PROTECT')) {
      return {
        ok: false,
        error: '群发保护已开启',
        detail: msg,
        hint: '请在 mp.weixin.qq.com 关闭群发二次验证后重试'
      }
    }
    const hint154011 =
      msg.includes('154011')
        ? '已做：编辑页预热、Origin/Referer 对齐、多组 show_cover_pic/need_open_comment/copyright 重试。若 operate_appmsg 仍 154011，多为正文/HTML 或公众号策略。若在 get_appmsg_copyright_stat 阶段 154011，常与**需在浏览器内完成管理员扫码/安全校验**有关，草稿可随后在后台群发完成发布。'
        : undefined
    return {
      ok: false,
      error: '公众平台网页发文失败',
      detail: msg.slice(0, 800),
      hint: hint154011
    }
  }
}
