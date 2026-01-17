/**
 * 分布式锁工具模块
 * Feature: 005-wechat-integration
 * Implementation: Redis SETNX + TTL
 */

import { redis } from '../db/redis'

/**
 * 锁配置选项
 */
export interface LockOptions {
  /**
   * 锁的TTL（毫秒），默认30秒
   */
  ttl?: number
  
  /**
   * 获取锁的重试次数，默认3次
   */
  retryCount?: number
  
  /**
   * 重试间隔（毫秒），默认100ms
   */
  retryDelay?: number
}

/**
 * 锁结果
 */
export interface LockResult {
  /**
   * 是否成功获取锁
   */
  acquired: boolean
  
  /**
   * 锁的唯一标识（用于释放锁）
   */
  lockValue?: string
  
  /**
   * 错误信息（如果获取失败）
   */
  error?: string
}

// 默认配置
const DEFAULT_TTL = 30000 // 30秒
const DEFAULT_RETRY_COUNT = 3
const DEFAULT_RETRY_DELAY = 100 // 100ms

/**
 * 生成随机锁值
 */
function generateLockValue(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 获取分布式锁
 * @param key 锁的key
 * @param options 锁配置选项
 * @returns 锁结果
 */
export async function acquireLock(
  key: string,
  options: LockOptions = {}
): Promise<LockResult> {
  const {
    ttl = DEFAULT_TTL,
    retryCount = DEFAULT_RETRY_COUNT,
    retryDelay = DEFAULT_RETRY_DELAY
  } = options
  
  if (!redis) {
    return {
      acquired: false,
      error: 'Redis client is not available'
    }
  }
  
  const lockValue = generateLockValue()
  
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      // 使用SET NX PX命令：只有key不存在时才设置，并设置过期时间
      const result = await redis.set(key, lockValue, 'PX', ttl, 'NX')
      
      if (result === 'OK') {
        return {
          acquired: true,
          lockValue
        }
      }
      
      // 如果这不是最后一次尝试，等待后重试
      if (attempt < retryCount) {
        await delay(retryDelay)
      }
    } catch (error) {
      return {
        acquired: false,
        error: `Failed to acquire lock: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }
  
  return {
    acquired: false,
    error: `Failed to acquire lock after ${retryCount + 1} attempts`
  }
}

/**
 * 释放分布式锁
 * @param key 锁的key
 * @param lockValue 锁的唯一标识（必须匹配才能释放）
 * @returns 是否成功释放
 */
export async function releaseLock(
  key: string,
  lockValue: string
): Promise<boolean> {
  if (!redis) {
    console.error('Redis client is not available')
    return false
  }
  
  try {
    // 使用Lua脚本确保原子性：只有lockValue匹配时才删除
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `
    
    const result = await redis.eval(
      luaScript,
      1,
      key,
      lockValue
    ) as number
    
    return result === 1
  } catch (error) {
    console.error(`Failed to release lock ${key}:`, error)
    return false
  }
}

/**
 * 检查锁是否存在
 * @param key 锁的key
 * @returns 是否存在
 */
export async function isLocked(key: string): Promise<boolean> {
  if (!redis) {
    return false
  }
  
  try {
    const exists = await redis.exists(key)
    return exists === 1
  } catch (error) {
    console.error(`Failed to check lock ${key}:`, error)
    return false
  }
}

/**
 * 获取锁的剩余TTL
 * @param key 锁的key
 * @returns 剩余TTL（毫秒），-1表示无过期时间，-2表示key不存在
 */
export async function getLockTTL(key: string): Promise<number> {
  if (!redis) {
    return -2
  }
  
  try {
    const ttl = await redis.pttl(key)
    return ttl
  } catch (error) {
    console.error(`Failed to get lock TTL ${key}:`, error)
    return -2
  }
}

/**
 * 使用锁执行函数（自动获取和释放锁）
 * @param key 锁的key
 * @param fn 要执行的函数
 * @param options 锁配置选项
 * @returns 函数执行结果
 */
export async function withLock<T>(
  key: string,
  fn: () => Promise<T>,
  options: LockOptions = {}
): Promise<T> {
  const lockResult = await acquireLock(key, options)
  
  if (!lockResult.acquired) {
    throw new Error(lockResult.error || 'Failed to acquire lock')
  }
  
  try {
    return await fn()
  } finally {
    // 确保释放锁
    if (lockResult.lockValue) {
      await releaseLock(key, lockResult.lockValue)
    }
  }
}
