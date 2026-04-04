/**
 * 平台发布配置类型定义
 * Feature: 006-platform-publish-config
 */

import { Platform } from '@/types/platform.types'

/**
 * 平台发布配置基础接口
 */
export interface PlatformPublishConfig {
  id: string
  userId: string
  platform: Platform
  configName: string
  description?: string
  configData: PlatformConfigData
  isDefault: boolean
  usageCount: number
  createdAt: Date
  updatedAt: Date
}

/**
 * 平台配置数据联合类型(使用 Discriminated Unions)
 */
export type PlatformConfigData =
  | WechatPublishConfigData
  | WeiboPublishConfigData
  | DouyinPublishConfigData
  | XiaohongshuPublishConfigData

/**
 * 微信公众号发布配置
 */
export interface WechatPublishConfigData {
  type: 'wechat'
  author?: string
  contentSourceUrl?: string
  needOpenComment?: boolean
  onlyFansCanComment?: boolean
}

/** 微博可见范围（PC 发博 visible 常见取值：公开省略或 0；好友约 10；仅自己约 1，以抓包为准） */
export type WeiboVisibilityLevel = 'public' | 'friends' | 'self'

/** 微博内容声明，对应 draft/publish 等接口的 mblog_statement */
export type WeiboMblogStatement = '0' | '1' | '2' | '3'

/**
 * 微博发布配置（会话发博 / 逆向接口）
 */
export interface WeiboPublishConfigData {
  type: 'weibo'
  /** 发布文章：专栏名称（需在平台创建；当前写入草稿 `source` 备扩展） */
  articleColumnName?: string
  /** 发布文章：仅粉丝阅读全文 → follow_to_read */
  articleFollowersOnlyFullText?: boolean
  /** 发布文章：可见范围（产品侧；完整对接依赖编辑器接口扩展） */
  articleVisibility?: WeiboVisibilityLevel
  /** 发布文章：内容声明 → mblog_statement */
  articleContentDeclaration?: WeiboMblogStatement
  /** 发布文章：同步到微博的文案；空则自动生成「发布了头条文章：《标题》」 */
  articleWeiboStatusText?: string

  /** 图文：地点（占位；后续可接 POI 搜索） */
  imageTextLocation?: string
  imageTextVisibility?: WeiboVisibilityLevel
  imageTextContentDeclaration?: WeiboMblogStatement

  /** 兼容旧版配置 */
  visibility?: WeiboVisibilityLevel
  allowComment?: boolean
  allowRepost?: boolean
}

/**
 * 抖音发布配置
 */
export interface DouyinPublishConfigData {
  type: 'douyin'
  allowComment?: boolean
  allowDuet?: boolean
  allowStitch?: boolean
  privacyLevel?: 'public' | 'friends' | 'self'
}

/**
 * 小红书发布配置
 */
export interface XiaohongshuPublishConfigData {
  type: 'xiaohongshu'
  noteType?: 'normal' | 'video'
  allowComment?: boolean
  poiId?: string
}

/**
 * 创建配置输入
 */
export interface CreateConfigInput {
  platform: Platform
  configName: string
  description?: string
  configData: PlatformConfigData
}

/**
 * 更新配置输入
 */
export interface UpdateConfigInput {
  configName?: string
  description?: string
  configData?: PlatformConfigData
}

/**
 * 查询参数
 */
export interface GetConfigsParams {
  platform?: Platform
  isDefault?: boolean
}

/**
 * 配置列表响应
 */
export interface ConfigListResponse {
  configs: PlatformPublishConfig[]
  total: number
}

/**
 * 类型守卫: 判断是否为微信配置
 */
export function isWechatConfig(
  data: PlatformConfigData
): data is WechatPublishConfigData {
  return data.type === 'wechat'
}

/**
 * 类型守卫: 判断是否为微博配置
 */
export function isWeiboConfig(
  data: PlatformConfigData
): data is WeiboPublishConfigData {
  return data.type === 'weibo'
}

/**
 * 类型守卫: 判断是否为抖音配置
 */
export function isDouyinConfig(
  data: PlatformConfigData
): data is DouyinPublishConfigData {
  return data.type === 'douyin'
}

/**
 * 类型守卫: 判断是否为小红书配置
 */
export function isXiaohongshuConfig(
  data: PlatformConfigData
): data is XiaohongshuPublishConfigData {
  return data.type === 'xiaohongshu'
}
