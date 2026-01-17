/**
 * 微信公众号平台类型接口和枚举
 * Feature: 005-wechat-integration
 */

// ============================================
// 微信API基础类型
// ============================================

/**
 * 微信API响应基础接口
 */
export interface WechatApiBaseResponse {
  errcode?: number
  errmsg?: string
}

/**
 * 微信Token响应
 */
export interface WechatTokenResponse extends WechatApiBaseResponse {
  access_token: string
  expires_in: number // 有效期（秒）
}

/**
 * 微信草稿文章
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
 * 微信草稿添加请求
 */
export interface WechatDraftAddRequest {
  articles: WechatDraftArticle[]
}

/**
 * 微信草稿添加响应
 */
export interface WechatDraftAddResponse extends WechatApiBaseResponse {
  media_id?: string
}

// ============================================
// 微信错误码
// ============================================

/**
 * 微信常见错误码
 */
export enum WechatErrorCode {
  SUCCESS = 0,
  INVALID_CREDENTIAL = 40001,
  INVALID_APPID = 40013,
  TOKEN_EXPIRED = 40014,
  IP_NOT_IN_WHITELIST = 40164,
  FREQUENCY_LIMIT = 45009,
  NO_PERMISSION = 48001,
  CONTENT_ILLEGAL = 87014,
}

/**
 * 微信错误信息映射
 */
export const WECHAT_ERROR_MAP: Record<number, { message: string; suggestion: string }> = {
  [WechatErrorCode.INVALID_CREDENTIAL]: {
    message: 'AppSecret错误或access_token无效',
    suggestion: '请检查微信公众号配置中的AppID和AppSecret是否正确'
  },
  [WechatErrorCode.INVALID_APPID]: {
    message: 'AppID错误',
    suggestion: '请检查配置的AppID是否正确'
  },
  [WechatErrorCode.TOKEN_EXPIRED]: {
    message: 'access_token已过期',
    suggestion: '系统将自动刷新token，请稍后重试'
  },
  [WechatErrorCode.IP_NOT_IN_WHITELIST]: {
    message: 'IP白名单未配置',
    suggestion: '请在微信公众平台后台添加服务器IP到白名单'
  },
  [WechatErrorCode.FREQUENCY_LIMIT]: {
    message: 'API调用频率限制',
    suggestion: '请稍后再试，避免频繁调用'
  },
  [WechatErrorCode.NO_PERMISSION]: {
    message: '无权限执行该操作',
    suggestion: '个人主体公众号不支持发布功能，请升级为企业主体'
  },
  [WechatErrorCode.CONTENT_ILLEGAL]: {
    message: '内容不符合平台规范',
    suggestion: '请检查内容是否包含违规信息'
  }
}

// ============================================
// 内容限制常量
// ============================================

/**
 * 微信内容限制
 */
export const WECHAT_CONTENT_LIMITS = {
  MAX_TITLE_LENGTH: 64,
  MAX_CONTENT_LENGTH: 20000,
  MAX_DIGEST_LENGTH: 120,
  MAX_AUTHOR_LENGTH: 64,
} as const

// ============================================
// Token管理相关
// ============================================

/**
 * Token缓存Key前缀
 */
export const WECHAT_TOKEN_KEY_PREFIX = 'wechat:token:'

/**
 * Token锁Key前缀
 */
export const WECHAT_LOCK_KEY_PREFIX = 'wechat:lock:'

/**
 * Token有效期（秒）
 */
export const WECHAT_TOKEN_EXPIRES_IN = 7200 // 2小时

/**
 * Token缓存TTL（秒），提前200秒过期
 */
export const WECHAT_TOKEN_CACHE_TTL = 7000

/**
 * Token刷新阈值（秒），剩余时间少于此值时提前刷新
 */
export const WECHAT_TOKEN_REFRESH_THRESHOLD = 300 // 5分钟

/**
 * 分布式锁TTL（毫秒）
 */
export const WECHAT_LOCK_TTL = 30000 // 30秒
