import { tryPublishWechatMpViaWebSession } from '@/lib/wechat-playwright/wechat-mp-web-publish'
import { wechatPlaywrightSessionExists } from '@/lib/wechat-playwright/session-files'

export interface WechatComposeStartResult {
  ok: boolean
  error?: string
  detail?: string
  hint?: string
  platformPostId?: string
  publishedUrl?: string
}

export interface WechatComposeOptions {
  title: string
  html: string
  digest: string
  coverImageUrl: string
  contentSourceUrl?: string
  author?: string
  coverFallback?: { buffer: Buffer; filename: string; contentType: string }
}

export async function startWechatPlaywrightComposeProcess (
  userId: string,
  options: WechatComposeOptions
): Promise<WechatComposeStartResult> {
  if (!wechatPlaywrightSessionExists(userId)) {
    return {
      ok: false,
      error: '尚未完成微信浏览器绑定或会话文件已删除',
      hint: '请在账号管理使用「连接微信（本机浏览器）」登录公众平台'
    }
  }

  const r = await tryPublishWechatMpViaWebSession(
    userId,
    {
      title: options.title.trim(),
      html: options.html,
      digest: options.digest,
      coverImageUrl: options.coverImageUrl,
      contentSourceUrl: options.contentSourceUrl?.trim(),
      author: options.author?.trim()
    },
    options.coverFallback
  )

  if (!r.ok) {
    return {
      ok: false,
      error: r.error,
      detail: r.detail,
      hint: r.hint,
      platformPostId: r.appMsgId
    }
  }
  return {
    ok: true,
    platformPostId: r.appMsgId,
    publishedUrl: r.publishedUrl,
    hint: r.hint
  }
}
