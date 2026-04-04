import { Platform } from '@/types/platform.types'
import type { UploaderManifestEntry } from '@/lib/platforms/publish-plugins/types'

export const UPLOADER_MANIFEST: Partial<Record<Platform, UploaderManifestEntry>> = {
  [Platform.WEIBO]: {
    platform: Platform.WEIBO,
    saveSessionRelativeDir: 'scripts/weibo-playwright/sessions',
    contentKinds: ['text', 'image'],
    supportsHeadless: false,
    pluginId: 'weibo-playwright'
  }
}
