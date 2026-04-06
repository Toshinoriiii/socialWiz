/**
 * 将可能含有 Markdown 的标题转为纯文本，用于微博等平台（避免 API 拒收「标题不符合规范」）。
 * 不解析完整 MD AST，按常见装饰语法逐层剥除。
 */
export function stripMarkdownFromTitle (raw: string): string {
  let t = raw.trim()
  if (!t) return ''

  t = t.replace(/```[\s\S]*?```/g, '')
  t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  t = t.replace(/<[^>]+>/g, '')

  for (let i = 0; i < 8; i++) {
    const next = t
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
    if (next === t) break
    t = next
  }

  t = t.replace(/\*([^*\n]+)\*/g, '$1')
  t = t.replace(/_([^_\n]+)_/g, '$1')

  t = t.replace(/^#{1,6}\s+/gmu, '')
  t = t.replace(/^>\s+/gmu, '')
  t = t.replace(/^[\s]*[-*+]\s+/gmu, '')
  t = t.replace(/^\d+\.\s+/gmu, '')

  t = t.replace(/https?:\/\/[^\s<]+/gi, '')
  t = t.replace(/\r?\n+/g, ' ')
  t = t.replace(/[\u0000-\u001F\u007F]/g, '')
  t = t.replace(/[\u200B-\u200D\uFEFF\u2028\u2029]/g, '')
  t = t.replace(/\s+/g, ' ').trim()

  return t
}
