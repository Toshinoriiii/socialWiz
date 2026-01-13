/**
 * 微博工具函数
 * 内容验证、格式转换等工具函数
 */

import type { PublishContent, ValidationResult } from '../base/types'

/**
 * 验证微博内容
 */
export function validateWeiboContent(content: PublishContent): ValidationResult {
  const errors: string[] = []

  // 验证文字长度（纯文字2000字）
  if (content.text.length > 2000) {
    errors.push(`文字内容超过2000字限制（当前: ${content.text.length}字）`)
  }

  // 验证文字不能为空
  if (!content.text || content.text.trim().length === 0) {
    errors.push('文字内容不能为空')
  }

  // 如果包含图片（暂不考虑，但保留验证逻辑）
  if (content.images && content.images.length > 0) {
    if (content.images.length > 9) {
      errors.push(`图片数量超过9张限制（当前: ${content.images.length}张）`)
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
 * 格式化内容为微博格式
 */
export function formatWeiboContent(content: PublishContent): string {
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
