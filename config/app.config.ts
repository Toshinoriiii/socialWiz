export const APP_CONFIG = {
  name: 'SocialWiz',
  description: '多智能体社交媒体统一管理平台',
  version: '1.0.0',
  author: '',
  
  // 分页配置
  pagination: {
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50, 100]
  },
  
  // 文件上传配置
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedVideoTypes: ['video/mp4', 'video/mpeg'],
    maxImages: 9
  },
  
  // 草稿自动保存配置
  autosave: {
    enabled: true,
    intervalSeconds: 30,
    localStorageKey: 'socialwiz_draft'
  },
  
  // JWT配置
  jwt: {
    expiresIn: '7d',
    refreshExpiresIn: '30d'
  },
  
  // Redis缓存配置
  cache: {
    userInfoTTL: 300, // 5分钟
    platformAccountTTL: 600, // 10分钟
    analyticsTTL: 3600 // 1小时
  },
  
  // 任务队列配置
  queue: {
    publishQueue: 'publish-queue',
    maxRetries: 3,
    retryDelays: [60000, 300000, 900000] // 1分钟、5分钟、15分钟
  },
  
  // 数据同步配置
  sync: {
    analyticsIntervalHours: 1,
    platformDataBatchSize: 100
  },
  
  // 速率限制配置
  rateLimit: {
    loginAttempts: 5,
    loginBlockDurationMinutes: 30,
    aiCallsPerDay: 100,
    publishPerHour: 20
  }
}

export const getConfig = (key: string) => {
  const keys = key.split('.')
  let value: any = APP_CONFIG
  
  for (const k of keys) {
    value = value[k]
    if (value === undefined) break
  }
  
  return value
}
export const APP_CONFIG = {
  name: 'SocialWiz',
  description: '多智能体社交媒体统一管理平台',
  version: '1.0.0',
  author: '',
  
  // 分页配置
  pagination: {
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50, 100]
  },
  
  // 文件上传配置
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedVideoTypes: ['video/mp4', 'video/mpeg'],
    maxImages: 9
  },
  
  // 草稿自动保存配置
  autosave: {
    enabled: true,
    intervalSeconds: 30,
    localStorageKey: 'socialwiz_draft'
  },
  
  // JWT配置
  jwt: {
    expiresIn: '7d',
    refreshExpiresIn: '30d'
  },
  
  // Redis缓存配置
  cache: {
    userInfoTTL: 300, // 5分钟
    platformAccountTTL: 600, // 10分钟
    analyticsTTL: 3600 // 1小时
  },
  
  // 任务队列配置
  queue: {
    publishQueue: 'publish-queue',
    maxRetries: 3,
    retryDelays: [60000, 300000, 900000] // 1分钟、5分钟、15分钟
  },
  
  // 数据同步配置
  sync: {
    analyticsIntervalHours: 1,
    platformDataBatchSize: 100
  },
  
  // 速率限制配置
  rateLimit: {
    loginAttempts: 5,
    loginBlockDurationMinutes: 30,
    aiCallsPerDay: 100,
    publishPerHour: 20
  }
}

export const getConfig = (key: string) => {
  const keys = key.split('.')
  let value: any = APP_CONFIG
  
  for (const k of keys) {
    value = value[k]
    if (value === undefined) break
  }
  
  return value
}
