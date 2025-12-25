import { Platform } from '@/types/platform.types'
import {
  WechatOutlined,
  WeiboOutlined
} from '@ant-design/icons'

export interface PlatformInfo {
  id: Platform
  name: string
  color: string
  icon: any
  limits: {
    maxTextLength: number
    maxImages: number
    supportsVideo: boolean
    supportsRichText: boolean
  }
  oauth: {
    authUrl: string
    tokenUrl: string
    scope: string
  }
}

export const PLATFORM_CONFIGS: Record<Platform, PlatformInfo> = {
  [Platform.WECHAT]: {
    id: Platform.WECHAT,
    name: '微信公众号',
    color: 'bg-green-500',
    icon: WechatOutlined,
    limits: {
      maxTextLength: 10000,
      maxImages: 8,
      supportsVideo: true,
      supportsRichText: true
    },
    oauth: {
      authUrl: 'https://open.weixin.qq.com/connect/oauth2/authorize',
      tokenUrl: 'https://api.weixin.qq.com/sns/oauth2/access_token',
      scope: 'snsapi_userinfo'
    }
  },
  [Platform.WEIBO]: {
    id: Platform.WEIBO,
    name: '微博',
    color: 'bg-red-500',
    icon: WeiboOutlined,
    limits: {
      maxTextLength: 2000,
      maxImages: 9,
      supportsVideo: true,
      supportsRichText: false
    },
    oauth: {
      authUrl: 'https://api.weibo.com/oauth2/authorize',
      tokenUrl: 'https://api.weibo.com/oauth2/access_token',
      scope: 'all'
    }
  },
  [Platform.DOUYIN]: {
    id: Platform.DOUYIN,
    name: '抖音',
    color: 'bg-purple-500',
    icon: WechatOutlined, // 暂用微信图标
    limits: {
      maxTextLength: 2000,
      maxImages: 9,
      supportsVideo: true,
      supportsRichText: false
    },
    oauth: {
      authUrl: 'https://open.douyin.com/platform/oauth/connect',
      tokenUrl: 'https://open.douyin.com/oauth/access_token',
      scope: 'user_info,video.create'
    }
  },
  [Platform.XIAOHONGSHU]: {
    id: Platform.XIAOHONGSHU,
    name: '小红书',
    color: 'bg-pink-500',
    icon: WechatOutlined, // 暂用微信图标
    limits: {
      maxTextLength: 1000,
      maxImages: 9,
      supportsVideo: true,
      supportsRichText: false
    },
    oauth: {
      authUrl: 'https://open.xiaohongshu.com/oauth/authorize',
      tokenUrl: 'https://open.xiaohongshu.com/oauth/token',
      scope: 'base,publish'
    }
  }
}

export const getPlatformConfig = (platform: Platform): PlatformInfo => {
  return PLATFORM_CONFIGS[platform]
}

export const validateContent = (platform: Platform, content: string, images: string[]): { valid: boolean; errors: string[] } => {
  const config = getPlatformConfig(platform)
  const errors: string[] = []

  if (content.length > config.limits.maxTextLength) {
    errors.push(`内容超过${config.name}的字数限制(${config.limits.maxTextLength}字)`)
  }

  if (images.length > config.limits.maxImages) {
    errors.push(`图片数量超过${config.name}的限制(${config.limits.maxImages}张)`)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
