import { markdownToHtml } from '@/lib/utils/markdown-to-html'
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
  uploadOneWeiboPicB64
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
  /** v5 扁平草稿常同时有正文区与试读区，两端都需写入否则后台可见空 */
  'free_content',
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

function nonEmptyStr (v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0
}

function optionalTrim (s: string | undefined): string | undefined {
  if (typeof s !== 'string') return undefined
  const t = s.trim()
  return t.length ? t : undefined
}

/** v5 draft/save 抓包：cover 多为 wx*.sinaimg.cn 完整 URL；图床接口给的 pid 需补成 large 图地址 */
function normalizeWeiboV5CoverForSave (pidOrUrl: string): string {
  const t = pidOrUrl.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  return `https://wx3.sinaimg.cn/large/${t}.jpg`
}

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
  coverPid: string
): void {
  const excerpt = plainTextExcerpt(html, 400)
  const visit = (o: Record<string, unknown>): void => {
    for (const k of Object.keys(o)) {
      const v = o[k]
      if (V5_TITLE_KEYS.has(k)) o[k] = title
      if (V5_CONTENT_KEYS.has(k)) o[k] = html
      if (V5_SUMMARY_KEYS.has(k)) o[k] = excerpt || title
      if (coverPid && V5_COVER_KEYS.has(k)) o[k] = coverPid
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        visit(v as Record<string, unknown>)
      }
    }
  }
  visit(root)
  if (!nonEmptyStr(root.title)) root.title = title
  if (!nonEmptyStr(root.content)) root.content = html
  if ('free_content' in root && !nonEmptyStr(root.free_content)) {
    root.free_content = html
  }
  if (!nonEmptyStr(root.summary)) root.summary = excerpt || title
  if (coverPid && !nonEmptyStr(root.cover)) root.cover = coverPid
}

function buildSavePayloadFromLoad (
  loaded: Record<string, unknown> | null,
  title: string,
  html: string,
  coverPid: string
): Record<string, unknown> | null {
  if (!loaded || Object.keys(loaded).length === 0) return null
  const draft = JSON.parse(JSON.stringify(loaded)) as Record<string, unknown>
  injectTitleHtmlIntoDraftTree(draft, title, html, coverPid)
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
    extra: null,
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
    /** PC v5 编辑器空稿抓包为 is_v4=0 */
    is_v4: 0,
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
    /** 抓包为 pay_setting=[]，非对象 */
    pay_setting: [],
    source: '',
    action: 0,
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
  /** v5 草稿在后台/列表常读 free_content；此前写空会导致「只有空草稿」且 publish 校验失败 */
  const free =
    typeof shell.free_content === 'string' && nonEmptyStr(shell.free_content)
      ? shell.free_content
      : opts.html
  p.set('free_content', free)
  p.set('content', opts.html)
  p.set('cover', opts.cover)
  p.set('summary', opts.summary)
  p.set('writer', typeof shell.writer === 'string' ? shell.writer : '')
  /** 抓包为 extra=null（表单值为字面值 null） */
  if (typeof shell.extra === 'string') {
    p.set('extra', shell.extra)
  } else if (shell.extra == null) {
    p.set('extra', 'null')
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
  /** 与 v5 编辑器抓包一致，默认 0（勿用 ?? 1） */
  p.set('is_v4', String(shell.is_v4 ?? 0))
  /**
   * 平台配置：articleFollowersOnlyFullText !== false 视为「仅粉丝读全文」→ follow_to_read=1。
   * 勿使用 Number(shell.follow_to_read)||1，否则 shell 为 0 时会被错误置为 1。
   */
  const followRead = opts.followersOnlyFullText === false ? 0 : 1
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
      : `https://card.weibo.com/article/v3/aj/editor/draft/applyisrewardtips?uid=${opts.uid}`
  )
  const ps = shell.pay_setting
  if (typeof ps === 'string' && nonEmptyStr(ps)) {
    p.set('pay_setting', ps)
  } else if (Array.isArray(ps)) {
    p.set('pay_setting', JSON.stringify(ps))
  } else if (ps && typeof ps === 'object') {
    p.set('pay_setting', JSON.stringify(ps))
  } else {
    p.set('pay_setting', '[]')
  }
  p.set(
    'source',
    typeof opts.articleSource === 'string' && nonEmptyStr(opts.articleSource)
      ? opts.articleSource.trim()
      : typeof shell.source === 'string'
        ? shell.source
        : ''
  )
  p.set('action', String(shell.action ?? 0))
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
 * v5 编辑器点击「发布」：URL 为 publish?uid&id&_rid，body 为同步到微博的卡片文案与开关（非 save 形态）。
 */
function buildV5CardSyncPublishFlatBody (
  draftId: string,
  uid: string,
  articleTitle: string,
  xsrf: string | null,
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
  const text = custom
    ? custom
    : textVariant === 'plus'
      ? `发布了头条文章：《${t}》+ `
      : `发布了头条文章：《${t}》 `
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
  p.set(
    'follow_to_read',
    publishOpts?.followToRead === false ? '0' : '1'
  )
  p.set('mpkey', '0')
  p.set('uid', String(uid))
  p.set('ver', '4.0')
  p.set('support_all_tag', '1')
  if (xsrf) p.set('st', xsrf)
  return p.toString()
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
  articleCfg?: WeiboHeadlinePublishInput
): Promise<HeadlineArticlePublishResult | null> {
  const coverField = normalizeWeiboV5CoverForSave(coverPid)
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
        html,
        coverField
      )
    } else {
      injectTitleHtmlIntoDraftTree(full, titleTrim, html, coverField)
    }
    savePayloads.push(full)
  }

  const fromLoad = buildSavePayloadFromLoad(loadDraft, titleTrim, html, coverField)
  if (fromLoad) {
    savePayloads.push(fromLoad)
  }
  if (!envelope && !fromLoad) {
    const syn = buildSyntheticV5DraftShell(draftId)
    injectTitleHtmlIntoDraftTree(syn, titleTrim, html, coverField)
    savePayloads.unshift(syn)
    log.push(
      'v5: draft/load 无有效 data（浏览器直开常为 100001），已用与线上一致的合成草稿壳提交 save'
    )
  }

  const makeSaveUrl = () =>
    `${cardBase}${V5_AJ_BASE}/draft/save?uid=${encodeURIComponent(uid)}&id=${encodeURIComponent(draftId)}&_rid=${encodeURIComponent(makeArticleV5Rid())}`

  let saveAnyOk = false

  const summaryPlain = plainTextExcerpt(html, 400) || titleTrim
  const seenFlat = new Set<string>()
  for (const sp of savePayloads) {
    const shell = v5SaveRecordForFlatPayload(sp, draftId)
    if (!shell) continue
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
        html,
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
  if (!saveAnyOk) {
    log.push('v5 draft/save：未收到 code=100000，仍尝试 publish')
  }

  const tryPublishGetPost = async (): Promise<HeadlineArticlePublishResult | null> => {
    const attemptsPub: string[] = []

    await new Promise((r) => setTimeout(r, 450))

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
        attemptsPub.push(`${label} HTTP ${pRes.status}: ${pRaw.slice(0, 260)}`)
      } catch (e) {
        attemptsPub.push(
          `${label}: ${e instanceof Error ? e.message : String(e)}`
        )
      }
      return null
    }

    const customStatus = optionalTrim(articleCfg?.articleWeiboStatusText)
    const textVars = customStatus
      ? (['space'] as const)
      : (['space', 'plus'] as const)
    for (const syncWb of ['0', '1'] as const) {
      const cardPublishOpts = {
        statusTextOverride: customStatus,
        mblogStatement: articleCfg?.articleContentDeclaration ?? '0',
        followToRead: articleCfg?.articleFollowersOnlyFullText !== false,
        syncWb
      }
      for (const textVar of textVars) {
        for (const withSt of [false, true] as const) {
          if (withSt && !xsrf) continue
          const ok = await postPublish(
            `publish card-sync sync_wb=${syncWb} text=${textVar}${withSt ? '+st' : ''}`,
            buildV5CardSyncPublishFlatBody(
              draftId,
              uid,
              titleTrim,
              withSt ? xsrf : null,
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

  const published = await tryPublishGetPost()
  if (published?.ok) return published

  return {
    ok: false,
    error: '头条文章 v5 已创建草稿但发布未成功',
    detail: [`draftId=${draftId}`, ...log].join(' | ')
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
    coverImageUrl?: string
    weiboPublish?: WeiboHeadlinePublishInput
  }
): Promise<HeadlineArticlePublishResult> {
  const titleTrim = title.trim()
  const mdTrim = markdown.trim()
  if (!titleTrim) return { ok: false, error: '头条文章需要标题' }
  if (!mdTrim) return { ok: false, error: '头条文章正文不能为空' }

  const cookies = readWeiboPlaywrightStorageCookies(userId)
  if (!cookies?.length) return { ok: false, error: '无会话 Cookie' }

  const cookieHeader =
    cookieHeaderForUrl('https://card.weibo.com/', cookies) ||
    cookieHeaderForUrl('https://card.weibo.cn/', cookies) ||
    cookieHeaderForUrl('https://weibo.com/', cookies)
  if (!cookieHeader) {
    return { ok: false, error: '无法为 card.weibo / weibo.com 拼 Cookie' }
  }

  let coverPid = ''
  if (options?.coverImageUrl?.trim()) {
    const part = await loadImagePartForWeibo(options.coverImageUrl.trim())
    if (part) {
      const up = await uploadOneWeiboPicB64(userId, part)
      if (up.ok) coverPid = up.pid
    }
  }

  const html = wrapArticleHtml(markdownToHtml(mdTrim))

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

  const profileEarly = readWeiboPlaywrightProfile(userId)
  const uidForArticle = profileEarly?.weiboUid?.replace(/\D/g, '') ?? ''
  const attempts: string[] = []
  const v5Logs: string[] = []

  if (/^\d{5,15}$/.test(uidForArticle)) {
    let v5TerminalError: HeadlineArticlePublishResult | null = null
    for (const cardBase of CARD_BASES) {
      const v5Log: string[] = []
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
        options?.weiboPublish
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
      content: html,
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
      content: html,
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
      content: html,
      status: 1,
      cover: coverPid
    },
    {
      title: titleTrim,
      content: html,
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
    error: '头条文章接口未成功（card.weibo 可能已改版）',
    detail: [
      attempts.join(' | '),
      hintUid,
      '主路径：v5 draft/create→load→save（扁平表单）→draft/publish（同步微博表单）。失败请核对会话或抓包对照 weibo-headline-article-publish.ts'
    ]
      .filter(Boolean)
      .join(' ')
  }
}
