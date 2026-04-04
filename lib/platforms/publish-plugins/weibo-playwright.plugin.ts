import { Platform } from '@/types/platform.types'
import type {
  PlatformPublishPlugin,
  PublishPluginContext,
  PublishPluginResult,
  WeiboPublishExtras
} from '@/lib/platforms/publish-plugins/types'
import { startWeiboPlaywrightComposeProcess } from '@/lib/weibo-playwright/compose-runner'
import { weiboPlaywrightSessionExists } from '@/lib/weibo-playwright/session-files'

export const weiboPlaywrightPlugin: PlatformPublishPlugin = {
  platform: Platform.WEIBO,
  transport: 'http_replay',

  async publishText(
    ctx: PublishPluginContext,
    text: string,
    extras?: WeiboPublishExtras
  ): Promise<PublishPluginResult> {
    if (!weiboPlaywrightSessionExists(ctx.userId)) {
      return {
        ok: false,
        error: '尚未完成浏览器绑定或会话文件已删除',
        hint: '请在账号管理使用「连接微博（浏览器）」完成登录'
      }
    }
    const r = await startWeiboPlaywrightComposeProcess(ctx.userId, text, {
      imageUrls: extras?.imageUrls,
      title: extras?.title,
      contentType: extras?.contentType,
      weiboPublishConfig: extras?.weiboPublishConfig
    })
    if (!r.ok) {
      return {
        ok: false,
        error: r.error,
        detail: r.detail,
        hint: r.hint
      }
    }
    return {
      ok: true,
      platformPostId: r.platformPostId,
      publishedUrl: r.publishedUrl
    }
  }
}
