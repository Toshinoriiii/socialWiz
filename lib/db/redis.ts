import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined
}

const getRedisClient = (): Redis => {
  if (globalForRedis.redis) {
    return globalForRedis.redis
  }

  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000)
      return delay
    }
  })

  redis.on('error', (err) => {
    console.error('Redis Client Error:', err)
  })

  redis.on('connect', () => {
    console.log('Redis Client Connected')
  })

  if (process.env.NODE_ENV !== 'production') {
    globalForRedis.redis = redis
  }

  return redis
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
