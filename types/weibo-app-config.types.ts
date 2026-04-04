/**
 * 微博应用配置（用户维度）— 请求/响应类型，不含明文 secret 出参。
 */

export interface WeiboAppConfigCreateInput {
  appId: string
  appSecret: string
  appName?: string
  /** 完整 OAuth 回调 URL，须与微博开放平台配置一致 */
  callbackUrl: string
}

export interface WeiboAppConfigUpdateInput {
  appId?: string
  appSecret?: string
  appName?: string
  callbackUrl?: string
  isActive?: boolean
}

export interface WeiboAppConfigPublic {
  id: string
  userId: string
  appId: string
  appName: string | null
  callbackUrl: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}
