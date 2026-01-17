/**
 * 微信公众号工具函数
 * Feature: 005-wechat-integration
 */

import {
  WECHAT_CONTENT_LIMITS,
  WechatErrorCode,
  WECHAT_ERROR_MAP
} from './wechat-types'

/**
 * 内容验证结果
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * 验证标题
 * @param title 标题
 * @returns 验证结果
 */
export function validateTitle(title: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  if (!title || title.trim().length === 0) {
    errors.push('标题不能为空')
  } else if (title.length > WECHAT_CONTENT_LIMITS.MAX_TITLE_LENGTH) {
    errors.push(`标题长度不能超过${WECHAT_CONTENT_LIMITS.MAX_TITLE_LENGTH}个字符`)
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * 验证内容
 * @param content 内容
 * @returns 验证结果
 */
export function validateContent(content: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  if (!content || content.trim().length === 0) {
    errors.push('内容不能为空')
  } else if (content.length > WECHAT_CONTENT_LIMITS.MAX_CONTENT_LENGTH) {
    errors.push(`内容长度不能超过${WECHAT_CONTENT_LIMITS.MAX_CONTENT_LENGTH}个字符`)
  }
  
  if (content.length < 100) {
    warnings.push('内容较短，建议补充更多内容')
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * 验证摘要
 * @param digest 摘要
 * @returns 验证结果
 */
export function validateDigest(digest?: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  if (digest && digest.length > WECHAT_CONTENT_LIMITS.MAX_DIGEST_LENGTH) {
    errors.push(`摘要长度不能超过${WECHAT_CONTENT_LIMITS.MAX_DIGEST_LENGTH}个字符`)
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * 验证作者
 * @param author 作者
 * @returns 验证结果
 */
export function validateAuthor(author?: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  if (author && author.length > WECHAT_CONTENT_LIMITS.MAX_AUTHOR_LENGTH) {
    errors.push(`作者名称长度不能超过${WECHAT_CONTENT_LIMITS.MAX_AUTHOR_LENGTH}个字符`)
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * 验证发布内容
 * @param data 发布数据
 * @returns 验证结果
 */
export function validatePublishContent(data: {
  title: string
  content: string
  thumbMediaId: string
  author?: string
  digest?: string
}): ValidationResult {
  const allErrors: string[] = []
  const allWarnings: string[] = []
  
  // 验证标题
  const titleResult = validateTitle(data.title)
  allErrors.push(...titleResult.errors)
  allWarnings.push(...titleResult.warnings)
  
  // 验证内容
  const contentResult = validateContent(data.content)
  allErrors.push(...contentResult.errors)
  allWarnings.push(...contentResult.warnings)
  
  // 验证摘要
  if (data.digest) {
    const digestResult = validateDigest(data.digest)
    allErrors.push(...digestResult.errors)
    allWarnings.push(...digestResult.warnings)
  }
  
  // 验证作者
  if (data.author) {
    const authorResult = validateAuthor(data.author)
    allErrors.push(...authorResult.errors)
    allWarnings.push(...authorResult.warnings)
  }
  
  // 验证封面图片
  if (!data.thumbMediaId || data.thumbMediaId.trim().length === 0) {
    allErrors.push('封面图片media_id不能为空')
  }
  
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  }
}

/**
 * 获取微信错误的友好提示
 * @param errcode 错误码
 * @param errmsg 原始错误消息
 * @returns 友好提示
 */
export function getWechatErrorMessage(errcode: number, errmsg?: string): string {
  const errorInfo = WECHAT_ERROR_MAP[errcode]
  
  if (errorInfo) {
    return `${errorInfo.message}\n建议: ${errorInfo.suggestion}`
  }
  
  return errmsg || `微信API错误 (错误码: ${errcode})`
}

/**
 * 判断是否为致命错误（需要用户干预）
 * @param errcode 错误码
 * @returns 是否为致命错误
 */
export function isFatalError(errcode: number): boolean {
  const fatalErrors = [
    WechatErrorCode.INVALID_CREDENTIAL,
    WechatErrorCode.INVALID_APPID,
    WechatErrorCode.IP_NOT_IN_WHITELIST,
    WechatErrorCode.NO_PERMISSION
  ]
  
  return fatalErrors.includes(errcode)
}

/**
 * 判断是否可以重试
 * @param errcode 错误码
 * @returns 是否可以重试
 */
export function isRetryableError(errcode: number): boolean {
  const retryableErrors = [
    WechatErrorCode.FREQUENCY_LIMIT,
    WechatErrorCode.TOKEN_EXPIRED
  ]
  
  return retryableErrors.includes(errcode)
}

/**
 * 隐藏AppID（部分显示）
 * @param appId AppID
 * @returns 隐藏后的AppID
 */
export function maskAppId(appId: string): string {
  if (!appId || appId.length < 8) {
    return appId
  }
  
  const prefix = appId.substring(0, 4)
  const suffix = appId.substring(appId.length - 4)
  const masked = '*'.repeat(appId.length - 8)
  
  return `${prefix}${masked}${suffix}`
}

/**
 * 生成Redis Token缓存Key
 * @param userId 用户ID
 * @param configId 配置ID
 * @returns Redis Key
 */
export function getTokenCacheKey(userId: string, configId: string): string {
  return `wechat:token:${userId}:${configId}`
}

/**
 * 生成Redis锁Key
 * @param userId 用户ID
 * @param configId 配置ID
 * @returns Redis Key
 */
export function getTokenLockKey(userId: string, configId: string): string {
  return `wechat:lock:${userId}:${configId}`
}

/**
 * 计算token是否需要刷新
 * @param expiresAt 过期时间戳（毫秒）
 * @param thresholdSeconds 提前刷新阈值（秒），默认300秒
 * @returns 是否需要刷新
 */
export function shouldRefreshToken(
  expiresAt: number,
  thresholdSeconds: number = 300
): boolean {
  const now = Date.now()
  const remainingMs = expiresAt - now
  const thresholdMs = thresholdSeconds * 1000
  
  return remainingMs < thresholdMs
}

/**
 * 格式化错误信息用于日志
 * @param error 错误对象
 * @returns 格式化的错误信息
 */
export function formatErrorForLogging(error: any): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack || ''}`
  }
  
  return String(error)
}
