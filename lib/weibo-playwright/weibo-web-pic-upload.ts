import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import {
  cookieHeaderForUrl,
  readWeiboPlaywrightStorageCookies,
  type StorageStateCookie
} from '@/lib/weibo-playwright/weibo-storage-cookies'
import { resolveXsrf } from '@/lib/weibo-playwright/weibo-xsrf'
import { resolveServerSideMediaUrl } from '@/lib/utils/content-image-urls'

export type ImagePart = { buffer: Buffer; mime: string }

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024

/** 从 URL 或「站内路径」得到 pathname（以 / 开头） */
function mediaPathname (pathOrUrl: string): string | null {
  const s = pathOrUrl.trim()
  if (!s) return null
  try {
    if (s.startsWith('http://') || s.startsWith('https://')) {
      const p = new URL(s).pathname
      return p && p !== '/' ? p : null
    }
  } catch {
    return null
  }
  return s.startsWith('/') ? s : null
}

function localFilePathForContentImage (pathOrUrl: string): string | null {
  const pathname = mediaPathname(pathOrUrl)
  if (!pathname || !pathname.startsWith('/content-images/')) return null
  const rel = pathname.slice('/content-images/'.length)
  if (!rel || rel.includes('..') || rel.includes('/') || rel.includes('\\')) {
    return null
  }
  const baseDir = path.resolve(process.cwd(), 'public', 'content-images')
  const full = path.resolve(baseDir, rel)
  const relCheck = path.relative(baseDir, full)
  if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) return null
  if (!existsSync(full)) return null
  return full
}

function mimeFromFilename (filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  return 'image/jpeg'
}

/**
 * 微博发图：优先读本地 `public/content-images`（避免服务端 HTTP 回环失败），否则按绝对 URL 拉取。
 */
export async function loadImagePartForWeibo (
  pathOrUrl: string
): Promise<ImagePart | null> {
  const local = localFilePathForContentImage(pathOrUrl)
  if (local) {
    try {
      const buffer = await readFile(local)
      if (buffer.length > MAX_IMAGE_BYTES) return null
      return { buffer, mime: mimeFromFilename(local) }
    } catch {
      return null
    }
  }
  return fetchUrlAsImagePart(resolveServerSideMediaUrl(pathOrUrl.trim()))
}

/** JSONP：`STK_xxx({...})` → `{...}` */
function stripJsonpWrapper (raw: string): string {
  const t = raw.trim()
  const m = t.match(/^[^(]*\(([\s\S]*)\)\s*;?\s*$/)
  if (m?.[1]) return m[1].trim()
  return t
}

function weiboPicApiErrorHint (raw: string): string | null {
  const t = stripJsonpWrapper(raw)
  try {
    const j = JSON.parse(t) as Record<string, unknown>
    const code = j.code ?? j.ret
    const msg = j.msg ?? j.message ?? j.error
    if (code == null) return null
    /** 网页版图床常见成功码：100000；部分接口历史上也有 1 */
    const ok =
      code === '100000' ||
      code === 100000 ||
      String(code) === '100000' ||
      code === 1 ||
      code === '1'
    if (ok) return null
    const ms = typeof msg === 'string' ? msg : JSON.stringify(msg)
    return `接口 code=${code}${ms ? `，${ms}` : ''}`
  } catch {
    return null
  }
}

/** 从站内图床上传响应中抠 pid（JSON / JSONP / 混排文本） */
function extractPid (raw: string): string | null {
  const t = stripJsonpWrapper(raw.trim())
  try {
    const j = JSON.parse(t) as Record<string, unknown>
    const data = j.data
    if (typeof data === 'string') {
      try {
        const inner = JSON.parse(data) as Record<string, unknown>
        return extractPidFromDataObject(inner)
      } catch {
        /* fallthrough */
      }
    }
    if (data && typeof data === 'object') {
      const p = extractPidFromDataObject(data as Record<string, unknown>)
      if (p) return p
    }
  } catch {
    /* fallthrough */
  }
  const m =
    t.match(/"pid"\s*:\s*"([^"]+)"/) ||
    t.match(/"pic_id"\s*:\s*"([^"]+)"/) ||
    t.match(/pic_id=([a-zA-Z0-9_-]+)/) ||
    t.match(/pid=([a-zA-Z0-9_-]+)/) ||
    t.match(/"photo[^"]*pid"\s*:\s*"([^"]+)"/i)
  const id = m?.[1] ?? null
  return id && id.length > 4 ? id : null
}

function extractPidFromDataObject (d: Record<string, unknown>): string | null {
  const pics = d.pics
  if (pics && typeof pics === 'object') {
    for (const v of Object.values(pics as Record<string, unknown>)) {
      if (v && typeof v === 'object') {
        const vo = v as Record<string, unknown>
        const pid = vo.pid ?? vo.pic_id
        if (typeof pid === 'string' && pid.length > 4) return pid
      }
    }
  }
  const top = d.pid ?? d.pic_id
  if (typeof top === 'string' && top.length > 4) return top
  return null
}

function buildUploadHeaders (
  cookieHeader: string,
  xsrf: string | null,
  contentType?: string
): Record<string, string> {
  const h: Record<string, string> = {
    Cookie: cookieHeader,
    Referer: 'https://weibo.com/',
    Origin: 'https://weibo.com',
    Accept: '*/*',
    'User-Agent': UA
  }
  if (contentType) h['Content-Type'] = contentType
  if (xsrf) h['X-Xsrf-Token'] = xsrf
  return h
}

/**
 * base64 上传（与网页端参数对齐：含 url=0、nick=0 等）。
 */
async function tryPicUploadBase64 (
  part: ImagePart,
  cookieHeader: string,
  xsrf: string | null
): Promise<{ ok: true; pid: string; raw: string } | { ok: false; error: string; raw: string }> {
  const uploadHost = 'https://picupload.service.weibo.com'
  const mime = part.mime || 'image/jpeg'
  const qs = new URLSearchParams({
    mime,
    data: 'base64',
    url: '0',
    markpos: '1',
    marks: '1',
    nick: '0',
    app: 'miniblog',
    filesource: 'weibo'
  })
  const url = `${uploadHost}/interface/pic_upload.php?${qs.toString()}`

  const body = new URLSearchParams()
  body.set('b64_data', part.buffer.toString('base64'))

  const res = await fetch(url, {
    method: 'POST',
    headers: buildUploadHeaders(
      cookieHeader,
      xsrf,
      'application/x-www-form-urlencoded'
    ),
    body: body.toString(),
    cache: 'no-store'
  })
  const raw = await res.text()
  const pidFirst = extractPid(raw)
  if (pidFirst) return { ok: true, pid: pidFirst, raw }
  const apiErr = weiboPicApiErrorHint(raw)
  if (apiErr) {
    return { ok: false, error: `${apiErr}（base64）`, raw }
  }
  return {
    ok: false,
    error: `未解析到 pid（HTTP ${res.status}，base64）: ${raw.slice(0, 400)}`,
    raw
  }
}

/**
 * 二进制 multipart 上传（pic1），与旧版微博发图框一致，部分账号/base64 受限时可成功。
 */
async function tryPicUploadMultipart (
  part: ImagePart,
  cookieHeader: string,
  xsrf: string | null
): Promise<{ ok: true; pid: string; raw: string } | { ok: false; error: string; raw: string }> {
  const uploadHost = 'https://picupload.service.weibo.com'
  const mime = part.mime || 'image/jpeg'
  const ts = Date.now()
  const cb = `https://weibo.com/aj/static/upimgback.html?_wv=5&callback=STK_${ts}`
  const qs = new URLSearchParams({
    cb,
    mime,
    markpos: '1',
    marks: '1',
    nick: '0',
    logo: '0',
    app: 'miniblog',
    filesource: 'weibo'
  })
  const url = `${uploadHost}/interface/pic_upload.php?${qs.toString()}`

  const form = new FormData()
  const blob = new Blob([new Uint8Array(part.buffer)], { type: mime })
  form.set('pic1', blob, 'upload.jpg')

  const headers = buildUploadHeaders(cookieHeader, xsrf)

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: form,
    cache: 'no-store'
  })
  const raw = await res.text()
  const pidFirst = extractPid(raw)
  if (pidFirst) return { ok: true, pid: pidFirst, raw }
  const apiErr = weiboPicApiErrorHint(raw)
  if (apiErr) {
    return { ok: false, error: `${apiErr}（multipart）`, raw }
  }
  return {
    ok: false,
    error: `未解析到 pid（HTTP ${res.status}，multipart）: ${raw.slice(0, 400)}`,
    raw
  }
}

/**
 * 单张图：先 base64 再 multipart（均需登录 Cookie）。
 */
export async function uploadOneWeiboPicB64 (
  userId: string,
  part: ImagePart
): Promise<{ ok: true; pid: string } | { ok: false; error: string }> {
  const cookies = readWeiboPlaywrightStorageCookies(userId) as
    | StorageStateCookie[]
    | null
  if (!cookies?.length) {
    return { ok: false, error: '无会话 Cookie' }
  }
  const uploadHost = 'https://picupload.service.weibo.com'
  const cookieHeader = cookieHeaderForUrl(uploadHost, cookies)
  if (!cookieHeader) {
    return {
      ok: false,
      error:
        '无法为图床域拼 Cookie（请用「连接微博」重新登录，确保会话含 .weibo.com）'
    }
  }

  let xsrf: string | null = null
  try {
    xsrf = await resolveXsrf(cookies, cookieHeader)
  } catch {
    xsrf = null
  }

  try {
    const b64 = await tryPicUploadBase64(part, cookieHeader, xsrf)
    if (b64.ok) return { ok: true, pid: b64.pid }

    const mp = await tryPicUploadMultipart(part, cookieHeader, xsrf)
    if (mp.ok) return { ok: true, pid: mp.pid }

    return {
      ok: false,
      error: [b64.error, mp.error].filter(Boolean).join(' | ')
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e)
    }
  }
}

export async function uploadWeiboImagesAsPicIdString (
  userId: string,
  parts: ImagePart[]
): Promise<{ ok: true; picIdStr: string } | { ok: false; error: string }> {
  if (parts.length === 0) {
    return { ok: false, error: '没有图片' }
  }
  const pids: string[] = []
  for (const p of parts.slice(0, 9)) {
    const r = await uploadOneWeiboPicB64(userId, p)
    if (!r.ok) {
      return { ok: false, error: r.error }
    }
    pids.push(r.pid)
  }
  return { ok: true, picIdStr: pids.join('|') }
}

export async function fetchUrlAsImagePart (
  url: string
): Promise<ImagePart | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      cache: 'no-store',
      headers: {
        Accept: 'image/*,*/*;q=0.8',
        'User-Agent': UA
      }
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const mime =
      res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
    if (!mime.startsWith('image/')) return null
    if (buf.length > MAX_IMAGE_BYTES) return null
    return { buffer: buf, mime }
  } catch {
    return null
  }
}
