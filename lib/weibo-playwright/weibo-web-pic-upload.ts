import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'
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

/** 与头条 v5 编辑器 Network 中 `_rid` 形态一致（长约 43） */
function makePicUploadRid (): string {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
  const bytes = randomBytes(48)
  let s = ''
  for (let i = 0; i < 43; i++) {
    s += alphabet[bytes[i]! % alphabet.length]
  }
  return s
}

/** v5 uploadpic 等接口常在 JSON 里直接返回 wx 图床 URL，可作为 draft/save 的 cover */
function extractHttpCoverFromUploadRaw (raw: string): string | null {
  const t = stripJsonpWrapper(raw.trim())
  const m = t.match(/https?:\/\/wx\d?\.sinaimg\.cn[^\s"'\\})]+/i)
  if (m) return m[0].replace(/\\\//g, '/').replace(/[,;)`'\\]+$/, '')
  try {
    const j = JSON.parse(t) as Record<string, unknown>
    const walk = (o: unknown): string | null => {
      if (o == null) return null
      if (typeof o === 'string') {
        if (/^https:\/\/wx[0-9]?\./i.test(o)) return o
        return null
      }
      if (typeof o !== 'object') return null
      if (Array.isArray(o)) {
        for (const x of o) {
          const u = walk(x)
          if (u) return u
        }
        return null
      }
      const rec = o as Record<string, unknown>
      for (const k of [
      'pic',
      'url',
      'pic_src',
      'pic_hd',
      'object_url',
      'cdn_url',
      'large',
      'original'
      ]) {
        const v = rec[k]
        if (typeof v === 'string' && /^https:\/\//i.test(v)) return v
        const u = walk(v)
        if (u) return u
      }
      for (const v of Object.values(rec)) {
        const u = walk(v)
        if (u) return u
      }
      return null
    }
    return walk(j.data ?? j)
  } catch {
    return null
  }
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

function uploadOriginErrLabel (uploadOrigin: string, kind: 'base64' | 'multipart'): string {
  const isService = uploadOrigin.includes('picupload.service.weibo.com')
  const host = isService ? 'picupload.service' : 'picupload.weibo.com'
  return `${host} ${kind}`
}

/**
 * base64 上传（与网页端参数对齐：含 url=0、nick=0 等）。
 * @param uploadOrigin 默认 `picupload.service.weibo.com`；可改为 `https://picupload.weibo.com`（同源接口路径，利于 service 域名不可达时回退）。
 */
async function tryPicUploadBase64 (
  part: ImagePart,
  cookieHeader: string,
  xsrf: string | null,
  uploadOrigin: string = 'https://picupload.service.weibo.com'
): Promise<{ ok: true; pid: string; raw: string } | { ok: false; error: string; raw: string }> {
  try {
    const uploadHost = uploadOrigin
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
  } catch (e) {
    return {
      ok: false,
      error: `${uploadOriginErrLabel(uploadOrigin, 'base64')}: ${e instanceof Error ? e.message : String(e)}`,
      raw: ''
    }
  }
}

/**
 * 二进制 multipart 上传（pic1），与旧版微博发图框一致，部分账号/base64 受限时可成功。
 */
async function tryPicUploadMultipart (
  part: ImagePart,
  cookieHeader: string,
  xsrf: string | null,
  uploadOrigin: string = 'https://picupload.service.weibo.com'
): Promise<{ ok: true; pid: string; raw: string } | { ok: false; error: string; raw: string }> {
  try {
    const uploadHost = uploadOrigin
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
  } catch (e) {
    return {
      ok: false,
      error: `${uploadOriginErrLabel(uploadOrigin, 'multipart')}: ${e instanceof Error ? e.message : String(e)}`,
      raw: ''
    }
  }
}

/**
 * 抓包：picupload.weibo.com/interface/pic_upload.php?app=miniblog&s=json&p=1&data=1&file_source=4&…
 * （头条/编辑器场景；**信息流图文**请用 {@link tryPicUploadMultipart} 同源路径 + weibo.com Referer）
 * - `card`：头条编辑器；`feed`：部分 Web 发图
 */
async function tryPicUploadPicuploadWeiboComMultipart (
  part: ImagePart,
  cookieHeader: string,
  xsrf: string | null,
  refererMode: 'card' | 'feed' = 'card'
): Promise<{ ok: true; pid: string; raw: string } | { ok: false; error: string; raw: string }> {
  try {
    const rid = makePicUploadRid()
    const qs = new URLSearchParams({
      app: 'miniblog',
      s: 'json',
      p: '1',
      data: '1',
      file_source: '4',
      url: '0',
      markpos: '1',
      logo: '',
      nick: '0',
      _rid: rid
    })
    const uploadUrl = `https://picupload.weibo.com/interface/pic_upload.php?${qs.toString()}`
    const mime = part.mime || 'image/jpeg'
    const form = new FormData()
    const blob = new Blob([new Uint8Array(part.buffer)], { type: mime })
    form.set('pic1', blob, 'upload.jpg')

    const headers: Record<string, string> = {
      Cookie: cookieHeader,
      Accept: '*/*',
      'User-Agent': UA,
      ...(refererMode === 'feed'
        ? { Referer: 'https://weibo.com/', Origin: 'https://weibo.com' }
        : {
            Referer: 'https://card.weibo.com/article/v5/editor',
            Origin: 'https://card.weibo.com'
          })
    }
    if (xsrf) headers['X-Xsrf-Token'] = xsrf

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: form,
      cache: 'no-store'
    })
    const raw = await res.text()
    const urlCoverMp = extractHttpCoverFromUploadRaw(raw)
    if (urlCoverMp) return { ok: true, pid: urlCoverMp, raw }
    const pidFirst = extractPid(raw)
    if (pidFirst) return { ok: true, pid: pidFirst, raw }
    const apiErr = weiboPicApiErrorHint(raw)
    if (apiErr) {
      return { ok: false, error: `${apiErr}（picupload.weibo.com multipart）`, raw }
    }
    return {
      ok: false,
      error: `picupload.weibo.com 未解析到 pid（HTTP ${res.status}）: ${raw.slice(0, 380)}`,
      raw
    }
  } catch (e) {
    return {
      ok: false,
      error: `picupload.weibo.com multipart: ${e instanceof Error ? e.message : String(e)}`,
      raw: ''
    }
  }
}

async function tryPicUploadPicuploadWeiboComBase64 (
  part: ImagePart,
  cookieHeader: string,
  xsrf: string | null,
  refererMode: 'card' | 'feed' = 'card'
): Promise<{ ok: true; pid: string; raw: string } | { ok: false; error: string; raw: string }> {
  try {
    const rid = makePicUploadRid()
    const qs = new URLSearchParams({
      app: 'miniblog',
      s: 'json',
      p: '1',
      data: '1',
      file_source: '4',
      url: '0',
      markpos: '1',
      logo: '',
      nick: '0',
      _rid: rid
    })
    const uploadUrl = `https://picupload.weibo.com/interface/pic_upload.php?${qs.toString()}`
    const body = new URLSearchParams()
    body.set('b64_data', part.buffer.toString('base64'))

    const headers: Record<string, string> = {
      Cookie: cookieHeader,
      Accept: '*/*',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': UA,
      ...(refererMode === 'feed'
        ? { Referer: 'https://weibo.com/', Origin: 'https://weibo.com' }
        : {
            Referer: 'https://card.weibo.com/article/v5/editor',
            Origin: 'https://card.weibo.com'
          })
    }
    if (xsrf) headers['X-Xsrf-Token'] = xsrf

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: body.toString(),
      cache: 'no-store'
    })
    const raw = await res.text()
    const urlCoverB64 = extractHttpCoverFromUploadRaw(raw)
    if (urlCoverB64) return { ok: true, pid: urlCoverB64, raw }
    const pidFirst = extractPid(raw)
    if (pidFirst) return { ok: true, pid: pidFirst, raw }
    const apiErr = weiboPicApiErrorHint(raw)
    if (apiErr) {
      return { ok: false, error: `${apiErr}（picupload.weibo.com base64）`, raw }
    }
    return {
      ok: false,
      error: `picupload.weibo.com base64 未解析到 pid（HTTP ${res.status}）: ${raw.slice(0, 380)}`,
      raw
    }
  } catch (e) {
    return {
      ok: false,
      error: `picupload.weibo.com base64: ${e instanceof Error ? e.message : String(e)}`,
      raw: ''
    }
  }
}

/**
 * 抓包：card.weibo.com/article/v5/aj/editor/plugins/uploadpic?_rid=…
 * 返回中常为 wx*.sinaimg.cn URL 或 pid，供 draft/save 的 cover 使用。
 */
async function tryCardV5EditorPluginsUploadpic (
  part: ImagePart,
  cookieHeader: string,
  xsrf: string | null,
  cardBase: 'https://card.weibo.com' | 'https://card.weibo.cn'
): Promise<{ ok: true; pid: string; raw: string } | { ok: false; error: string; raw: string }> {
  try {
    const rid = makePicUploadRid()
    const uploadUrl = `${cardBase}/article/v5/aj/editor/plugins/uploadpic?_rid=${encodeURIComponent(rid)}`
    const mime = part.mime || 'image/jpeg'
    const blob = new Blob([new Uint8Array(part.buffer)], { type: mime })
    const fields = ['pic1', 'pic', 'file', 'image', 'upload'] as const
    let lastRaw = ''
    for (const field of fields) {
      const form = new FormData()
      form.set(field, blob, 'cover.jpg')
      const headers: Record<string, string> = {
        Cookie: cookieHeader,
        Referer: `${cardBase}/article/v5/editor`,
        Origin: cardBase,
        Accept: 'application/json, text/plain, */*; q=0.01',
        'User-Agent': UA,
        'X-Requested-With': 'XMLHttpRequest'
      }
      if (xsrf) headers['X-Xsrf-Token'] = xsrf
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers,
        body: form,
        cache: 'no-store'
      })
      lastRaw = await res.text()
      const urlCover = extractHttpCoverFromUploadRaw(lastRaw)
      if (urlCover) return { ok: true, pid: urlCover, raw: lastRaw }
      const pid = extractPid(lastRaw)
      if (pid) return { ok: true, pid, raw: lastRaw }
    }
    return {
      ok: false,
      error: `uploadpic 未解析到封面（${cardBase}）: ${lastRaw.slice(0, 260)}`,
      raw: lastRaw
    }
  } catch (e) {
    return {
      ok: false,
      error: `uploadpic: ${e instanceof Error ? e.message : String(e)}`,
      raw: ''
    }
  }
}

/**
 * - **信息流图文**（默认）：miniblog `pic_upload.php`；**不**调头条 `uploadpic`。
 * - **头条封面**：`preferV5EditorCover`：先 **v5 抓包**（file_source=4 + card uploadpic），失败再沿用与图文相同的 **miniblog 图床**（不少账号上 v5 专用链路不可用，但返回的 pid/wx URL 仍可写入 draft/save 的 `cover`）。
 */
export async function uploadOneWeiboPicB64 (
  userId: string,
  part: ImagePart,
  opts?: { preferV5EditorCover?: boolean }
): Promise<{ ok: true; pid: string } | { ok: false; error: string }> {
  const cookies = readWeiboPlaywrightStorageCookies(userId) as
    | StorageStateCookie[]
    | null
  if (!cookies?.length) {
    return { ok: false, error: '无会话 Cookie' }
  }

  const cookieHeaderLegacy = cookieHeaderForUrl(
    'https://picupload.service.weibo.com/',
    cookies
  )
  const cookieHeaderWeiboPic = cookieHeaderForUrl(
    'https://picupload.weibo.com/',
    cookies
  )
  const cookieHeaderMain =
    cookieHeaderLegacy ||
    cookieHeaderWeiboPic ||
    cookieHeaderForUrl('https://card.weibo.com/', cookies) ||
    cookieHeaderForUrl('https://weibo.com/', cookies)

  if (!cookieHeaderMain) {
    return {
      ok: false,
      error:
        '无法为图床域拼 Cookie（请用「连接微博」重新登录，确保会话含 .weibo.com）'
    }
  }

  const xsrfCookie =
    cookieHeaderForUrl('https://weibo.com/', cookies) || cookieHeaderMain
  let xsrf: string | null = null
  try {
    xsrf = await resolveXsrf(cookies, xsrfCookie)
  } catch {
    xsrf = null
  }

  try {
    const chPic =
      cookieHeaderWeiboPic || cookieHeaderLegacy || cookieHeaderMain
    const errs: string[] = []
    /** 图文分支已在首段试过 service 时，避免末尾重复 multipart/base64 */
    let skipDuplicateServiceFallback = false

    const tryCardPlugins = async (): Promise<string | null> => {
      for (const base of [
        'https://card.weibo.com',
        'https://card.weibo.cn'
      ] as const) {
        const ch = cookieHeaderForUrl(`${base}/`, cookies)
        if (!ch) continue
        const plug = await tryCardV5EditorPluginsUploadpic(part, ch, xsrf, base)
        if (plug.ok) return plug.pid
        errs.push(plug.error)
      }
      return null
    }

    if (opts?.preferV5EditorCover) {
      const wbBFirst = await tryPicUploadPicuploadWeiboComBase64(
        part,
        chPic,
        xsrf,
        'card'
      )
      if (wbBFirst.ok) return { ok: true, pid: wbBFirst.pid }
      errs.push(wbBFirst.error)
      const wbMpFirst = await tryPicUploadPicuploadWeiboComMultipart(
        part,
        chPic,
        xsrf,
        'card'
      )
      if (wbMpFirst.ok) return { ok: true, pid: wbMpFirst.pid }
      errs.push(wbMpFirst.error)
      const fromEditorFirst = await tryCardPlugins()
      if (fromEditorFirst) return { ok: true, pid: fromEditorFirst }
    }

    const runMiniblogPicuploadFallback =
      async (): Promise<{ ok: true; pid: string } | null> => {
        const weiboPicOrigin = 'https://picupload.weibo.com'
        if (cookieHeaderLegacy) {
          skipDuplicateServiceFallback = true
          const svcMp = await tryPicUploadMultipart(
            part,
            cookieHeaderLegacy,
            xsrf
          )
          if (svcMp.ok) return { ok: true, pid: svcMp.pid }
          errs.push(svcMp.error)
          const svcB = await tryPicUploadBase64(part, cookieHeaderLegacy, xsrf)
          if (svcB.ok) return { ok: true, pid: svcB.pid }
          errs.push(svcB.error)
        }
        const mpW = await tryPicUploadMultipart(part, chPic, xsrf, weiboPicOrigin)
        if (mpW.ok) return { ok: true, pid: mpW.pid }
        errs.push(mpW.error)
        const b64W = await tryPicUploadBase64(part, chPic, xsrf, weiboPicOrigin)
        if (b64W.ok) return { ok: true, pid: b64W.pid }
        errs.push(b64W.error)
        const wbMpFeed = await tryPicUploadPicuploadWeiboComMultipart(
          part,
          chPic,
          xsrf,
          'feed'
        )
        if (wbMpFeed.ok) return { ok: true, pid: wbMpFeed.pid }
        errs.push(wbMpFeed.error)
        const wbBFeed = await tryPicUploadPicuploadWeiboComBase64(
          part,
          chPic,
          xsrf,
          'feed'
        )
        if (wbBFeed.ok) return { ok: true, pid: wbBFeed.pid }
        errs.push(wbBFeed.error)
        return null
      }

    if (opts?.preferV5EditorCover) {
      const headCover = await runMiniblogPicuploadFallback()
      if (headCover) return headCover
    } else {
      const feedCover = await runMiniblogPicuploadFallback()
      if (feedCover) return feedCover
    }

    if (cookieHeaderLegacy && !skipDuplicateServiceFallback) {
      const b64 = await tryPicUploadBase64(part, cookieHeaderLegacy, xsrf)
      if (b64.ok) return { ok: true, pid: b64.pid }
      errs.push(b64.error)
      const mp = await tryPicUploadMultipart(part, cookieHeaderLegacy, xsrf)
      if (mp.ok) return { ok: true, pid: mp.pid }
      errs.push(mp.error)
    }

    return {
      ok: false,
      error: errs.filter(Boolean).join(' | ').slice(0, 900)
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
