/**
 * 知乎图片上传（对齐 BAIGUANGMEI/zhihu-cli：register → OSS PUT → poll）
 * 用于专栏文章封面等，source 常用 `article`。
 */

import crypto from 'crypto'
import sharp from 'sharp'
import { zhihuJsonHeaders } from '@/lib/zhihu-playwright/zhihu-http'

const ZHIHU_IMAGE_API = 'https://api.zhihu.com/images'
const ZHIHU_OSS_UPLOAD_URL = 'https://zhihu-pics-upload.zhimg.com'

export interface ZhihuUploadedImageInfo {
  src: string
  original_src: string
  watermark: string
  watermark_src: string
  width: number
  height: number
}

function formatHttpDate (): string {
  return new Date().toUTCString()
}

async function putToZhihuOss (
  objKey: string,
  body: Buffer,
  token: {
    access_token: string
    access_id: string
    access_key: string
  }
): Promise<{ ok: true } | { ok: false; detail: string }> {
  const contentType = 'image/jpeg'
  const date = formatHttpDate()
  const securityToken = token.access_token
  const accessId = token.access_id
  const accessKey = token.access_key

  const stringToSign =
    `PUT\n\n${contentType}\n${date}\n` +
    `x-oss-security-token:${securityToken}\n` +
    `/zhihu-pics/${objKey}`

  const signature = crypto
    .createHmac('sha1', accessKey)
    .update(stringToSign)
    .digest('base64')

  const url = `${ZHIHU_OSS_UPLOAD_URL}/${objKey}`
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        Date: date,
        'x-oss-security-token': securityToken,
        Authorization: `OSS ${accessId}:${signature}`
      },
      body
    })
    if (!res.ok) {
      const t = await res.text()
      return { ok: false, detail: t.slice(0, 300) }
    }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : String(e)
    }
  }
}

/** 专栏草稿 titleImage 需带鉴权参数的 pic-private 链（与浏览器抓包一致） */
function findFirstPicPrivateUrl (node: unknown, depth = 0): string | null {
  if (depth > 8) return null
  if (typeof node === 'string' && node.includes('pic-private.zhihu.com')) {
    const t = node.trim()
    return t.length > 0 ? t : null
  }
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const x of node) {
      const f = findFirstPicPrivateUrl(x, depth + 1)
      if (f) return f
    }
    return null
  }
  for (const v of Object.values(node)) {
    const f = findFirstPicPrivateUrl(v, depth + 1)
    if (f) return f
  }
  return null
}

/** 轮询 GET /images/{id} 的成功判定（各端字段略有差异） */
function extractPollSuccess (
  data: Record<string, unknown>
):
  | { src: string; original_src: string; watermark: string; watermark_src: string }
  | null {
  const st = data.status
  const stStr = st != null ? String(st).toLowerCase() : ''
  if (
    stStr === 'failed' ||
    stStr === 'failure' ||
    stStr === 'error' ||
    data.error != null
  ) {
    return null
  }

  const pending =
    stStr === 'processing' ||
    stStr === 'pending' ||
    stStr === 'running' ||
    stStr === 'uploading' ||
    stStr === 'init'
  if (pending) return null

  const picPrivate = findFirstPicPrivateUrl(data)
  const srcRaw =
    picPrivate ??
    data.src ??
    data.private_src ??
    data.private_url ??
    data.full_url ??
    data.url ??
    (typeof data.data === 'object' &&
      data.data != null &&
      ((data.data as Record<string, unknown>).src ??
        (data.data as Record<string, unknown>).url ??
        (data.data as Record<string, unknown>).private_url))

  const src = srcRaw != null ? String(srcRaw).trim() : ''
  if (!src) return null

  const looksLikeZhimg =
    src.includes('zhimg.com') ||
    src.includes('pic') ||
    src.includes('zhihu.com')
  const explicitOk =
    stStr === 'success' ||
    stStr === 'done' ||
    st === 1 ||
    data.ready === true ||
    data.processed === true

  if (
    explicitOk ||
    picPrivate ||
    (!stStr && looksLikeZhimg && src.length > 20)
  ) {
    const original = String(
      data.original_src ?? data.original_src_url ?? src
    ).trim()
    return {
      src,
      original_src: original || src,
      watermark: String(data.watermark ?? 'watermark'),
      watermark_src: String(data.watermark_src ?? '')
    }
  }

  return null
}

async function pollZhihuImage (
  imageId: string,
  cookieHeader: string,
  xsrf: string,
  maxAttempts = 45,
  intervalMs = 2000
): Promise<
  | { ok: true; src: string; original_src: string; watermark: string; watermark_src: string }
  | { ok: false; detail: string }
  > {
  let lastSnippet = ''
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${ZHIHU_IMAGE_API}/${encodeURIComponent(imageId)}`, {
        headers: {
          ...zhihuJsonHeaders(xsrf),
          Cookie: cookieHeader,
          Referer: 'https://www.zhihu.com/'
        }
      })
      const text = await res.text()
      lastSnippet = text.replace(/\s+/g, ' ').slice(0, 280)
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          detail: `图片状态 HTTP ${res.status}：${lastSnippet}`
        }
      }
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, intervalMs))
        continue
      }
      let data: Record<string, unknown>
      try {
        data = JSON.parse(text) as Record<string, unknown>
      } catch {
        await new Promise((r) => setTimeout(r, intervalMs))
        continue
      }
      const extracted = extractPollSuccess(data)
      if (extracted) return { ok: true, ...extracted }
    } catch {
      /* 网络抖动：继续轮询 */
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return {
    ok: false,
    detail: `图片处理超时（已轮询约 ${Math.round((maxAttempts * intervalMs) / 1000)}s）。最后响应片段：${lastSnippet || '（无）'}`
  }
}

/**
 * 将本地图片字节上传至知乎图床，返回正文/封面可用的 URL 与尺寸。
 */
export async function uploadZhihuImageFromBuffer (params: {
  imageBytes: Buffer
  cookieHeaderForApiZhihu: string
  xsrf: string
  /** 与 zhihu-cli 一致：article / pin 等 */
  source?: string
}): Promise<
  | { ok: true; info: ZhihuUploadedImageInfo }
  | { ok: false; error: string; detail?: string }
  > {
  const { cookieHeaderForApiZhihu, xsrf, source = 'article' } = params
  let jpeg: Buffer
  try {
    jpeg = await sharp(params.imageBytes)
      .rotate()
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer()
  } catch (e) {
    return {
      ok: false,
      error: '封面图无法解析',
      detail: e instanceof Error ? e.message : String(e)
    }
  }

  const md5Hex = crypto.createHash('md5').update(jpeg).digest('hex')

  let regJson: Record<string, unknown>
  try {
    const regRes = await fetch(ZHIHU_IMAGE_API, {
      method: 'POST',
      headers: {
        ...zhihuJsonHeaders(xsrf),
        Cookie: cookieHeaderForApiZhihu,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ image_hash: md5Hex, source })
    })
    const regText = await regRes.text()
    if (!regRes.ok) {
      return {
        ok: false,
        error: `知乎图片注册失败（HTTP ${regRes.status}）`,
        detail: regText.slice(0, 400)
      }
    }
    regJson = JSON.parse(regText) as Record<string, unknown>
  } catch (e) {
    return {
      ok: false,
      error: '知乎图片注册请求失败',
      detail: e instanceof Error ? e.message : String(e)
    }
  }

  const uploadFile = regJson.upload_file as Record<string, unknown> | undefined
  const uploadToken = regJson.upload_token as Record<string, string> | undefined

  if (!uploadFile) {
    return {
      ok: false,
      error: '图片注册响应异常',
      detail: JSON.stringify(regJson).slice(0, 400)
    }
  }

  const imageId = String(uploadFile.image_id ?? '')
  const state = Number(uploadFile.state)
  if (!imageId) {
    return { ok: false, error: '未返回 image_id', detail: JSON.stringify(regJson).slice(0, 300) }
  }

  // state=1：服务端已接受/秒传，无 upload_token，直接轮询即可
  // state=2：需带 upload_token 走 OSS PUT
  if (state === 2) {
    if (
      !uploadToken?.access_token ||
      !uploadToken?.access_id ||
      !uploadToken?.access_key
    ) {
      return {
        ok: false,
        error: '图片需 OSS 上传但注册响应未含 upload_token',
        detail: JSON.stringify(regJson).slice(0, 400)
      }
    }
    const objKey = String(uploadFile.object_key ?? '')
    if (!objKey) {
      return { ok: false, error: '缺少 object_key', detail: JSON.stringify(uploadFile) }
    }
    const oss = await putToZhihuOss(objKey, jpeg, {
      access_token: uploadToken.access_token,
      access_id: uploadToken.access_id,
      access_key: uploadToken.access_key
    })
    if (!oss.ok) {
      return { ok: false, error: '知乎 OSS 上传失败', detail: oss.detail }
    }
  } else if (state !== 1) {
    return {
      ok: false,
      error: `未知图片状态 state=${state}`,
      detail: JSON.stringify(uploadFile).slice(0, 200)
    }
  }

  // OSS 落盘与异步处理之间有间隔；state=1（秒传）在多任务并发时也可能短暂停在 init，首轮多等一会
  await new Promise((r) => setTimeout(r, state === 2 ? 1000 : 2500))

  const polled = await pollZhihuImage(imageId, cookieHeaderForApiZhihu, xsrf)
  if (!polled.ok) {
    return { ok: false, error: '知乎图片处理失败', detail: polled.detail }
  }
  if (!polled.src.trim()) {
    return { ok: false, error: '图片处理完成但无 src', detail: JSON.stringify(polled) }
  }

  let width = 0
  let height = 0
  try {
    const meta = await sharp(jpeg).metadata()
    width = meta.width ?? 0
    height = meta.height ?? 0
  } catch {
    /* ignore */
  }

  return {
    ok: true,
    info: {
      src: polled.src,
      original_src: polled.original_src || polled.src,
      watermark: polled.watermark,
      watermark_src: polled.watermark_src,
      width,
      height
    }
  }
}
