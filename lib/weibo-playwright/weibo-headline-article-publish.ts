import { markdownToHtml } from '@/lib/utils/markdown-to-html'
import { stripMarkdownFromTitle } from '@/lib/utils/strip-markdown-title'
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
import { readWeiboPlaywrightProfile } from '@/lib/weibo-playwright/session-files'
import {
  loadImagePartForWeibo,
  uploadOneWeiboPicB64,
  type ImagePart
} from '@/lib/weibo-playwright/weibo-web-pic-upload'
import { weiboProfileStatusUrl } from '@/lib/weibo-playwright/weibo-profile-status-url'
import type { WeiboPublishConfigData } from '@/types/platform-config.types'
import { randomBytes } from 'crypto'

/** 头条 v5 流程可读的平台发布配置子集 */
export type WeiboHeadlinePublishInput = Pick<
  WeiboPublishConfigData,
  | 'articleColumnName'
  | 'articleFollowersOnlyFullText'
  | 'articleContentDeclaration'
  | 'articleWeiboStatusText'
>

export type HeadlineArticlePublishResult =
  | { ok: true; platformPostId?: string; publishedUrl?: string }
  | { ok: false; error: string; detail?: string }

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** 文章编辑器与保存接口所在站点多在 card 域；.cn 与 .com Cookie 常互通，接口可能仅一端生效 */
const CARD_BASES = ['https://card.weibo.com', 'https://card.weibo.cn'] as const

const SAVE_PATH_CANDIDATES = [
  '/article/v3/idea/ajax/saveorupdate',
  '/article/v3/editor/ajax/saveorupdate',
  '/article/v4/idea/ajax/saveorupdate',
  '/article/v4/editor/ajax/saveorupdate'
] as const

/** 头条自动发布失败时提示：微博侧风控常要求当日首篇在草稿箱内手动发 */
const WEIBO_HEADLINE_RISK_CONTROL_USER_HINT =
  '因微博风控策略，通常每天的第一篇文章需要到微博「文章草稿箱」中手动发布。'

const V5_EDITOR_PATH = '/article/v5/editor'
const V5_AJ_BASE = '/article/v5/aj/editor'

/** 与抓包一致：query 参数 `_rid`，长约 43 的随机串 */
function makeArticleV5Rid (): string {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
  const bytes = randomBytes(48)
  let s = ''
  for (let i = 0; i < 43; i++) {
    s += alphabet[bytes[i]! % alphabet.length]
  }
  return s
}

function v5Success (j: Record<string, unknown>): boolean {
  const c = j.code
  const ret = j.retcode
  return (
    c === '100000' ||
    c === 100000 ||
    j.ok === 1 ||
    j.ok === '1' ||
    j.success === true ||
    ret === 0 ||
    ret === '0' ||
    ret === 20000000 ||
    ret === '20000000'
  )
}

function v5SuccessJson (raw: string): boolean {
  try {
    const j = JSON.parse(raw) as Record<string, unknown>
    return v5Success(j)
  } catch {
    return false
  }
}

/**
 * save 成功响应里常带服务端 `updated`（及 ver）；若不写回下一轮 save/publish，
 * 部分账号会固定 500002「请手动保存后重新提交」（乐观锁/版本不一致）。
 */
function mergeDraftMetaFromV5SaveResponse (
  raw: string,
  shell: Record<string, unknown>
): void {
  try {
    const j = JSON.parse(raw) as Record<string, unknown>
    if (!v5Success(j)) return
    let d: unknown = j.data
    if (typeof d === 'string') {
      try {
        d = JSON.parse(d)
      } catch {
        return
      }
    }
    if (d == null) return
    const apply = (o: Record<string, unknown>) => {
      const u = o.updated
      if (u != null && String(u).trim()) shell.updated = String(u)
      const ver = o.ver
      if (ver != null && String(ver).trim()) shell.ver = String(ver)
    }
    if (typeof d === 'object' && !Array.isArray(d)) {
      const o = d as Record<string, unknown>
      if (o.draft && typeof o.draft === 'object' && !Array.isArray(o.draft)) {
        apply(o.draft as Record<string, unknown>)
      } else {
        apply(o)
      }
    } else if (Array.isArray(d) && d[0] && typeof d[0] === 'object') {
      apply(d[0] as Record<string, unknown>)
    }
  } catch {
    /* ignore */
  }
}

/** 模拟浏览器打开「该草稿」v5 编辑器页，便于服务端标记草稿会话（仅 GET HTML，Referer 不用带 query） */
async function fetchV5EditorDraftHtmlWarmup (
  cardBase: string,
  cookieHeader: string,
  uid: string,
  draftId: string
): Promise<void> {
  const q = `id=${encodeURIComponent(draftId)}&uid=${encodeURIComponent(uid)}`
  try {
    await fetch(`${cardBase}${V5_EDITOR_PATH}?${q}`, {
      method: 'GET',
      headers: {
        Cookie: cookieHeader,
        Referer: 'https://weibo.com/',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'User-Agent': UA
      },
      redirect: 'follow',
      cache: 'no-store'
    })
  } catch {
    /* ignore */
  }
}

/** load 返回的完整 data（可能含 draft 外壳，save 有时必须原样回传） */
function parseV5LoadFullEnvelope (raw: string): Record<string, unknown> | null {
  try {
    const j = JSON.parse(raw) as Record<string, unknown>
    if (!v5Success(j)) return null
    let d: unknown = j.data
    if (typeof d === 'string') {
      try {
        d = JSON.parse(d)
      } catch {
        return null
      }
    }
    if (d && typeof d === 'object' && !Array.isArray(d)) {
      return JSON.parse(JSON.stringify(d)) as Record<string, unknown>
    }
  } catch {
    /* ignore */
  }
  return null
}

function parseV5LoadDraftData (raw: string): Record<string, unknown> | null {
  try {
    const j = JSON.parse(raw) as Record<string, unknown>
    if (!v5Success(j)) return null
    let d: unknown = j.data
    if (typeof d === 'string') {
      try {
        d = JSON.parse(d)
      } catch {
        return null
      }
    }
    if (d && typeof d === 'object' && !Array.isArray(d)) {
      const o = d as Record<string, unknown>
      if (o.draft && typeof o.draft === 'object' && !Array.isArray(o.draft)) {
        return JSON.parse(JSON.stringify(o.draft)) as Record<string, unknown>
      }
      if (o.article && typeof o.article === 'object' && !Array.isArray(o.article)) {
        return JSON.parse(JSON.stringify(o.article)) as Record<string, unknown>
      }
      return JSON.parse(JSON.stringify(o)) as Record<string, unknown>
    }
    if (Array.isArray(d) && d[0] && typeof d[0] === 'object') {
      return JSON.parse(JSON.stringify(d[0])) as Record<string, unknown>
    }
  } catch {
    /* ignore */
  }
  return null
}

const V5_TITLE_KEYS = new Set([
  'title',
  'article_title',
  'articleTitle',
  'subject',
  'name',
  'article_name'
])
const V5_CONTENT_KEYS = new Set([
  'content',
  /** free_content 不在此集合：扁平 save 抓包多为空，仅 content 承载正文 */
  'html',
  'article_content',
  'body',
  'text',
  'articleContent',
  'rich_content',
  'article_html',
  'idea_content',
  'paid_content'
])
const V5_COVER_KEYS = new Set(['cover', 'cover_pid', 'coverpid', 'cover_id', 'pic_id'])
const V5_SUMMARY_KEYS = new Set(['summary', 'intro', 'description', 'digest'])

function plainTextExcerpt (html: string, maxLen: number): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
}

/**
 * 头条 v5 draft/save 对标题校验严：过长、换行、Markdown 残留、URL、控制字符等易触发 `111002`（标题不符合规范）。
 * PC 端文章编辑器标题上限多为 **32 字**（unicode 码点计），超过后草稿能存但发布按钮/接口会拦。
 * @see 扁平 save 字段 title 与 JSON 树内 title 均经此规范化后再提交
 */
const WEIBO_HEADLINE_TITLE_MAX_LEN = 32

function normalizeWeiboHeadlineTitleForV5 (
  raw: string,
  bodyHtmlForFallback: string
): string {
  let t = stripMarkdownFromTitle(raw)

  if (t.length > WEIBO_HEADLINE_TITLE_MAX_LEN) {
    t = t.slice(0, WEIBO_HEADLINE_TITLE_MAX_LEN).trim()
    while (t.length > 0 && /[\uD800-\uDFFF]$/.test(t)) {
      t = t.slice(0, -1)
    }
  }

  if (!t) {
    const plain = stripMarkdownFromTitle(plainTextExcerpt(bodyHtmlForFallback, 120))
    t =
      plain.slice(0, WEIBO_HEADLINE_TITLE_MAX_LEN).trim() || '头条文章'
  }
  return t
}

/**
 * 导语过短/为空时部分账号 publish 恒 500002；过长或含链接等又易 111004。
 * 使用正文纯文本前若干字（去 URL、strip 标题类 MD），必要时退回标题截断。
 */
const WEIBO_HEADLINE_SUMMARY_MAX_LEN = 24

function safeWeiboHeadlineSummaryForV5 (bodyHtml: string, titleTrim: string): string {
  let s = plainTextExcerpt(bodyHtml, 400)
  s = stripMarkdownFromTitle(s)
  s = s.replace(/https?:\/\/\S+/gi, '').replace(/\s+/g, ' ').trim()
  if (s.length > WEIBO_HEADLINE_SUMMARY_MAX_LEN) {
    s = s.slice(0, WEIBO_HEADLINE_SUMMARY_MAX_LEN).trim()
  }
  const tit = stripMarkdownFromTitle(titleTrim).slice(0, WEIBO_HEADLINE_SUMMARY_MAX_LEN).trim()
  if (!s || (tit && s === tit)) {
    s = tit || '阅读全文'
  }
  if (s.length > WEIBO_HEADLINE_SUMMARY_MAX_LEN) {
    s = s.slice(0, WEIBO_HEADLINE_SUMMARY_MAX_LEN).trim()
  }
  return s || '阅读全文'
}

function nonEmptyStr (v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0
}

function optionalTrim (s: string | undefined): string | undefined {
  if (typeof s !== 'string') return undefined
  const t = s.trim()
  return t.length ? t : undefined
}

/** v5 draft/save 抓包：cover 多为 wx*.sinaimg.cn 完整 URL；仅 pid 时再拼 large（常见 wx1） */
function normalizeWeiboV5CoverForSave (pidOrUrl: string): string {
  const t = pidOrUrl.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  const basePid = t.replace(/\.(jpe?g|png|gif|webp)$/i, '')
  /** PC 抓包封面多为 wx1；上传接口若已返回完整 URL 则原样使用 */
  return `https://wx1.sinaimg.cn/large/${basePid}.jpg`
}

/** 从 wx*.sinaimg.cn 的 large 等路径取出 pid，供 draft/save 附加 cover_pid */
function extractWeiboLargePidFromCoverUrl (coverUrl: string): string | null {
  const t = coverUrl.trim()
  const m = t.match(
    /\/(?:large|mw690|orj360|bmiddle)\/([^./?#]+)\.(?:jpe?g|png|gif|webp)/i
  )
  if (m?.[1] && m[1].length > 8) return m[1]
  return null
}

const V5_PAY_SETTING_DEFAULT_OBJ = {
  ispay: 0,
  isvclub: 0,
  is_single_pay: 0,
  single_price: 0
} as const
const V5_PAY_SETTING_DEFAULT_JSON = JSON.stringify(V5_PAY_SETTING_DEFAULT_OBJ)

/** 与编辑器展示一致：YYYY-MM-DD HH:mm:ss（本地时间） */
function weiboDraftUpdatedTimestamp (): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** v5 draft/load 常见扁平 data：title/content/free_content/summary/cover… */
function injectTitleHtmlIntoDraftTree (
  root: Record<string, unknown>,
  title: string,
  html: string,
  coverPid: string,
  summaryPlain: string
): void {
  const visit = (o: Record<string, unknown>): void => {
    for (const k of Object.keys(o)) {
      const v = o[k]
      if (V5_TITLE_KEYS.has(k)) o[k] = title
      if (V5_CONTENT_KEYS.has(k)) o[k] = html
      if (V5_SUMMARY_KEYS.has(k)) o[k] = summaryPlain
      if (coverPid && V5_COVER_KEYS.has(k)) o[k] = coverPid
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        visit(v as Record<string, unknown>)
      }
    }
  }
  visit(root)
  if (!nonEmptyStr(root.title)) root.title = title
  if (!nonEmptyStr(root.content)) root.content = html
  root.summary = summaryPlain
  if (coverPid && !nonEmptyStr(root.cover)) root.cover = coverPid
}

function buildSavePayloadFromLoad (
  loaded: Record<string, unknown> | null,
  title: string,
  html: string,
  coverPid: string,
  summaryPlain: string
): Record<string, unknown> | null {
  if (!loaded || Object.keys(loaded).length === 0) return null
  const draft = JSON.parse(JSON.stringify(loaded)) as Record<string, unknown>
  injectTitleHtmlIntoDraftTree(draft, title, html, coverPid, summaryPlain)
  return draft
}

/**
 * draft/load 未带登录会返回 100001 / data:[]；与成功 load 的扁平 data 字段对齐，供 save 仍能提交正文。
 */
function buildSyntheticV5DraftShell (draftId: string): Record<string, unknown> {
  return {
    id: String(draftId),
    title: '',
    updated: '',
    free_content: '',
    content: '',
    cover: '',
    summary: '',
    writer: '',
    extra: [],
    type: '',
    is_word: 0,
    is_markdown: 0,
    article_recommend: {},
    status: 0,
    error_msg: '',
    error_code: 0,
    publish_at: '',
    publish_local_at: '',
    timestamp: '',
    is_article_free: 0,
    only_render_h5: 0,
    is_ai_plugins: 0,
    is_aigc_used: 0,
    /** 成功保存抓包多为 is_v4=1（ver=4.0 编辑器） */
    is_v4: 1,
    follow_to_read: 0,
    follow_to_read_detail: {
      result: 0,
      x: 0,
      y: 0,
      readme_link: 'http://t.cn/A6UnJsqW',
      level: '',
      daily_limit: 1,
      daily_limit_notes: '非认证用户单日仅限1篇文章使用',
      show_level_tips: 0
    },
    isreward: 0,
    isreward_tips: '',
    isreward_tips_url: '',
    pay_setting: { ...V5_PAY_SETTING_DEFAULT_OBJ },
    source: '',
    action: 2,
    is_single_pay_new: 0,
    money: 0,
    is_vclub_single_pay: 0,
    vclub_single_pay_money: 0,
    content_type: 0,
    ver: '4.0'
  }
}

/** 浏览器 draft/save：扁平表单，非包在 data JSON 里 */
function v5SaveRecordForFlatPayload (
  sp: unknown,
  draftId: string
): Record<string, unknown> | null {
  if (!sp || typeof sp !== 'object' || Array.isArray(sp)) return null
  const o = sp as Record<string, unknown>
  let base: Record<string, unknown>
  if (o.draft && typeof o.draft === 'object' && !Array.isArray(o.draft)) {
    base = JSON.parse(JSON.stringify(o.draft)) as Record<string, unknown>
    if (base.id == null) base.id = o.id ?? draftId
  } else {
    base = JSON.parse(JSON.stringify(o)) as Record<string, unknown>
  }
  if (base.id == null) base.id = draftId
  return base
}

function buildV5BrowserFlatSaveBody (
  shell: Record<string, unknown>,
  opts: {
    draftId: string
    uid: string
    title: string
    html: string
    summary: string
    cover: string
    rid: string
    xsrf: string | null
    /** 专栏名等，写入 source */
    articleSource?: string
    /** false 时 follow_to_read=0 */
    followersOnlyFullText?: boolean
  }
): string {
  const p = new URLSearchParams()
  const id = String(shell.id ?? opts.draftId)
  p.set('save', '1')
  p.set('id', id)
  p.set('title', opts.title)
  const upd = shell.updated
  p.set(
    'updated',
    typeof upd === 'string' && nonEmptyStr(upd) ? upd : weiboDraftUpdatedTimestamp()
  )
  /** 成功抓包：free_content 常为空，正文仅在 content */
  const free =
    typeof shell.free_content === 'string' && nonEmptyStr(shell.free_content)
      ? shell.free_content
      : ''
  p.set('free_content', free)
  p.set('content', opts.html)
  const coverTrim = opts.cover.trim()
  p.set('cover', opts.cover)
  const coverPidFlat = extractWeiboLargePidFromCoverUrl(coverTrim)
  if (coverPidFlat) {
    p.set('cover_pid', coverPidFlat)
  } else if (
    coverTrim.length > 12 &&
    /^[a-z0-9]+$/i.test(coverTrim) &&
    !/^https?:\/\//i.test(coverTrim)
  ) {
    /** 图床仅返回 pid 时与 cover 同写入 cover_pid */
    p.set('cover_pid', coverTrim)
  }
  p.set('summary', opts.summary)
  p.set('writer', typeof shell.writer === 'string' ? shell.writer : '')
  if (typeof shell.extra === 'string') {
    p.set('extra', shell.extra)
  } else if (shell.extra == null) {
    p.set('extra', '[]')
  } else {
    p.set('extra', JSON.stringify(shell.extra))
  }
  p.set('type', typeof shell.type === 'string' ? shell.type : '')
  p.set('is_word', String(shell.is_word ?? 0))
  p.set('is_markdown', String(shell.is_markdown ?? 0))
  p.set('article_recommend', '{}')
  p.set('status', String(shell.status ?? 0))
  p.set('error_msg', typeof shell.error_msg === 'string' ? shell.error_msg : '')
  p.set('error_code', String(shell.error_code ?? 0))
  p.set(
    'publish_at',
    typeof shell.publish_at === 'string' ? shell.publish_at : ''
  )
  p.set(
    'publish_local_at',
    typeof shell.publish_local_at === 'string' ? shell.publish_local_at : ''
  )
  p.set('timestamp', typeof shell.timestamp === 'string' ? shell.timestamp : '')
  p.set('is_article_free', String(shell.is_article_free ?? 0))
  p.set('only_render_h5', String(shell.only_render_h5 ?? 0))
  p.set('is_ai_plugins', String(shell.is_ai_plugins ?? 0))
  p.set('is_aigc_used', String(shell.is_aigc_used ?? 0))
  /** 成功保存抓包多为 is_v4=1 */
  p.set('is_v4', String(shell.is_v4 ?? 1))
  /** 抓包默认 follow_to_read=0；仅配置 articleFollowersOnlyFullText===true 时为 1 */
  const followRead = opts.followersOnlyFullText === true ? 1 : 0
  p.set('follow_to_read', String(followRead))
  const ftr = shell.follow_to_read_detail
  /** follow_to_read=0 时抓包为 result=0；为 1 时一般为 result=1 */
  const ftrResult = followRead
  if (ftr && typeof ftr === 'object' && !Array.isArray(ftr)) {
    const o = ftr as Record<string, unknown>
    p.set('follow_to_read_detail[result]', String(ftrResult))
    p.set('follow_to_read_detail[x]', String(o.x ?? 0))
    p.set('follow_to_read_detail[y]', String(o.y ?? 0))
    p.set(
      'follow_to_read_detail[readme_link]',
      typeof o.readme_link === 'string' && nonEmptyStr(o.readme_link)
        ? o.readme_link
        : 'http://t.cn/A6UnJsqW'
    )
    p.set('follow_to_read_detail[level]', typeof o.level === 'string' ? o.level : '')
    p.set('follow_to_read_detail[daily_limit]', String(o.daily_limit ?? 1))
    p.set(
      'follow_to_read_detail[daily_limit_notes]',
      typeof o.daily_limit_notes === 'string' && nonEmptyStr(o.daily_limit_notes)
        ? o.daily_limit_notes
        : '非认证用户单日仅限1篇文章使用'
    )
    p.set(
      'follow_to_read_detail[show_level_tips]',
      String(o.show_level_tips ?? 0)
    )
  } else {
    p.set('follow_to_read_detail[result]', String(ftrResult))
    p.set('follow_to_read_detail[x]', '0')
    p.set('follow_to_read_detail[y]', '0')
    p.set('follow_to_read_detail[readme_link]', 'http://t.cn/A6UnJsqW')
    p.set('follow_to_read_detail[level]', '')
    p.set('follow_to_read_detail[daily_limit]', '1')
    p.set(
      'follow_to_read_detail[daily_limit_notes]',
      '非认证用户单日仅限1篇文章使用'
    )
    p.set('follow_to_read_detail[show_level_tips]', '0')
  }
  p.set('isreward', String(shell.isreward ?? 0))
  p.set('isreward_tips', typeof shell.isreward_tips === 'string' ? shell.isreward_tips : '')
  p.set(
    'isreward_tips_url',
    typeof shell.isreward_tips_url === 'string' &&
      nonEmptyStr(shell.isreward_tips_url)
      ? String(shell.isreward_tips_url)
      : `https://card.weibo.com/article/v3/aj/editor/draft/applyisrewardtips?uid${opts.uid}`
  )
  const ps = shell.pay_setting
  if (typeof ps === 'string' && nonEmptyStr(ps)) {
    p.set('pay_setting', ps)
  } else if (ps && typeof ps === 'object' && !Array.isArray(ps)) {
    p.set('pay_setting', JSON.stringify(ps))
  } else {
    p.set('pay_setting', V5_PAY_SETTING_DEFAULT_JSON)
  }
  p.set(
    'source',
    typeof opts.articleSource === 'string' && nonEmptyStr(opts.articleSource)
      ? opts.articleSource.trim()
      : typeof shell.source === 'string'
        ? shell.source
        : ''
  )
  p.set('action', String(shell.action ?? 2))
  p.set('is_single_pay_new', String(shell.is_single_pay_new ?? 0))
  p.set('money', String(shell.money ?? 0))
  p.set('is_vclub_single_pay', String(shell.is_vclub_single_pay ?? 0))
  p.set('vclub_single_pay_money', String(shell.vclub_single_pay_money ?? 0))
  p.set('_rid', opts.rid)
  p.set('content_type', String(shell.content_type ?? 0))
  p.set('sp_fid', typeof shell.sp_fid === 'string' ? shell.sp_fid : '')
  p.set('collection', '[]')
  p.set('ver', typeof shell.ver === 'string' && nonEmptyStr(shell.ver) ? shell.ver : '4.0')
  if (opts.xsrf) {
    p.set('st', opts.xsrf)
  }
  return p.toString()
}

/**
 * v5 编辑器点击「发布」：URL 为 publish?uid&id&_rid（_rid 仅在 query，不在 body）；body 与抓包一致。
 */
function buildV5CardSyncPublishFlatBody (
  draftId: string,
  uid: string,
  articleTitle: string,
  textVariant: 'space' | 'plus',
  publishOpts?: {
    statusTextOverride?: string
    mblogStatement?: string
    followToRead?: boolean
    /** 抓包多为 0；部分环境需 1 才会真正发出时间线卡 */
    syncWb?: '0' | '1'
  }
): string {
  const t = articleTitle.trim()
  const custom = optionalTrim(publishOpts?.statusTextOverride)
  /** 与 PC 抓包一致：plus 为 「》+」紧跟结束，其后无空格；space 为 「》」结束无尾空格 */
  const text = custom
    ? custom
    : textVariant === 'plus'
      ? `发布了头条文章：《${t}》+`
      : `发布了头条文章：《${t}》`
  /** 字段顺序与 card v5 draft/publish 抓包一致 */
  const p = new URLSearchParams()
  p.set('rank', '0')
  p.set('mblog_statement', publishOpts?.mblogStatement ?? '0')
  p.set('sync_wb', publishOpts?.syncWb ?? '0')
  p.set('is_original', '0')
  p.set('follow_official', '0')
  p.set('text', text)
  p.set('time', '')
  p.set('id', String(draftId))
  p.set('timestamp', '')
  p.set('only_render_h5', '0')
  p.set('is_aigc_used', '0')
  /** 与 save/publish 抓包一致：默认 0；仅显式 true 时为 1 */
  p.set(
    'follow_to_read',
    publishOpts?.followToRead === true ? '1' : '0'
  )
  p.set('mpkey', '0')
  p.set('uid', String(uid))
  p.set('ver', '4.0')
  p.set('support_all_tag', '1')
  /** 真机抓包 publish body 不含 st；save 仍可用 st，publish 带 st 易与线行为不一致 */
  return p.toString()
}

/** 微博在发布链路中可能要求打开 /article/v5/aj/face 做人脸/扫码，此类校验无法通过改 publish 表单绕过 */
function weiboPublishSecurityHintFromStrings (blob: string): string | null {
  if (
    /\/aj\/face\b/i.test(blob) ||
    /"face"|人脸核验|人脸识别|扫码验证|请.*验证|security.?check/i.test(blob)
  ) {
    return (
      '发布前若出现「人脸/扫码」或请求 /article/v5/aj/face：请在已登录 card.weibo.com 的浏览器中完成微博安全校验后再用本系统发布；该步骤由账号风控触发，不能通过省略接口参数规避。'
    )
  }
  return null
}

async function fetchV5DraftLoadRaw (
  cardBase: string,
  uid: string,
  draftId: string,
  baseHeaders: () => Record<string, string>,
  xsrf: string | null,
  log: string[]
): Promise<{ raw: string; draft: Record<string, unknown> | null }> {
  let lastRaw = ''
  for (let i = 0; i < 3; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, 400))
    }
    const loadUrl = `${cardBase}${V5_AJ_BASE}/draft/load?uid=${encodeURIComponent(uid)}&id=${encodeURIComponent(draftId)}&_rid=${encodeURIComponent(makeArticleV5Rid())}`
    try {
      const loadRes = await fetch(loadUrl, {
        method: 'GET',
        headers: baseHeaders(),
        cache: 'no-store'
      })
      lastRaw = await loadRes.text()
      const draft = parseV5LoadDraftData(lastRaw)
      if (draft) return { raw: lastRaw, draft }
      log.push(
        `v5 draft/load GET#${i} HTTP ${loadRes.status}: ${lastRaw.slice(0, 140)}`
      )
    } catch (e) {
      log.push(
        `v5 draft/load GET#${i}: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }
  if (xsrf) {
    const loadUrl = `${cardBase}${V5_AJ_BASE}/draft/load?uid=${encodeURIComponent(uid)}&id=${encodeURIComponent(draftId)}&_rid=${encodeURIComponent(makeArticleV5Rid())}`
    try {
      const form = new URLSearchParams()
      form.set('st', xsrf)
      const loadRes = await fetch(loadUrl, {
        method: 'POST',
        headers: {
          ...baseHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: form.toString(),
        cache: 'no-store'
      })
      lastRaw = await loadRes.text()
      const draft = parseV5LoadDraftData(lastRaw)
      if (draft) return { raw: lastRaw, draft }
      log.push(
        `v5 draft/load POST(st) HTTP ${loadRes.status}: ${lastRaw.slice(0, 140)}`
      )
    } catch (e) {
      log.push(
        `v5 draft/load POST: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }
  return { raw: lastRaw, draft: null }
}

function parseV5DraftIdFromCreate (raw: string): { ok: true; draftId: string } | { ok: false; msg: string } {
  const t = raw.trim()
  if (!t) return { ok: false, msg: '(空响应)' }
  try {
    const j = JSON.parse(t) as Record<string, unknown>
    if (!v5Success(j)) {
      const msg = [j.msg, j.message].filter((x) => typeof x === 'string').join(' — ')
      return { ok: false, msg: msg || t.slice(0, 240) }
    }
    const d = j.data
    if (d && typeof d === 'object' && !Array.isArray(d)) {
      const id =
        (d as Record<string, unknown>).id ??
        (d as Record<string, unknown>).draft_id
      if (id != null) return { ok: true, draftId: String(id) }
    }
    if (Array.isArray(d) && d[0] && typeof d[0] === 'object') {
      const id = (d[0] as Record<string, unknown>).id
      if (id != null) return { ok: true, draftId: String(id) }
    }
    return { ok: false, msg: 'create 响应成功但无草稿 id' }
  } catch {
    return { ok: false, msg: t.slice(0, 240) }
  }
}

function wrapArticleHtml (fragment: string): string {
  const t = fragment.trim()
  if (!t) return '<p></p>'
  if (/^<[a-z]/i.test(t) && t.includes('>')) return t
  return `<div class="article-content">${t}</div>`
}

/**
 * 封面 URL 既写入 save 表单的 cover，也应出现在正文首部；
 * 部分环境仅写字段不会在时间线/文末展示缩略图，与 PC 编辑器「文内首图」一致。
 */
function articleBodyHtmlWithCoverFirst (
  html: string,
  coverAbsoluteUrl: string
): string {
  const u = coverAbsoluteUrl.trim()
  if (!u || !/^https:\/\//i.test(u)) return html
  const esc = u.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  if (html.includes(u) || html.includes(esc)) return html
  return `<p><img src="${esc}" alt="cover" /></p>\n${html}`
}

/** 从 v5 等 JSON 文本中用正则兜底抽出链接/长数字 id（data 为空数组时常见） */
function regexExtractWeiboPublishMeta (raw: string): { id?: string; url?: string } | null {
  const tt = raw.match(/https:\/\/weibo\.com\/ttarticle\/p\/show\?id=(\d+)/)
  if (tt) return { id: tt[1], url: tt[0] }
  const profileUrl = raw.match(/https:\/\/weibo\.com\/(\d+)\/(\d{10,})\b/)
  if (profileUrl) {
    return {
      id: profileUrl[2],
      url: `https://weibo.com/${profileUrl[1]}/${profileUrl[2]}`
    }
  }
  const idstr = raw.match(/"idstr"\s*:\s*"(\d{10,})"/)
  if (idstr) return { id: idstr[1] }
  const mid = raw.match(/"mid"\s*:\s*"(\d{10,})"/)
  if (mid) return { id: mid[1] }
  const oid = raw.match(/"object_id"\s*:\s*"?(\d{10,})"?/)
  if (oid) return { id: oid[1] }
  const articleId = raw.match(/"article_id"\s*:\s*"?(\d{10,})"?/)
  if (articleId) return { id: articleId[1] }
  return null
}

async function fetchCardEditorHtml (
  cardBase: string,
  cookieHeader: string
): Promise<string | null> {
  try {
    const res = await fetch(`${cardBase}/article/v3/editor`, {
      headers: {
        Cookie: cookieHeader,
        Accept: 'text/html,application/xhtml+xml',
        Referer: 'https://weibo.com/',
        'User-Agent': UA
      },
      redirect: 'follow',
      cache: 'no-store'
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

function parseSaveResponse (
  raw: string
): { ok: boolean; id?: string; url?: string; msg?: string } {
  const t = raw.trim()
  if (!t) return { ok: false, msg: '(空响应)' }
  try {
    const j = JSON.parse(t) as Record<string, unknown>
    const code = j.code
    const ret = j.retcode
    const numOk =
      code === '100000' ||
      code === 100000 ||
      j.ok === 1 ||
      j.ok === '1' ||
      j.success === true ||
      ret === 0 ||
      ret === '0' ||
      ret === 20000000 ||
      ret === '20000000'
    const data = j.data
    const pickFromObj = (o: Record<string, unknown>) => {
      const idRaw =
        o.id ??
        o.object_id ??
        o.article_id ??
        o.mid ??
        o.idea_id ??
        o.blog_id ??
        o.status_id
      let id: string | undefined =
        idRaw != null ? String(idRaw).replace(/[^\d]/g, '') : undefined
      if (!id || id.length < 8) id = idRaw != null ? String(idRaw) : undefined
      const url =
        typeof o.url === 'string'
          ? o.url
          : typeof o.showurl === 'string'
            ? o.showurl
            : typeof o.detail_url === 'string'
              ? o.detail_url
              : undefined
      return { id, url }
    }
    if (numOk && Array.isArray(data)) {
      if (data.length > 0 && typeof data[0] === 'object') {
        const inner = data[0] as Record<string, unknown>
        const { id, url } = pickFromObj(inner)
        const feedMid = deepFindFeedMid(data)
        const sid = feedMid ?? id
        if (sid || url) return { ok: true, id: sid, url }
      }
    } else if (numOk && data && typeof data === 'object') {
      const d = data as Record<string, unknown>
      const inner =
        d.article && typeof d.article === 'object'
          ? (d.article as Record<string, unknown>)
          : d
      const { id, url } = pickFromObj(inner)
      const feedMid = deepFindFeedMid(data)
      const sid = feedMid ?? id
      if (sid || url) return { ok: true, id: sid, url }
    }
    if (numOk) {
      const rx = regexExtractWeiboPublishMeta(t)
      if (rx?.id || rx?.url) return { ok: true, id: rx.id, url: rx.url }
    }
    const msg = [j.msg, j.message, j.error]
      .filter((x) => typeof x === 'string')
      .join(' — ')
    return { ok: false, msg: msg || t.slice(0, 400) }
  } catch {
    return { ok: false, msg: t.slice(0, 400) }
  }
}

/** 从头条保存接口 JSON 里尽量找出「时间线帖」用的 mid（非 article object_id） */
function deepFindFeedMid (obj: unknown, depth = 0): string | undefined {
  if (depth > 14 || obj == null || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    for (const x of obj) {
      const m = deepFindFeedMid(x, depth + 1)
      if (m) return m
    }
    return
  }
  const o = obj as Record<string, unknown>
  for (const k of [
    'mid',
    'mblogid',
    'mblog_id',
    'status_mid',
    'longBlogId',
    'longblog_id',
    'idstr'
  ]) {
    const v = o[k]
    if (v == null) continue
    const s = String(v).replace(/\D/g, '')
    if (s.length >= 10 && s.length <= 25) return s
  }
  for (const v of Object.values(o)) {
    const m = deepFindFeedMid(v, depth + 1)
    if (m) return m
  }
  return
}

function ttArticleShowUrl (objectId: string): string {
  const digits = objectId.replace(/\D/g, '')
  if (digits.length >= 10) return `https://weibo.com/ttarticle/p/show?id=${digits}`
  return `https://weibo.com/ttarticle/p/show?id=${encodeURIComponent(objectId)}`
}

function headlineSuccessFromParsed (
  userId: string,
  parsed: { id?: string; url?: string }
): HeadlineArticlePublishResult {
  const profile = readWeiboPlaywrightProfile(userId)
  const uid = profile?.weiboUid?.replace(/\D/g, '') ?? ''
  const mid = parsed.id
    ? String(parsed.id).replace(/\D/g, '') || String(parsed.id).trim()
    : ''
  let publishedUrl: string
  if (uid && mid && /^\d{5,25}$/.test(mid)) {
    publishedUrl = weiboProfileStatusUrl(uid, mid)
  } else if (parsed.url && parsed.url.startsWith('http')) {
    publishedUrl = parsed.url
  } else if (parsed.id) {
    publishedUrl = ttArticleShowUrl(parsed.id)
  } else {
    return { ok: false, error: '发布响应无可用链接或 id', detail: JSON.stringify(parsed) }
  }
  return {
    ok: true,
    platformPostId: mid || parsed.id,
    publishedUrl
  }
}

async function fetchCardV5EditorHtml (
  cardBase: string,
  cookieHeader: string
): Promise<string | null> {
  try {
    const res = await fetch(`${cardBase}${V5_EDITOR_PATH}`, {
      headers: {
        Cookie: cookieHeader,
        Accept: 'text/html,application/xhtml+xml',
        Referer: 'https://weibo.com/',
        'User-Agent': UA
      },
      redirect: 'follow',
      cache: 'no-store'
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

/**
 * 文章 v5 编辑器：draft/create → load → save → publish（与 PC 抓包一致，路径见 card.weibo.com/article/v5/aj/editor/…）。
 */
async function tryPublishWeiboArticleV5DraftFlow (
  userId: string,
  cardBase: string,
  cookieHeader: string,
  xsrf: string | null,
  uid: string,
  titleTrim: string,
  html: string,
  coverPid: string,
  log: string[],
  articleCfg?: WeiboHeadlinePublishInput,
  /** draft 创建后、与 card 同会话再传封面（解决先发博成功但 cover 始终空） */
  coverRetry?: { part?: ImagePart; url?: string }
): Promise<HeadlineArticlePublishResult | null> {
  /** PC 抓包：v5 aj 请求的 Referer 多为编辑器路径本身，勿随意加 query（加 uid/id 后曾在部分账号上稳定 500002） */
  const referer = `${cardBase}${V5_EDITOR_PATH}`
  const baseHeaders = (): Record<string, string> => {
    const h: Record<string, string> = {
      Cookie: cookieHeader,
      Referer: referer,
      Origin: cardBase,
      Accept: 'application/json, text/plain, */*',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': UA
    }
    if (xsrf) h['X-Xsrf-Token'] = xsrf
    return h
  }

  const ridCreate = makeArticleV5Rid()
  const createUrl = `${cardBase}${V5_AJ_BASE}/draft/create?uid=${encodeURIComponent(uid)}&_rid=${encodeURIComponent(ridCreate)}`

  let createRes: Response
  try {
    createRes = await fetch(createUrl, {
      method: 'GET',
      headers: baseHeaders(),
      cache: 'no-store'
    })
  } catch (e) {
    log.push(`v5 draft/create: ${e instanceof Error ? e.message : String(e)}`)
    return null
  }
  const createRaw = await createRes.text()
  let created = parseV5DraftIdFromCreate(createRaw)
  if (!created.ok && xsrf) {
    try {
      const form = new URLSearchParams()
      form.set('st', xsrf)
      const postCreate = await fetch(createUrl, {
        method: 'POST',
        headers: {
          ...baseHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: form.toString(),
        cache: 'no-store'
      })
      const postParsed = parseV5DraftIdFromCreate(await postCreate.text())
      if (postParsed.ok) created = postParsed
    } catch (e) {
      log.push(`v5 draft/create POST: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  if (!created.ok) {
    log.push(
      `v5 draft/create HTTP ${createRes.status}: ${created.msg}`
    )
    return null
  }
  const draftId = created.draftId

  let effectiveCoverPid = coverPid.trim()
  const hasUsableCover = (): boolean =>
    !!normalizeWeiboV5CoverForSave(effectiveCoverPid).trim()
  const bumpCoverFromRetry = async (): Promise<void> => {
    if (hasUsableCover()) return
    if (coverRetry?.part?.buffer?.length) {
      const up = await uploadOneWeiboPicB64(userId, coverRetry.part, {
        preferV5EditorCover: true
      })
      if (up.ok) effectiveCoverPid = up.pid
    }
    if (!hasUsableCover() && coverRetry?.url?.trim()) {
      const part = await loadImagePartForWeibo(coverRetry.url.trim())
      if (part) {
        const up = await uploadOneWeiboPicB64(userId, part, {
          preferV5EditorCover: true
        })
        if (up.ok) effectiveCoverPid = up.pid
      }
    }
  }
  await bumpCoverFromRetry()
  if (!hasUsableCover()) {
    await new Promise((r) => setTimeout(r, 500))
    await bumpCoverFromRetry()
  }
  const coverField = normalizeWeiboV5CoverForSave(effectiveCoverPid)
  const bodyHtml = articleBodyHtmlWithCoverFirst(html, coverField)
  if (!coverField.trim()) {
    log.push('v5: 无封面 URL（图床失败或未传图），仅发正文')
  }

  const summaryPlain = safeWeiboHeadlineSummaryForV5(bodyHtml, titleTrim)

  const { raw: loadRawCaptured, draft: loadDraft } = await fetchV5DraftLoadRaw(
    cardBase,
    uid,
    draftId,
    baseHeaders,
    xsrf,
    log
  )

  const savePayloads: object[] = []
  const envelope = loadRawCaptured ? parseV5LoadFullEnvelope(loadRawCaptured) : null
  if (envelope) {
    const full = JSON.parse(JSON.stringify(envelope)) as Record<string, unknown>
    if (full.draft && typeof full.draft === 'object' && !Array.isArray(full.draft)) {
      injectTitleHtmlIntoDraftTree(
        full.draft as Record<string, unknown>,
        titleTrim,
        bodyHtml,
        coverField,
        summaryPlain
      )
    } else {
      injectTitleHtmlIntoDraftTree(full, titleTrim, bodyHtml, coverField, summaryPlain)
    }
    savePayloads.push(full)
  }

  const fromLoad = buildSavePayloadFromLoad(
    loadDraft,
    titleTrim,
    bodyHtml,
    coverField,
    summaryPlain
  )
  if (fromLoad) {
    savePayloads.push(fromLoad)
  }
  if (!envelope && !fromLoad) {
    const syn = buildSyntheticV5DraftShell(draftId)
    injectTitleHtmlIntoDraftTree(syn, titleTrim, bodyHtml, coverField, summaryPlain)
    savePayloads.unshift(syn)
    log.push(
      'v5: draft/load 无有效 data（浏览器直开常为 100001），已用与线上一致的合成草稿壳提交 save'
    )
  }

  const makeSaveUrl = () =>
    `${cardBase}${V5_AJ_BASE}/draft/save?uid=${encodeURIComponent(uid)}&id=${encodeURIComponent(draftId)}&_rid=${encodeURIComponent(makeArticleV5Rid())}`

  let saveAnyOk = false
  /** 用于发布前再 save 一次，缓解「请手动保存后提交」类 500002 */
  let shellForRepublish: Record<string, unknown> | null = null

  const seenFlat = new Set<string>()
  for (const sp of savePayloads) {
    const shell = v5SaveRecordForFlatPayload(sp, draftId)
    if (!shell) continue
    /** load 下来的 shell 可能不带 cover，与扁平表单 cover 强制对齐 */
    if (coverField) shell.cover = coverField
    if (articleCfg?.articleColumnName?.trim()) {
      shell.source = articleCfg.articleColumnName.trim()
    }
    const sig = JSON.stringify(shell)
    if (seenFlat.has(sig)) continue
    seenFlat.add(sig)
    if (seenFlat.size > 8) break

    for (const withSt of [false, true] as const) {
      if (withSt && !xsrf) continue
      const rid = makeArticleV5Rid()
      const bodyStr = buildV5BrowserFlatSaveBody(shell, {
        draftId,
        uid,
        title: titleTrim,
        html: bodyHtml,
        summary: summaryPlain,
        cover: coverField,
        rid,
        xsrf: withSt ? xsrf : null,
        articleSource: articleCfg?.articleColumnName?.trim(),
        followersOnlyFullText: articleCfg?.articleFollowersOnlyFullText
      })
      try {
        const sRes = await fetch(makeSaveUrl(), {
          method: 'POST',
          headers: {
            ...baseHeaders(),
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
          },
          body: bodyStr,
          cache: 'no-store'
        })
        const sRaw = await sRes.text()
        if (v5SuccessJson(sRaw)) {
          saveAnyOk = true
          shellForRepublish = JSON.parse(JSON.stringify(shell)) as Record<string, unknown>
          mergeDraftMetaFromV5SaveResponse(sRaw, shellForRepublish)
          break
        }
        log.push(
          `v5 draft/save flat${withSt ? '+st' : ''} HTTP ${sRes.status}: ${sRaw.slice(0, 140)}`
        )
      } catch (e) {
        log.push(
          `v5 draft/save flat: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }
    if (saveAnyOk) break
  }

  for (const sp of savePayloads) {
    if (saveAnyOk) break
    const bodyAttempts: Array<{ label: string; init: RequestInit }> = []
    const form = new URLSearchParams()
    form.set('data', JSON.stringify(sp))
    bodyAttempts.push({
      label: 'form:data',
      init: {
        method: 'POST',
        headers: {
          ...baseHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: form.toString(),
        cache: 'no-store'
      }
    })
    if (xsrf) {
      const formSt = new URLSearchParams()
      formSt.set('data', JSON.stringify(sp))
      formSt.set('st', xsrf)
      bodyAttempts.push({
        label: 'form:data+st',
        init: {
          method: 'POST',
          headers: {
            ...baseHeaders(),
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
          },
          body: formSt.toString(),
          cache: 'no-store'
        }
      })
    }
    bodyAttempts.push({
      label: 'json',
      init: {
        method: 'POST',
        headers: {
          ...baseHeaders(),
          'Content-Type': 'application/json;charset=UTF-8'
        },
        body: JSON.stringify(sp),
        cache: 'no-store'
      }
    })
    bodyAttempts.push({
      label: 'json:data-wrap',
      init: {
        method: 'POST',
        headers: {
          ...baseHeaders(),
          'Content-Type': 'application/json;charset=UTF-8'
        },
        body: JSON.stringify({ data: JSON.stringify(sp) }),
        cache: 'no-store'
      }
    })

    for (const { label, init } of bodyAttempts) {
      try {
        const sRes = await fetch(makeSaveUrl(), init)
        const sRaw = await sRes.text()
        if (v5SuccessJson(sRaw)) {
          saveAnyOk = true
          const flat = v5SaveRecordForFlatPayload(sp, draftId)
          if (flat) {
            if (coverField) flat.cover = coverField
            shellForRepublish = flat
            mergeDraftMetaFromV5SaveResponse(sRaw, shellForRepublish)
          }
          break
        }
        log.push(
          `v5 draft/save (${label}) HTTP ${sRes.status}: ${sRaw.slice(0, 140)}`
        )
      } catch (e) {
        log.push(
          `v5 draft/save (${label}): ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }
    if (saveAnyOk) break
  }
  if (saveAnyOk && !shellForRepublish) {
    for (const sp of savePayloads) {
      const flat = v5SaveRecordForFlatPayload(sp, draftId)
      if (flat) {
        if (coverField) flat.cover = coverField
        shellForRepublish = flat
        log.push('v5: save 已成功但从 JSON 路径未带 flat，已从 payloads 补全以便终态 save')
        break
      }
    }
    if (!shellForRepublish) {
      log.push(
        'v5: save 已成功但无法构建 flat 壳，终态 save 将跳过（易出现 publish 500002）'
      )
    }
  }

  const doFinalLockSave = async (reasonLabel: string): Promise<void> => {
    if (!shellForRepublish) return
    if (coverField) shellForRepublish.cover = coverField
    const ridLock = makeArticleV5Rid()
    const lockBody = buildV5BrowserFlatSaveBody(shellForRepublish, {
      draftId,
      uid,
      title: titleTrim,
      html: bodyHtml,
      summary: summaryPlain,
      cover: coverField,
      rid: ridLock,
      xsrf,
      articleSource: articleCfg?.articleColumnName?.trim(),
      followersOnlyFullText: articleCfg?.articleFollowersOnlyFullText
    })
    try {
      const sRes = await fetch(makeSaveUrl(), {
        method: 'POST',
        headers: {
          ...baseHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: lockBody,
        cache: 'no-store'
      })
      const sRaw = await sRes.text()
      if (v5SuccessJson(sRaw)) {
        mergeDraftMetaFromV5SaveResponse(sRaw, shellForRepublish)
      } else {
        log.push(
          `v5 ${reasonLabel} save HTTP ${sRes.status}: ${sRaw.slice(0, 160)}`
        )
      }
    } catch (e) {
      log.push(
        `v5 ${reasonLabel} save: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  if (!saveAnyOk) {
    log.push('v5 draft/save：未收到 code=100000，仍尝试 publish')
  } else if (shellForRepublish) {
    await doFinalLockSave('发布前终态')
    /** 500002「请手动保存后重新提交」：服务端落库略慢，缩短等待易误判未保存 */
    await new Promise((r) => setTimeout(r, 1600))
  }

  const tryPublishGetPost = async (): Promise<HeadlineArticlePublishResult | null> => {
    const attemptsPub: string[] = []

    await new Promise((r) => setTimeout(r, 800))
    await fetchV5EditorDraftHtmlWarmup(cardBase, cookieHeader, uid, draftId)

    const handlePublishRaw = (pRaw: string): HeadlineArticlePublishResult | null => {
      const parsed = parseSaveResponse(pRaw)
      if (parsed.ok && parsed.id) {
        return headlineSuccessFromParsed(userId, parsed)
      }
      if (parsed.ok && parsed.url && !parsed.id) {
        return headlineSuccessFromParsed(userId, parsed)
      }
      const rx = regexExtractWeiboPublishMeta(pRaw)
      if ((parsed.ok || v5SuccessJson(pRaw)) && (rx?.id || rx?.url)) {
        return headlineSuccessFromParsed(userId, {
          id: rx.id ?? parsed.id,
          url: rx.url ?? parsed.url
        })
      }
      if (v5SuccessJson(pRaw)) {
        try {
          const j = JSON.parse(pRaw) as Record<string, unknown>
          const mid = deepFindFeedMid(j)
          if (mid) return headlineSuccessFromParsed(userId, { id: mid })
          const data = j.data
          if (data && typeof data === 'object') {
            const mid2 = deepFindFeedMid(data)
            if (mid2) return headlineSuccessFromParsed(userId, { id: mid2 })
          }
        } catch {
          /* ignore */
        }
      }
      return null
    }

    const hBase = baseHeaders()
    const makePubUrl = () =>
      `${cardBase}${V5_AJ_BASE}/draft/publish?uid=${encodeURIComponent(uid)}&id=${encodeURIComponent(draftId)}&_rid=${encodeURIComponent(makeArticleV5Rid())}`

    const postPublish = async (
      label: string,
      body: string
    ): Promise<HeadlineArticlePublishResult | null> => {
      try {
        const pRes = await fetch(makePubUrl(), {
          method: 'POST',
          headers: {
            ...hBase,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
          },
          body,
          cache: 'no-store'
        })
        const pRaw = await pRes.text()
        const ok = handlePublishRaw(pRaw)
        if (ok?.ok) return ok
        const sec = weiboPublishSecurityHintFromStrings(pRaw)
        if (sec) attemptsPub.push(`v5 ${label}: ${sec}`)
        attemptsPub.push(`${label} HTTP ${pRes.status}: ${pRaw.slice(0, 260)}`)
      } catch (e) {
        attemptsPub.push(
          `${label}: ${e instanceof Error ? e.message : String(e)}`
        )
      }
      return null
    }

    const customStatus = optionalTrim(articleCfg?.articleWeiboStatusText)
    /** 默认同步抓包：多为「…》+ 」的 plus 形态在前 */
    const textVars = customStatus
      ? (['space'] as const)
      : (['plus', 'space'] as const)
    /**
     * publish 的 follow_to_read 必须与 flat save 一致（见 buildV5BrowserFlatSaveBody）。
     * 若 save 为 0 却用 publish 试 1，部分账号固定 500002「请手动保存后重新提交」。
     */
    const savedFollowToRead = articleCfg?.articleFollowersOnlyFullText === true
    const followPasses: boolean[] = [savedFollowToRead]
    for (const followToRead of followPasses) {
      for (const syncWb of ['0', '1'] as const) {
        const cardPublishOpts = {
          statusTextOverride: customStatus,
          mblogStatement: articleCfg?.articleContentDeclaration ?? '0',
          followToRead,
          syncWb
        }
        for (const textVar of textVars) {
          const ok = await postPublish(
            `publish fr=${followToRead ? 1 : 0} sync_wb=${syncWb} text=${textVar}`,
            buildV5CardSyncPublishFlatBody(
              draftId,
              uid,
              titleTrim,
              textVar,
              cardPublishOpts
            )
          )
          if (ok?.ok) return ok
        }
      }
    }

    log.push(...attemptsPub)
    return null
  }

  let published = await tryPublishGetPost()
  if (published?.ok) return published

  if (saveAnyOk && shellForRepublish) {
    log.push(
      'v5: publish 均未成功（常见 500002），再执行终态 save 并延长等待后整体重试 publish 一轮'
    )
    await doFinalLockSave('第二轮发布前')
    await new Promise((r) => setTimeout(r, 2400))
    published = await tryPublishGetPost()
    if (published?.ok) return published
  }

  const logStr = [`draftId=${draftId}`, ...log].join(' | ')
  const secExtra = weiboPublishSecurityHintFromStrings(logStr)
  const baseErr =
    `${WEIBO_HEADLINE_RISK_CONTROL_USER_HINT} 本次通过接口自动发布未成功（v5 已创建草稿 ID，但 draft/save 或 publish 未成功）；草稿通常可在「文章草稿箱」查看。草稿箱里偶现空白条目属正常现象，可手动删掉。detail 中为接口返回（如 111002 标题不规范、111001 参数错误、500002 可在网页端打开该草稿保存后再试，或检查 Cookie/会话是否过期）。`
  return {
    ok: false,
    error: secExtra ? `${baseErr} ${secExtra}` : baseErr,
    detail: logStr
  }
}

function buildFormBodies (payload: object, xsrf: string | null): string[] {
  const json = JSON.stringify(payload)
  const bodies: string[] = []
  const onlyData = new URLSearchParams()
  onlyData.set('data', json)
  bodies.push(onlyData.toString())
  if (xsrf) {
    const withSt = new URLSearchParams()
    withSt.set('data', json)
    withSt.set('st', xsrf)
    bodies.push(withSt.toString())
  }
  return bodies
}

/**
 * 微博头条文章：优先 card v5「草稿创建→保存→发布」，失败再尝试旧版 idea/editor saveorupdate。
 */
export async function tryPublishWeiboHeadlineArticle (
  userId: string,
  title: string,
  markdown: string,
  options?: {
    /** 服务端已有二进制（如统一发布接口上传的封面）时优先，避免依赖 HTTP 再拉 /content-images */
    coverImagePart?: ImagePart
    coverImageUrl?: string
    weiboPublish?: WeiboHeadlinePublishInput
  }
): Promise<HeadlineArticlePublishResult> {
  const mdTrim = markdown.trim()
  if (!mdTrim) return { ok: false, error: '头条文章正文不能为空' }
  const rawTitle = title.trim()
  if (!rawTitle) return { ok: false, error: '头条文章需要标题' }

  const html = wrapArticleHtml(markdownToHtml(mdTrim))
  const titleTrim = normalizeWeiboHeadlineTitleForV5(rawTitle, html)

  const cookies = readWeiboPlaywrightStorageCookies(userId)
  if (!cookies?.length) return { ok: false, error: '无会话 Cookie' }

  const cookieHeader =
    cookieHeaderForUrl('https://card.weibo.com/', cookies) ||
    cookieHeaderForUrl('https://card.weibo.cn/', cookies) ||
    cookieHeaderForUrl('https://weibo.com/', cookies)
  if (!cookieHeader) {
    return { ok: false, error: '无法为 card.weibo / weibo.com 拼 Cookie' }
  }

  let xsrf = xsrfTokenFromCookies(cookies)
  if (!xsrf) {
    for (const base of CARD_BASES) {
      const h5 = await fetchCardV5EditorHtml(base, cookieHeader)
      xsrf = h5 ? extractXsrfFromHtml(h5) : null
      if (xsrf) break
    }
  }
  if (!xsrf) {
    for (const base of CARD_BASES) {
      const editorHtml = await fetchCardEditorHtml(base, cookieHeader)
      xsrf = editorHtml ? extractXsrfFromHtml(editorHtml) : null
      if (xsrf) break
    }
  }
  if (!xsrf) {
    const homeCookie = cookieHeaderForUrl('https://weibo.com/', cookies)
    if (homeCookie) {
      const homeHtml = await fetchWeiboHomeHtml(homeCookie)
      xsrf = homeHtml ? extractXsrfFromHtml(homeHtml) : null
    }
  }
  if (!xsrf && cookieHeader) {
    xsrf = await resolveXsrf(cookies, cookieHeader)
  }

  /** 与 v5 同一会话就绪后再上图床，避免过早上传被风控或 Cookie 未完全生效 */
  let coverPid = ''
  const uploadCover = async (part: ImagePart) => {
    const up = await uploadOneWeiboPicB64(userId, part, {
      preferV5EditorCover: true
    })
    if (up.ok) coverPid = up.pid
  }
  if (options?.coverImagePart?.buffer?.length) {
    await uploadCover(options.coverImagePart)
  }
  if (!coverPid && options?.coverImageUrl?.trim()) {
    const part = await loadImagePartForWeibo(options.coverImageUrl.trim())
    if (part) await uploadCover(part)
  }
  if (
    !coverPid &&
    (options?.coverImagePart?.buffer?.length || options?.coverImageUrl?.trim())
  ) {
    await new Promise((r) => setTimeout(r, 450))
    if (options?.coverImagePart?.buffer?.length) {
      await uploadCover(options.coverImagePart)
    }
    if (!coverPid && options?.coverImageUrl?.trim()) {
      const part = await loadImagePartForWeibo(options.coverImageUrl.trim())
      if (part) await uploadCover(part)
    }
  }

  const coverNormForPayloads = normalizeWeiboV5CoverForSave(coverPid)
  const htmlWithCoverForLegacy = articleBodyHtmlWithCoverFirst(
    html,
    coverNormForPayloads
  )

  const profileEarly = readWeiboPlaywrightProfile(userId)
  const uidForArticle = profileEarly?.weiboUid?.replace(/\D/g, '') ?? ''
  const attempts: string[] = []
  const v5Logs: string[] = []

  if (/^\d{5,15}$/.test(uidForArticle)) {
    let v5TerminalError: HeadlineArticlePublishResult | null = null
    for (const cardBase of CARD_BASES) {
      const v5Log: string[] = []
      if (titleTrim !== rawTitle) {
        v5Log.push(
          `标题已规范化（降低 111002 风险）：原 ${rawTitle.length} → 现 ${titleTrim.length} 字符`
        )
      }
      const v5 = await tryPublishWeiboArticleV5DraftFlow(
        userId,
        cardBase,
        cookieHeader,
        xsrf,
        uidForArticle,
        titleTrim,
        html,
        coverPid,
        v5Log,
        options?.weiboPublish,
        {
          part: options?.coverImagePart,
          url: options?.coverImageUrl?.trim() || undefined
        }
      )
      v5Logs.push(`${cardBase}: ${v5Log.join('; ')}`)
      if (v5?.ok) return v5
      if (v5 && !v5.ok) {
        v5TerminalError = v5
        break
      }
    }
    if (v5TerminalError) return v5TerminalError
    attempts.push(v5Logs.join(' | '))
  } else {
    attempts.push('无有效微博 uid，跳过 v5 草稿流程，将尝试旧版 saveorupdate')
  }

  const dataPayloads = [
    {
      title: titleTrim,
      content: htmlWithCoverForLegacy,
      status: 1,
      editor_version: 2,
      cover: coverPid,
      license: 'all',
      author: '',
      source: '',
      summary: '',
      content_source: 0,
      error: 0
    },
    {
      title: titleTrim,
      content: htmlWithCoverForLegacy,
      status: 1,
      editor_version: 3,
      cover: coverPid,
      license: 'all',
      author: '',
      source: '',
      summary: '',
      content_source: 0,
      error: 0
    },
    {
      title: titleTrim,
      content: htmlWithCoverForLegacy,
      status: 1,
      cover: coverPid
    },
    {
      title: titleTrim,
      content: htmlWithCoverForLegacy,
      status: 1,
      editor_version: 2,
      cover: coverPid,
      license: 'all',
      author: '',
      source: '',
      summary: '',
      content_source: 0,
      error: 0,
      isTimed: 0
    }
  ]

  for (const cardBase of CARD_BASES) {
    for (const path of SAVE_PATH_CANDIDATES) {
      for (const payload of dataPayloads) {
        for (const bodyStr of buildFormBodies(payload, xsrf)) {
          const saveUrl = `${cardBase}${path}?_rid=${Date.now()}`
          const headers: Record<string, string> = {
            Cookie: cookieHeader,
            Referer: `${cardBase}/article/v3/editor`,
            Origin: cardBase,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            Accept: 'application/json, text/plain, */*',
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': UA
          }
          if (xsrf) headers['X-Xsrf-Token'] = xsrf

          try {
            const res = await fetch(saveUrl, {
              method: 'POST',
              headers,
              body: bodyStr,
              cache: 'no-store'
            })
            const raw = await res.text()
            const parsed = parseSaveResponse(raw)
            if (parsed.ok && parsed.id) {
              const okResult = headlineSuccessFromParsed(userId, parsed)
              if (okResult.ok) return okResult
            }
            const host = cardBase.replace(/^https?:\/\//, '')
            attempts.push(
              `[${host}${path}] HTTP ${res.status}: ${parsed.msg ?? raw.slice(0, 160)}`
            )
          } catch (e) {
            attempts.push(e instanceof Error ? e.message : String(e))
          }
        }
      }
    }
  }

  const profile = readWeiboPlaywrightProfile(userId)
  const hintUid = profile?.weiboUid ? `uid=${profile.weiboUid}` : ''

  return {
    ok: false,
    error: `${WEIBO_HEADLINE_RISK_CONTROL_USER_HINT} 若仍失败，请查看 detail（card.weibo 接口未成功，可能已改版或会话异常）。`,
    detail: [
      attempts.join(' | '),
      hintUid,
      '主路径：v5 draft/create→load→save（扁平表单）→draft/publish（同步微博表单）。失败请核对会话或抓包对照 weibo-headline-article-publish.ts'
    ]
      .filter(Boolean)
      .join(' ')
  }
}
