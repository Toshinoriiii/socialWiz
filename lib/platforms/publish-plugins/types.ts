import type { Platform } from '@/types/platform.types'
import type { WeiboPublishConfigData } from '@/types/platform-config.types'

export type PublishPluginTransport = 'browser' | 'http_replay'

export interface PublishPluginContext {
  userId: string
  platformAccountId: string
  contentId?: string
}

/** 插件执行结果 */
export interface PublishPluginResult {
  ok: boolean
  error?: string
  detail?: string
  hint?: string
  /** 平台侧帖文 id / mid（若能从响应或子进程解析） */
  platformPostId?: string
  /** 用户可点击打开的微博链接 */
  publishedUrl?: string
}

export type WeiboPublishExtras = {
  imageUrls?: string[]
  title?: string
  contentType?: string
  weiboPublishConfig?: WeiboPublishConfigData
}

export interface PlatformPublishPlugin {
  readonly platform: Platform
  readonly transport: PublishPluginTransport
  /** 发帖（微博支持 extras：图片 URL、标题、内容类型） */
  publishText(
    ctx: PublishPluginContext,
    text: string,
    extras?: WeiboPublishExtras
  ): Promise<PublishPluginResult>
}

export interface UploaderManifestEntry {
  platform: Platform
  saveSessionRelativeDir: string
  /** 已废弃：发博改为站内 HTTP，不再需要 compose 脚本路径 */
  composeScriptRelativePath?: string
  contentKinds: Array<'text' | 'image' | 'video'>
  supportsHeadless: boolean
  /** 运行时插件 */
  pluginId: 'weibo-playwright'
}
