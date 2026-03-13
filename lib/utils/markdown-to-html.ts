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
 */
export function markdownToHtml(markdown: string): string {
  const trimmed = markdown?.trim() ?? ''
  if (!trimmed) return markdown || ''
  if (looksLikeHtml(trimmed)) return trimmed
  try {
    marked.setOptions({ gfm: true })
    const html = marked.parse(trimmed) as string
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
