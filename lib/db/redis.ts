import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined
  redisConnected: boolean
}

let redisConnected = false

const getRedisClient = (): Redis | null => {
  // 如果 Redis 未连接，返回 null（使用降级方案）
  if (globalForRedis.redisConnected === false) {
    return null
  }

  if (globalForRedis.redis) {
    return globalForRedis.redis
  }

  try {
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          // 超过3次重试后，标记为未连接
          globalForRedis.redisConnected = false
          console.warn('Redis 连接失败，将使用降级方案（直接查询数据库）')
          return null // 停止重试
        }
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      enableOfflineQueue: false, // 禁用离线队列，失败时立即返回错误
      lazyConnect: false
    })

    redis.on('error', (err) => {
      console.error('Redis Client Error:', err.message)
      globalForRedis.redisConnected = false
    })

    redis.on('connect', () => {
      console.log('Redis Client Connected')
      globalForRedis.redisConnected = true
    })

    redis.on('ready', () => {
      globalForRedis.redisConnected = true
    })

    redis.on('close', () => {
      globalForRedis.redisConnected = false
    })

    // 测试连接
    redis.ping().catch(() => {
      globalForRedis.redisConnected = false
      console.warn('Redis 连接测试失败，将使用降级方案')
    })

    if (process.env.NODE_ENV !== 'production') {
      globalForRedis.redis = redis
    }

    globalForRedis.redisConnected = true
    return redis
  } catch (error) {
    console.warn('Redis 初始化失败，将使用降级方案:', error)
    globalForRedis.redisConnected = false
    return null
  }
}

export const redis = getRedisClient()

// 缓存助手函数
export const cacheHelper = {
  // 设置缓存
  async set (key: string, value: any, ttl?: number): Promise<void> {
    const data = JSON.stringify(value)
    if (ttl) {
      await redis.setex(key, ttl, data)
    } else {
      await redis.set(key, data)
    }
  },

  // 获取缓存
  async get<T> (key: string): Promise<T | null> {
    const data = await redis.get(key)
    if (!data) return null
    try {
      return JSON.parse(data) as T
    } catch {
      return null
    }
  },

  // 删除缓存
  async del (key: string): Promise<void> {
    await redis.del(key)
  },

  // 批量删除
  async delPattern (pattern: string): Promise<void> {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  },

  // 检查缓存是否存在
  async exists (key: string): Promise<boolean> {
    return (await redis.exists(key)) === 1
  },

  // 设置过期时间
  async expire (key: string, ttl: number): Promise<void> {
    await redis.expire(key, ttl)
  }
}

export default redis
