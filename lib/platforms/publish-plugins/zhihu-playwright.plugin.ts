import { Platform } from '@/types/platform.types'
import type {
  PlatformPublishPlugin,
  PublishPluginContext,
  PublishPluginResult,
  ZhihuPublishExtras
} from '@/lib/platforms/publish-plugins/types'
import { zhihuPlaywrightSessionExists } from '@/lib/zhihu-playwright/session-files'
import { publishZhihuArticleFromSession } from '@/lib/zhihu-playwright/zhihu-article-publish'

export const zhihuPlaywrightPlugin: PlatformPublishPlugin = {
  platform: Platform.ZHIHU,
  transport: 'http_replay',

  async publishText (
    ctx: PublishPluginContext,
    text: string,
    extras?: ZhihuPublishExtras
  ): Promise<PublishPluginResult> {
    if (!zhihuPlaywrightSessionExists(ctx.userId)) {
      return {
        ok: false,
        error: '尚未完成浏览器绑定或会话文件已删除',
        hint: '请在账号管理使用「连接知乎（浏览器）」完成登录'
      }
    }
    const title = extras?.title?.trim() ?? ''
    const r = await publishZhihuArticleFromSession(
      ctx.userId,
      title,
      text.trim(),
      extras?.zhihuPublishConfig,
      extras?.coverImage
    )
    if (!r.ok) {
      return {
        ok: false,
        error: r.error,
        detail: r.detail,
        hint:
          '失败时请重新绑定会话，并对照 zhihu-article-publish.ts / 开源 zhihu-cli 抓包是否变更'
      }
    }
    return {
      ok: true,
      platformPostId: r.platformPostId,
      publishedUrl: r.publishedUrl
    }
  }
}
