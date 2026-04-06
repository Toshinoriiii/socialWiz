/**
 * Markdown 转 HTML
 * 用于微信公众号等仅支持 HTML 的平台。
 * 与站内 `ReactMarkdown` + `remark-gfm` 使用同一解析栈，避免 AI 结果「预览正确、发文走样」。
 */

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { normalizeMarkdownForPublish } from '@/lib/utils/normalize-markdown-for-publish'

/**
 * 检测内容是否已是 HTML（含常见标签起止）。
 * 排除 `<https://…>` / `<http://…>` / `<mailto:…>` 等角括弧 URL，避免误判后跳过 Markdown 解析，
 * 否则公众号正文会原样露出 `**`、`#` 等符号。
 */
const LOOKS_LIKE_HTML_TAG = /<(\/?)([a-z][a-z0-9]*)[\s>\/]/gi
const NON_HTML_TAG_NAMES = new Set(['http', 'https', 'mailto', 'ftp'])

function looksLikeHtml (text: string): boolean {
  const t = text.trim()
  LOOKS_LIKE_HTML_TAG.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = LOOKS_LIKE_HTML_TAG.exec(t)) !== null) {
    const name = (m[2] || '').toLowerCase()
    if (!NON_HTML_TAG_NAMES.has(name)) return true
  }
  return false
}

const markdownHtmlProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: false })
  .use(rehypeStringify)

/**
 * 与 remark-breaks / mdast-util-newline-to-break 等价：文本节点内 `\n` → `break`，
 * 避免 AI 常用「行首换行」在 CommonMark 下被折叠成空格（公众号里整段糊成一行）。
 */
function newlineToBreakInMdast (node: unknown): void {
  if (!node || typeof node !== 'object') return
  const n = node as { type?: string; children?: unknown[] }
  if (!Array.isArray(n.children)) return
  const ch = n.children as Record<string, unknown>[]
  let i = 0
  while (i < ch.length) {
    const c = ch[i]
    if (
      c &&
      typeof c === 'object' &&
      (c as { type?: string }).type === 'text' &&
      typeof (c as { value?: unknown }).value === 'string' &&
      /\r?\n|\r/.test((c as { value: string }).value)
    ) {
      const value = (c as { value: string }).value
      const parts = value.split(/\r?\n|\r/)
      const replacement: Array<{ type: string; value?: string }> = []
      for (let p = 0; p < parts.length; p++) {
        replacement.push({ type: 'text', value: parts[p] })
        if (p < parts.length - 1) replacement.push({ type: 'break' })
      }
      ch.splice(i, 1, ...(replacement as unknown[]))
      i += replacement.length
    } else {
      newlineToBreakInMdast(c)
      i++
    }
  }
}

function remarkWechatSoftBreaks () {
  return (tree: unknown) => {
    newlineToBreakInMdast(tree)
  }
}

/** 公众号正文：GFM + 单换行转 `<br>`，后接白名单友好化（微博等仍走 `markdownToHtml`） */
const wechatMpMarkdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkWechatSoftBreaks)
  .use(remarkRehype, { allowDangerousHtml: false })
  .use(rehypeStringify)

function decodeBasicHtmlEntities (text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function escapeXml (text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function tableFragmentToWechatParagraphs (tableInner: string): string {
  const rowMatches = tableInner.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  const out: string[] = []
  for (const row of rowMatches) {
    const cellMatches =
      row.match(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi) ?? []
    const parts: string[] = []
    for (const m of cellMatches) {
      const inner = m.replace(/^<t[dh]\b[^>]*>/i, '').replace(/<\/t[dh]>$/i, '')
      const t = decodeBasicHtmlEntities(
        inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      )
      if (t) parts.push(t)
    }
    if (parts.length) {
      out.push(`<p>${parts.map(escapeXml).join('　')}</p>`)
    }
  }
  return out.join('')
}

function preBlockToWechatParagraphs (preInner: string): string {
  const codeMatch = preInner.match(/<code\b[^>]*>([\s\S]*?)<\/code>/i)
  const raw = codeMatch ? codeMatch[1] : preInner
  const decoded = decodeBasicHtmlEntities(
    raw.replace(/<[^>]+>/g, '')
  )
  const lines = decoded.split(/\r\n|\r|\n/)
  if (!lines.length) return '<p> </p>'
  return lines
    .map(line => (line.length ? `<p>${escapeXml(line)}</p>` : '<p><br/></p>'))
    .join('')
}

/**
 * 微信公众号图文正文的 HTML 白名单与编辑器对表格 / `pre` / 标题等支持有限；
 * AI 常用 GFM（表格、代码块、单换行段落）在此压缩为 `<p>` / `<br>` 为主的安全结构。
 */
function adaptHtmlForWechatMp (html: string): string {
  let s = html.trim()
  if (!s) return s

  s = s.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_, inner) =>
    tableFragmentToWechatParagraphs(inner)
  )
  s = s.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_, inner) =>
    preBlockToWechatParagraphs(inner)
  )
  s = s.replace(/<hr\b[^>]*\/?>/gi, '<p><br/></p>')
  s = s.replace(/\s+class=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  s = s.replace(/\s+id=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  s = s.replace(
    /<h([1-6])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>/gi,
    '<p><strong>$2</strong></p>'
  )
  return s
}

/**
 * Markdown / 与 `markdownToHtml` 相同的 HTML 识别 → 转为更适合微信公众号正文的 HTML。
 */
export function markdownToWechatMpHtml (markdown: string): string {
  const trimmed = normalizeMarkdownForPublish(markdown ?? '')
  if (!trimmed) return (markdown ?? '').trim() || ''
  let html: string
  if (looksLikeHtml(trimmed)) {
    html = trimmed
  } else {
    try {
      const file = wechatMpMarkdownProcessor.processSync(trimmed)
      html = String(file).trim() || trimmed
    } catch {
      html = trimmed
    }
  }
  return adaptHtmlForWechatMp(html)
}

/**
 * 将 Markdown 转为 HTML
 * - 先做 `normalizeMarkdownForPublish`（外层 ```markdown 围栏、零宽字符）
 * - 若内容已是 HTML（含标签）则原样返回
 * - 否则用与 ReactMarkdown 一致的 remark 管线解析（GFM，无「单换行变 br」类 marked 扩展）
 */
export function markdownToHtml (markdown: string): string {
  const trimmed = normalizeMarkdownForPublish(markdown ?? '')
  if (!trimmed) return (markdown ?? '').trim() || ''
  if (looksLikeHtml(trimmed)) return trimmed
  try {
    const file = markdownHtmlProcessor.processSync(trimmed)
    const html = String(file).trim()
    return html || trimmed
  } catch {
    return trimmed
  }
}

/**
 * 从 HTML 或 Markdown 中提取纯文本，用于摘要等场景
 */
export function toPlainText (htmlOrMarkdown: string, maxLength = 120): string {
  if (!htmlOrMarkdown?.trim()) return ''
  let text = htmlOrMarkdown
    .replace(/<[^>]+>/g, '')
    .replace(/[#*`_~\[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > maxLength ? text.slice(0, maxLength) : text
}

/**
 * Markdown/混合内容 → 适合微博「长微博/信息流」的纯文本（非头条文章 HTML 编辑器）。
 */
export function markdownToPlainForWeiboFeed (
  markdown: string,
  maxLen = 20_000
): string {
  const trimmed = markdown?.trim() ?? ''
  if (!trimmed) return ''
  const html = markdownToHtml(trimmed)
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (text.length > maxLen) text = text.slice(0, maxLen)
  return text
}
