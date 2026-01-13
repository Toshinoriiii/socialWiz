/**
 * OAuth State 管理工具
 * 用于生成和验证 OAuth state 参数，防止 CSRF 攻击
 */

import { randomBytes } from 'crypto'
import { cacheHelper } from '@/lib/db/redis'

const STATE_EXPIRY = 600 // 10 分钟

export interface OAuthState {
  userId: string
  redirectUri?: string
  platform: string
  createdAt: number
}

/**
 * 生成 OAuth state 参数
 */
export function generateOAuthState(userId: string, platform: string, redirectUri?: string): string {
  const state = randomBytes(32).toString('hex')
  const stateData: OAuthState = {
    userId,
    platform,
    redirectUri,
    createdAt: Date.now()
  }

  // 保存到 Redis，10 分钟过期
  const key = `oauth:${platform}:${state}`
  cacheHelper.set(key, stateData, STATE_EXPIRY).catch((err) => {
    console.error('Failed to save OAuth state:', err)
  })

  return state
}

/**
 * 验证并获取 OAuth state
 */
export async function validateOAuthState(
  state: string,
  platform: string
): Promise<OAuthState | null> {
  const key = `oauth:${platform}:${state}`
  const stateData = await cacheHelper.get<OAuthState>(key)

  if (!stateData) {
    return null
  }

  // 验证平台匹配
  if (stateData.platform !== platform) {
    return null
  }

  // 验证是否过期（双重检查）
  const now = Date.now()
  if (now - stateData.createdAt > STATE_EXPIRY * 1000) {
    // 已过期，删除
    await cacheHelper.del(key)
    return null
  }

  // 验证成功后删除 state（一次性使用）
  await cacheHelper.del(key)

  return stateData
}

/**
 * 删除 OAuth state（清理）
 */
export async function deleteOAuthState(state: string, platform: string): Promise<void> {
  const key = `oauth:${platform}:${state}`
  await cacheHelper.del(key)
}
