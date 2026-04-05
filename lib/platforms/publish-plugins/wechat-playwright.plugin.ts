import { Platform } from '@/types/platform.types'
import type {
  PlatformPublishPlugin,
  PublishPluginContext,
  PublishPluginResult,
  WechatPublishExtras
} from '@/lib/platforms/publish-plugins/types'
import { startWechatPlaywrightComposeProcess } from '@/lib/wechat-playwright/compose-runner'
import { wechatPlaywrightSessionExists } from '@/lib/wechat-playwright/session-files'

export const wechatPlaywrightPlugin: PlatformPublishPlugin = {
  platform: Platform.WECHAT,
  transport: 'http_replay',

  async publishText (
    ctx: PublishPluginContext,
    text: string,
    extras?: WechatPublishExtras
  ): Promise<PublishPluginResult> {
    if (!wechatPlaywrightSessionExists(ctx.userId)) {
      return {
        ok: false,
        error: '尚未完成浏览器绑定或会话文件已删除',
        hint: '请在账号管理使用「连接微信（本机浏览器）」完成登录'
      }
    }

    const title = (extras?.title ?? '').trim() || '未命名'
    const html = (extras?.htmlBody ?? text).trim()
    const digest = (extras?.digest ?? '').trim().slice(0, 120)
    const coverImageUrl = (extras?.coverImageUrl ?? '').trim()

    if (!coverImageUrl) {
      return {
        ok: false,
        error: '缺少封面图 URL',
        hint: '请为草稿设置封面，并确保 NEXT_PUBLIC_BASE_URL / INTERNAL_MEDIA_BASE_URL 可访问该图'
      }
    }

    const r = await startWechatPlaywrightComposeProcess(ctx.userId, {
      title,
      html,
      digest: digest || title.slice(0, 120),
      coverImageUrl,
      contentSourceUrl: extras?.contentSourceUrl,
      author: extras?.author,
      coverFallback: extras?.coverFallback
    })

    if (!r.ok) {
      return {
        ok: false,
        error: r.error,
        detail: r.detail,
        hint: r.hint,
        platformPostId: r.platformPostId
      }
    }
    return {
      ok: true,
      platformPostId: r.platformPostId,
      publishedUrl: r.publishedUrl
    }
  }
}
