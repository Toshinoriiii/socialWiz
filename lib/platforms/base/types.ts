/**
 * 平台适配器基础类型定义
 * 用于统一不同平台的接口规范
 */

import { Platform } from '@/types/platform.types'

/**
 * OAuth 授权配置
 */
export interface AuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  scope?: string
  state?: string
}

/**
 * Token 信息
 */
export interface TokenInfo {
  accessToken: string
  refreshToken?: string
  expiresIn: number // 过期时间（秒）
  tokenType?: string
  scope?: string
}

/**
 * 发布内容
 */
export interface PublishContent {
  text: string
  images?: string[]
  video?: string
  url?: string
}

/**
 * 发布结果
 */
export interface PublishResult {
  success: boolean
  platformPostId?: string
  publishedUrl?: string
  error?: string
  errorCode?: string
}

/**
 * 用户信息
 */
export interface UserInfo {
  id: string
  username: string
  name: string
  avatar?: string
  [key: string]: any // 允许平台特定的额外字段
}

/**
 * 内容验证结果
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * 数据查询选项
 */
export interface DataQueryOptions {
  limit?: number
  offset?: number
  sinceId?: string
  maxId?: string
  [key: string]: any
}

/**
 * 内容数据
 */
export interface ContentData {
  id: string
  text: string
  createdAt: Date
  [key: string]: any
}
