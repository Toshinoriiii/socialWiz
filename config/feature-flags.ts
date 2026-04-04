/**
 * Client-safe flags (must use NEXT_PUBLIC_* for use in 'use client' components).
 */
export function isWeiboOauthUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_WEIBO_OAUTH_UI === 'true'
}
