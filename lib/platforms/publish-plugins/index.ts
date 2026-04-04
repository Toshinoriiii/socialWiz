import { Platform } from '@/types/platform.types'
import type { PlatformPublishPlugin } from '@/lib/platforms/publish-plugins/types'
import { weiboPlaywrightPlugin } from '@/lib/platforms/publish-plugins/weibo-playwright.plugin'

const plugins: Partial<Record<Platform, PlatformPublishPlugin>> = {
  [Platform.WEIBO]: weiboPlaywrightPlugin
}

export function getPublishPlugin(platform: Platform): PlatformPublishPlugin | null {
  return plugins[platform] ?? null
}

export { weiboPlaywrightPlugin }
