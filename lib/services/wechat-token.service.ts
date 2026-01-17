/**
 * 微信公众号Access Token自动管理服务
 * Feature: 005-wechat-integration
 * 
 * 功能：
 * - 自动获取access_token
 * - Redis缓存，TTL 7000秒
 * - 剩余有效期<300秒时自动刷新
 * - 分布式锁防止并发获取
 * - 透明代理模式，前端无需关心token
 */

import { prisma } from '../db/prisma'
import { redis } from '../db/redis'
import { acquireLock, releaseLock } from '../utils/distributed-lock'
import { decrypt } from '../utils/encryption'
import { wechatApiClient } from '../platforms/wechat/wechat-client'
import { getTokenCacheKey, shouldRefreshToken } from '../platforms/wechat/wechat-utils'
import {
  WECHAT_TOKEN_CACHE_TTL,
  WECHAT_TOKEN_REFRESH_THRESHOLD,
  WECHAT_LOCK_KEY_PREFIX,
  WECHAT_LOCK_TTL
} from '../platforms/wechat/wechat-types'

/**
 * Token缓存数据结构
 */
export interface CachedTokenData {
  accessToken: string
  expiresAt: number  // 毫秒时间戳
  fetchedAt: number  // 获取时间
}

/**
 * 微信Token服务类
 */
export class WechatTokenService {
  /**
   * 获取或刷新Token（主入口方法）
   * 
   * @param userId 用户ID
   * @param configId 配置ID
   * @returns access_token
   */
  async getOrRefreshToken(userId: string, configId: string): Promise<string> {
    // 1. 尝试从缓存获取
    const cachedToken = await this.getCachedToken(userId, configId)
    
    if (cachedToken) {
      // 检查是否需要刷新
      if (!shouldRefreshToken(cachedToken.expiresAt, WECHAT_TOKEN_REFRESH_THRESHOLD)) {
        return cachedToken.accessToken
      }
      
      console.log(`[Token] Token即将过期，准备刷新 userId=${userId} configId=${configId}`)
    }

    // 2. 需要获取新token，使用分布式锁
    return await this.fetchWithLock(userId, configId)
  }

  /**
   * 使用分布式锁获取Token
   * 防止并发请求导致多次调用微信API
   */
  private async fetchWithLock(userId: string, configId: string): Promise<string> {
    const lockKey = `${WECHAT_LOCK_KEY_PREFIX}${userId}:${configId}`
    
    // 尝试获取锁
    const lockResult = await acquireLock(lockKey, {
      ttl: WECHAT_LOCK_TTL,
      retryCount: 3,
      retryDelay: 100
    })

    if (!lockResult.acquired) {
      // 获取锁失败，可能其他进程正在获取token
      // 等待一小段时间后重新从缓存读取
      await this.delay(200)
      const cachedToken = await this.getCachedToken(userId, configId)
      if (cachedToken) {
        return cachedToken.accessToken
      }
      throw new Error('获取Token失败：无法获取分布式锁')
    }

    try {
      // 双重检查：获取锁后再次检查缓存
      const cachedToken = await this.getCachedToken(userId, configId)
      if (cachedToken && !shouldRefreshToken(cachedToken.expiresAt, WECHAT_TOKEN_REFRESH_THRESHOLD)) {
        return cachedToken.accessToken
      }

      // 从微信API获取新token
      const tokenData = await this.fetchAccessToken(userId, configId)
      
      // 缓存token
      await this.cacheToken(userId, configId, tokenData)
      
      return tokenData.accessToken
    } finally {
      // 释放锁
      if (lockResult.lockValue) {
        await releaseLock(lockKey, lockResult.lockValue)
      }
    }
  }

  /**
   * 从微信API获取access_token
   */
  async fetchAccessToken(userId: string, configId: string): Promise<CachedTokenData> {
    // 1. 查询配置
    const config = await (prisma as any).wechatAccountConfig.findFirst({
      where: {
        id: configId,
        userId,
        isActive: true
      }
    })

    if (!config) {
      throw new Error('微信配置不存在或已禁用')
    }

    // 2. 解密AppSecret
    const appSecret = decrypt(config.appSecret)

    // 3. 调用微信API
    console.log(`[Token] 调用微信API获取token userId=${userId} configId=${configId}`)
    const response = await wechatApiClient.getAccessToken(config.appId, appSecret)

    if (!response.access_token) {
      throw new Error('微信API返回无效的access_token')
    }

    // 4. 构造缓存数据
    const now = Date.now()
    const expiresIn = response.expires_in || 7200  // 默认7200秒
    
    return {
      accessToken: response.access_token,
      expiresAt: now + (expiresIn * 1000),
      fetchedAt: now
    }
  }

  /**
   * 缓存Token到Redis
   */
  async cacheToken(userId: string, configId: string, tokenData: CachedTokenData): Promise<void> {
    if (!redis) {
      console.warn('[Token] Redis不可用，跳过缓存')
      return
    }

    const cacheKey = getTokenCacheKey(userId, configId)
    
    try {
      // 使用WECHAT_TOKEN_CACHE_TTL（7000秒）作为Redis过期时间
      await redis.setex(cacheKey, WECHAT_TOKEN_CACHE_TTL, JSON.stringify(tokenData))
      console.log(`[Token] Token已缓存 key=${cacheKey} expiresIn=${WECHAT_TOKEN_CACHE_TTL}s`)
    } catch (error) {
      console.error('[Token] 缓存Token失败:', error)
      // 不抛出错误，允许继续使用token
    }
  }

  /**
   * 从Redis获取缓存的Token
   */
  async getCachedToken(userId: string, configId: string): Promise<CachedTokenData | null> {
    if (!redis) {
      return null
    }

    const cacheKey = getTokenCacheKey(userId, configId)
    
    try {
      const cached = await redis.get(cacheKey)
      if (!cached) {
        return null
      }

      const tokenData: CachedTokenData = JSON.parse(cached)
      
      // 验证数据完整性
      if (!tokenData.accessToken || !tokenData.expiresAt) {
        console.warn('[Token] 缓存数据格式错误，删除缓存')
        await redis.del(cacheKey)
        return null
      }

      // 检查是否已过期
      if (Date.now() >= tokenData.expiresAt) {
        console.log('[Token] 缓存的token已过期')
        await redis.del(cacheKey)
        return null
      }

      return tokenData
    } catch (error) {
      console.error('[Token] 读取缓存失败:', error)
      return null
    }
  }

  /**
   * 删除Token缓存（配置删除时调用）
   */
  async deleteToken(userId: string, configId: string): Promise<void> {
    if (!redis) {
      return
    }

    const cacheKey = getTokenCacheKey(userId, configId)
    
    try {
      await redis.del(cacheKey)
      console.log(`[Token] Token缓存已删除 key=${cacheKey}`)
    } catch (error) {
      console.error('[Token] 删除Token缓存失败:', error)
    }
  }

  /**
   * 检查Token是否需要刷新
   * （已移至wechat-utils.ts，这里提供封装版本）
   */
  shouldRefreshToken(expiresAt: number, thresholdSeconds: number = WECHAT_TOKEN_REFRESH_THRESHOLD): boolean {
    return shouldRefreshToken(expiresAt, thresholdSeconds)
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * 导出单例实例
 */
export const wechatTokenService = new WechatTokenService()
