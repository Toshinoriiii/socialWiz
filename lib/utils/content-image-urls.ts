/**
 * 服务端发起 HTTP GET 时，把作品里的相对路径（如 /content-images/x.jpg）补成可请求的绝对地址。
 * Docker / 反向代理场景可设 INTERNAL_MEDIA_BASE_URL（容器内访问自身）。
 */
export function resolveServerSideMediaUrl (pathOrUrl: string): string {
  const t = pathOrUrl.trim()
  if (!t) return t
  if (t.startsWith('http://') || t.startsWith('https://')) return t
  const base = (
    process.env.INTERNAL_MEDIA_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'http://127.0.0.1:3000'
  ).replace(/\/$/, '')
  return `${base}${t.startsWith('/') ? '' : '/'}${t}`
}

/**
 * 将作品本地相对路径转为可对公网拉取的绝对 URL（用于服务端代下图片再传微博图床）。
 */
export function absoluteUrlsForContent (
  baseUrl: string | undefined,
  coverImage: string | null | undefined,
  images: string[] | null | undefined,
  max = 9
): string[] | undefined {
  const base = (
    process.env.INTERNAL_MEDIA_BASE_URL ||
    baseUrl ||
    ''
  ).replace(/\/$/, '')
  const norm = (u: string): string | null => {
    const t = u.trim()
    if (!t) return null
    if (t.startsWith('http://') || t.startsWith('https://')) return t
    if (!base) return null
    return `${base}${t.startsWith('/') ? '' : '/'}${t}`
  }
  const out: string[] = []
  if (coverImage) {
    const x = norm(coverImage)
    if (x) out.push(x)
  }
  for (const im of images ?? []) {
    const x = norm(im)
    if (x && !out.includes(x)) out.push(x)
  }
  const slice = out.slice(0, max)
  return slice.length ? slice : undefined
}
