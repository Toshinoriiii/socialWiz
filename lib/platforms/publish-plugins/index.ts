import { Platform } from '@/types/platform.types'
import type { PlatformPublishPlugin } from '@/lib/platforms/publish-plugins/types'
import { weiboPlaywrightPlugin } from '@/lib/platforms/publish-plugins/weibo-playwright.plugin'
import { wechatPlaywrightPlugin } from '@/lib/platforms/publish-plugins/wechat-playwright.plugin'
import { zhihuPlaywrightPlugin } from '@/lib/platforms/publish-plugins/zhihu-playwright.plugin'

const plugins: Partial<Record<Platform, PlatformPublishPlugin>> = {
  [Platform.WEIBO]: weiboPlaywrightPlugin,
  [Platform.WECHAT]: wechatPlaywrightPlugin,
  [Platform.ZHIHU]: zhihuPlaywrightPlugin
}

export function getPublishPlugin(platform: Platform): PlatformPublishPlugin | null {
  return plugins[platform] ?? null
}

export { weiboPlaywrightPlugin, wechatPlaywrightPlugin, zhihuPlaywrightPlugin }
