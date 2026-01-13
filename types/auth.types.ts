import type { UserProfile } from './user.types'

/**
 * Token 验证请求
 */
export interface VerifyTokenRequest {
  token: string
}

/**
 * Token 验证响应（成功）
 */
export interface VerifyTokenSuccessResponse {
  valid: true
  user: UserProfile
}

/**
 * Token 验证响应（失败）
 */
export interface VerifyTokenErrorResponse {
  valid: false
  error: string
}

/**
 * Token 验证响应（联合类型）
 */
export type VerifyTokenResponse = VerifyTokenSuccessResponse | VerifyTokenErrorResponse
