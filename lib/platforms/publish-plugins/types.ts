import type { Platform } from '@/types/platform.types'
import type {
  WeiboPublishConfigData,
  ZhihuPublishConfigData
} from '@/types/platform-config.types'
import type { ImagePart } from '@/lib/weibo-playwright/weibo-web-pic-upload'

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
  /** 头条文章封面原始图（优先于 imageUrls 首图） */
  coverImagePart?: ImagePart
  title?: string
  contentType?: string
  weiboPublishConfig?: WeiboPublishConfigData
}

/** 微信公众号网页会话发图文 */
export type WechatPublishExtras = {
  title?: string
  htmlBody?: string
  digest?: string
  coverImageUrl?: string
  contentSourceUrl?: string
  author?: string
  coverFallback?: { buffer: Buffer; filename: string; contentType: string }
}

/** 知乎网页会话发专栏文章（zhuanlan API） */
export type ZhihuPublishExtras = {
  title?: string
  zhihuPublishConfig?: ZhihuPublishConfigData
  /** 专栏标题图，走 api.zhihu.com/images 后写入草稿 titleImage */
  coverImage?: { buffer: Buffer; contentType?: string }
}

export type PublishExtras =
  | WeiboPublishExtras
  | WechatPublishExtras
  | ZhihuPublishExtras

export interface PlatformPublishPlugin {
  readonly platform: Platform
  readonly transport: PublishPluginTransport
  /** 发帖；extras 按平台分支（微博 | 微信） */
  publishText(
    ctx: PublishPluginContext,
    text: string,
    extras?: PublishExtras
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
  pluginId: 'weibo-playwright' | 'zhihu-playwright'
}
