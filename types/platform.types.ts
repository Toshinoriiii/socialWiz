import type { ReactNode } from 'react'

export enum Platform {
  WECHAT = 'WECHAT',
  WEIBO = 'WEIBO',
  DOUYIN = 'DOUYIN',
  XIAOHONGSHU = 'XIAOHONGSHU'
}

/** mp 浏览器 Playwright 绑定账号的 `platformUserId` 前缀（与 session-files 一致） */
export const WECHAT_PLAYWRIGHT_PLATFORM_USER_ID_PREFIX =
  'wechat_playwright:' as const

export function isWechatPlaywrightPlatformUserId (
  platformUserId: string | undefined | null
): boolean {
  if (!platformUserId) return false
  return platformUserId.startsWith(WECHAT_PLAYWRIGHT_PLATFORM_USER_ID_PREFIX)
}

export interface PlatformAccount {
  id: string
  userId: string
  platform: Platform
  platformUserId: string
  platformUsername: string
  accessToken: string
  refreshToken?: string
  tokenExpiry?: Date
  isConnected: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PlatformAccountInfo {
  id: string
  platform: Platform
  platformUsername: string
  isConnected: boolean
  createdAt: Date
}

export interface OAuthCallbackParams {
  code: string
  state: string
  platform: Platform
}

export interface PlatformConfig {
  name: string
  icon: ReactNode
  color: string
  connected: boolean
}

export interface PlatformLimits {
  maxTextLength: number
  maxImages: number
  supportsVideo: boolean
  supportsRichText: boolean
}
