export enum Platform {
  WECHAT = 'WECHAT',
  WEIBO = 'WEIBO',
  DOUYIN = 'DOUYIN',
  XIAOHONGSHU = 'XIAOHONGSHU'
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
  icon: React.ReactNode
  color: string
  connected: boolean
}

export interface PlatformLimits {
  maxTextLength: number
  maxImages: number
  supportsVideo: boolean
  supportsRichText: boolean
}
export enum Platform {
  WECHAT = 'WECHAT',
  WEIBO = 'WEIBO',
  DOUYIN = 'DOUYIN',
  XIAOHONGSHU = 'XIAOHONGSHU'
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
  icon: React.ReactNode
  color: string
  connected: boolean
}

export interface PlatformLimits {
  maxTextLength: number
  maxImages: number
  supportsVideo: boolean
  supportsRichText: boolean
}
