/**
 * 微信公众号工具函数
 * 内容验证、格式转换等工具函数
 */

import type { PublishContent, ValidationResult } from '../base/types'

/**
 * 验证微信公众号内容
 */
export function validateWechatContent(content: PublishContent): ValidationResult {
  const errors: string[] = []

  // TODO: 根据微信 API 文档确定具体的内容限制
  // 目前使用临时值，实际需要根据微信文档调整
  const MAX_TEXT_LENGTH = 20000 // 临时值，需要确认微信的实际限制

  // 验证文字不能为空
  if (!content.text || content.text.trim().length === 0) {
    errors.push('文字内容不能为空')
  }

  // 验证文字长度
  if (content.text && content.text.length > MAX_TEXT_LENGTH) {
    errors.push(`文字内容超过${MAX_TEXT_LENGTH}字限制（当前: ${content.text.length}字）`)
  }

  // 如果包含图片（需要确认微信的实际限制）
  if (content.images && content.images.length > 0) {
    if (content.images.length > 8) {
      errors.push(`图片数量超过8张限制（当前: ${content.images.length}张）`)
    }
  }

  // 如果包含视频（暂不考虑，但保留验证逻辑）
  if (content.video) {
    // 视频验证逻辑（待实现）
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * 格式化内容为微信格式
 */
export function formatWechatContent(content: PublishContent): string {
  let text = content.text

  // 移除多余的空格和换行
  text = text.replace(/\s+/g, ' ').trim()

  // 如果包含 URL，确保格式正确
  if (content.url) {
    // URL 处理逻辑（如果需要）
  }

  return text
}

/**
 * 检查 Token 是否过期
 */
export function isTokenExpired(tokenExpiry?: Date): boolean {
  if (!tokenExpiry) {
    return true // 没有过期时间视为已过期
  }

  // 提前 5 分钟视为过期（避免边界情况）
  const bufferTime = 5 * 60 * 1000 // 5 分钟
  return Date.now() >= tokenExpiry.getTime() - bufferTime
}

/**
 * 计算 Token 过期时间
 */
export function calculateTokenExpiry(expiresIn: number): Date {
  return new Date(Date.now() + expiresIn * 1000)
}
