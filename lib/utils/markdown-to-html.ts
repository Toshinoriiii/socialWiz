/**
 * Markdown 转 HTML
 * 用于微信公众号等仅支持 HTML 的平台，将编辑器中的 Markdown 转为可读的 HTML
 */

import { marked } from 'marked'

/** 检测内容是否已是 HTML（含常见块级/行内标签） */
function looksLikeHtml(text: string): boolean {
  return /<([a-z][a-z0-9]*)[\s>]|<\/([a-z][a-z0-9]*)>/i.test(text.trim())
}

/**
 * 将 Markdown 转为 HTML
 * - 若内容已是 HTML（含标签）则原样返回
 * - 否则用 marked 解析为 HTML，确保公众号中正确显示格式
 * - **breaks: true**：与编辑器一致，单行 `\n` 输出为 `<br>`（默认 CommonMark 会合并成空格）
 */
export function markdownToHtml(markdown: string): string {
  const trimmed = markdown?.trim() ?? ''
  if (!trimmed) return markdown || ''
  if (looksLikeHtml(trimmed)) return trimmed
  try {
    const html = marked.parse(trimmed, {
      gfm: true,
      breaks: true
    }) as string
    return (html && html.trim()) || trimmed
  } catch {
    return trimmed
  }
}

/**
 * 从 HTML 或 Markdown 中提取纯文本，用于摘要等场景
 */
export function toPlainText(htmlOrMarkdown: string, maxLength = 120): string {
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
