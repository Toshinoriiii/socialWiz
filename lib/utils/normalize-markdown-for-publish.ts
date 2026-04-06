/**
 * 发布/预览前规范化 Markdown（纯字符串，可在客户端使用）。
 * 模型常见把全文包在 ```markdown … ``` 内；不拆开则会被当作代码块整块发到公众号。
 */

function unwrapOuterMarkdownFence (text: string): string {
  const lines = text.split(/\r?\n/)
  if (lines.length < 3) return text
  if (!/^```(?:markdown|md)?$/i.test(lines[0].trim())) return text
  if (lines[lines.length - 1].trim() !== '```') return text
  return lines.slice(1, -1).join('\n').trim()
}

/** 去 BOM / 零宽字符，并去掉「仅一层」外层 markdown 代码_fence */
export function normalizeMarkdownForPublish (source: string): string {
  let t = source?.trim() ?? ''
  if (!t) return ''
  t = t.replace(/[\uFEFF\u200B-\u200D\u2060]/g, '')
  return unwrapOuterMarkdownFence(t)
}
