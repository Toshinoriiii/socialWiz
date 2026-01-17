/**
 * 微信公众号平台类型定义
 * Feature: 005-wechat-integration
 */

// ============================================
// 配置相关类型
// ============================================

/**
 * 微信公众号配置
 */
export interface WechatConfig {
  id: string
  userId: string
  appId: string
  accountName: string | null
  accountType: 'subscription' | 'service' | 'enterprise' | null
  subjectType: 'personal' | 'enterprise' | null
  canPublish: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * 创建配置请求
 */
export interface CreateWechatConfigRequest {
  appId: string
  appSecret: string
  accountName?: string
}

/**
 * 更新配置请求
 */
export interface UpdateWechatConfigRequest {
  appSecret?: string
  accountName?: string
  isActive?: boolean
}

// ============================================
// Token相关类型
// ============================================

/**
 * Access Token缓存结构（Redis）
 */
export interface WechatAccessTokenCache {
  accessToken: string
  expiresAt: number // 过期时间戳（毫秒）
  appId: string
  userId: string
  configId: string
  createdAt: number
}

// ============================================
// 微信API相关类型
// ============================================

/**
 * 微信API基础响应
 */
export interface WechatApiResponse<T = any> {
  errcode?: number
  errmsg?: string
  [key: string]: any
}

/**
 * Token获取响应
 */
export interface WechatTokenResponse {
  access_token: string
  expires_in: number // 有效期（秒）
  errcode?: number
  errmsg?: string
}

/**
 * 微信错误码枚举
 */
export enum WechatErrorCode {
  SUCCESS = 0,
  INVALID_CREDENTIAL = 40001, // access_token无效
  INVALID_APPID = 40013, // AppID错误
  TOKEN_EXPIRED = 40014, // access_token过期
  INVALID_BUTTON = 40016, // 无效的按钮
  IP_NOT_IN_WHITELIST = 40164, // IP白名单错误
  FREQUENCY_LIMIT = 45009, // 频率限制
  NO_PERMISSION = 48001, // 无权限（企业主体限制）
  CONTENT_ILLEGAL = 87014, // 内容违规
}

/**
 * 微信错误码友好提示映射
 */
export const WECHAT_ERROR_MESSAGES: Record<number, string> = {
  [WechatErrorCode.INVALID_CREDENTIAL]: 'AppSecret错误或access_token无效，请检查配置',
  [WechatErrorCode.INVALID_APPID]: 'AppID错误，请检查配置',
  [WechatErrorCode.TOKEN_EXPIRED]: 'access_token已过期，系统将自动刷新',
  [WechatErrorCode.IP_NOT_IN_WHITELIST]: 'IP白名单未配置，请在微信公众平台添加服务器IP',
  [WechatErrorCode.FREQUENCY_LIMIT]: 'API调用频率限制，请稍后再试',
  [WechatErrorCode.NO_PERMISSION]: '个人主体公众号不支持发布功能，请升级为企业主体',
  [WechatErrorCode.CONTENT_ILLEGAL]: '内容不符合平台规范，请检查内容',
}

// ============================================
// 内容发布相关类型
// ============================================

/**
 * 发布请求
 */
export interface PublishRequest {
  configId: string
  title: string
  author?: string
  digest?: string
  content: string
  contentSourceUrl?: string
  thumbMediaId: string // 封面图片media_id
}

/**
 * 发布响应
 */
export interface PublishResponse {
  success: boolean
  mediaId?: string
  url?: string
  message?: string
}

/**
 * 草稿内容结构（微信API）
 */
export interface WechatDraftArticle {
  title: string
  author?: string
  digest?: string
  content: string
  content_source_url?: string
  thumb_media_id: string
  need_open_comment?: 0 | 1
  only_fans_can_comment?: 0 | 1
}

/**
 * 草稿创建请求（微信API）
 */
export interface WechatDraftAddRequest {
  articles: WechatDraftArticle[]
}

/**
 * 草稿创建响应（微信API）
 */
export interface WechatDraftAddResponse {
  media_id: string
  errcode?: number
  errmsg?: string
}

// ============================================
// 内容验证相关类型
// ============================================

/**
 * 内容验证结果
 */
export interface WechatValidationResult {
  valid: boolean
  errors: string[]
  warnings?: string[]
}

/**
 * 内容限制常量
 */
export const WECHAT_CONTENT_LIMITS = {
  MAX_TITLE_LENGTH: 64,
  MAX_CONTENT_LENGTH: 20000,
  MAX_DIGEST_LENGTH: 120,
} as const

// ============================================
// 服务错误类型
// ============================================

/**
 * 微信服务错误
 */
export class WechatServiceError extends Error {
  constructor(
    message: string,
    public code: WechatErrorCode | number,
    public suggestion?: string
  ) {
    super(message)
    this.name = 'WechatServiceError'
  }
}
