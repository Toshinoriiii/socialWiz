/**
 * 微信公众号配置管理服务
 * Feature: 005-wechat-integration
 */

import { prisma } from '../db/prisma'
import { redis } from '../db/redis'
import { encrypt, decrypt } from '../utils/encryption'
import { wechatApiClient } from '../platforms/wechat/wechat-client'
import { getTokenCacheKey } from '../platforms/wechat/wechat-utils'
import { wechatTokenService } from './wechat-token.service'

/**
 * 创建配置请求
 */
export interface CreateConfigRequest {
  userId: string
  appId: string
  appSecret: string
  accountName?: string
  subjectType?: 'personal' | 'enterprise'
}

/**
 * 更新配置请求
 */
export interface UpdateConfigRequest {
  appSecret?: string
  accountName?: string
  isActive?: boolean
}

/**
 * 配置响应（不包含敏感信息）
 */
export interface ConfigResponse {
  id: string
  userId: string
  appId: string
  accountName: string | null
  accountType: string | null
  subjectType: string | null
  canPublish: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * 微信配置服务类
 */
export class WechatConfigService {
  /**
   * 创建配置（验证、加密、保存）
   */
  async createConfig(request: CreateConfigRequest): Promise<ConfigResponse> {
    const { userId, appId, appSecret, accountName, subjectType } = request

    // 检查是否已存在相同的配置
    const existing = await (prisma as any).wechatAccountConfig.findUnique({
      where: {
        userId_appId: {
          userId,
          appId
        }
      }
    })

    if (existing) {
      throw new Error('该AppID的配置已存在')
    }

    // 验证AppID和AppSecret（调用微信API）
    try {
      const tokenResponse = await wechatApiClient.getAccessToken(appId, appSecret)
      
      if (!tokenResponse.access_token) {
        throw new Error('微信API返回无效的access_token')
      }

      // 加密AppSecret
      const encryptedSecret = encrypt(appSecret)

      // 根据主体类型设置canPublish
      const canPublish = subjectType === 'enterprise'

      // 创建配置
      const config = await (prisma as any).wechatAccountConfig.create({
        data: {
          userId,
          appId,
          appSecret: encryptedSecret,
          accountName: accountName || null,
          subjectType: subjectType || null,
          canPublish,
          isActive: true
        }
      })

      return this.toConfigResponse(config)
    } catch (error) {
      if (error instanceof Error) {
        // 提取微信错误码
        const errorMessage = error.message
        if (errorMessage.includes('[40001]')) {
          throw new Error('AppID或AppSecret错误，请检查配置')
        } else if (errorMessage.includes('[40164]')) {
          throw new Error('IP白名单未配置，请在微信公众平台添加服务器IP')
        }
        throw new Error(`配置验证失败: ${errorMessage}`)
      }
      throw error
    }
  }

  /**
   * 获取用户的所有配置
   */
  async getConfigsByUserId(userId: string): Promise<ConfigResponse[]> {
    const configs = await (prisma as any).wechatAccountConfig.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })

    return configs.map((config: any) => this.toConfigResponse(config))
  }

  /**
   * 获取单个配置
   */
  async getConfigById(configId: string, userId: string): Promise<ConfigResponse | null> {
    const config = await (prisma as any).wechatAccountConfig.findFirst({
      where: {
        id: configId,
        userId // 确保用户只能访问自己的配置
      }
    })

    if (!config) {
      return null
    }

    return this.toConfigResponse(config)
  }

  /**
   * 获取配置（包含解密的AppSecret）- 仅内部使用
   */
  async getConfigWithSecret(configId: string, userId: string): Promise<{
    config: any
    appSecret: string
  } | null> {
    const config = await (prisma as any).wechatAccountConfig.findFirst({
      where: {
        id: configId,
        userId
      }
    })

    if (!config) {
      return null
    }

    // 解密AppSecret
    const appSecret = decrypt(config.appSecret)

    return {
      config,
      appSecret
    }
  }

  /**
   * 更新配置
   */
  async updateConfig(
    configId: string,
    userId: string,
    request: UpdateConfigRequest
  ): Promise<ConfigResponse> {
    // 检查配置是否存在且属于当前用户
    const existing = await (prisma as any).wechatAccountConfig.findFirst({
      where: {
        id: configId,
        userId
      }
    })

    if (!existing) {
      throw new Error('配置不存在或无权访问')
    }

    const updateData: any = {}

    // 如果更新AppSecret，需要加密并验证
    if (request.appSecret) {
      // 验证新的AppSecret
      try {
        await wechatApiClient.getAccessToken(existing.appId, request.appSecret)
        updateData.appSecret = encrypt(request.appSecret)
        
        // 清除旧的token缓存
        await this.clearTokenCache(userId, configId)
      } catch (error) {
        throw new Error('新的AppSecret验证失败')
      }
    }

    if (request.accountName !== undefined) {
      updateData.accountName = request.accountName
    }

    if (request.isActive !== undefined) {
      updateData.isActive = request.isActive
    }

    const updated = await (prisma as any).wechatAccountConfig.update({
      where: { id: configId },
      data: updateData
    })

    return this.toConfigResponse(updated)
  }

  /**
   * 删除配置（并清除Redis缓存）
   */
  async deleteConfig(configId: string, userId: string): Promise<void> {
    // 检查配置是否存在且属于当前用户
    const existing = await (prisma as any).wechatAccountConfig.findFirst({
      where: {
        id: configId,
        userId
      }
    })

    if (!existing) {
      throw new Error('配置不存在或无权访问')
    }

    // 清除token缓存（使用TokenService）
    await wechatTokenService.deleteToken(userId, configId)

    // 删除配置（级联删除关联的ContentPlatform记录）
    await (prisma as any).wechatAccountConfig.delete({
      where: { id: configId }
    })
  }

  /**
   * 清除Token缓存
   */
  private async clearTokenCache(userId: string, configId: string): Promise<void> {
    if (!redis) {
      return
    }

    const tokenKey = getTokenCacheKey(userId, configId)
    try {
      await redis.del(tokenKey)
    } catch (error) {
      console.error('Failed to clear token cache:', error)
    }
  }

  /**
   * 转换为响应对象（隐藏敏感信息）
   */
  private toConfigResponse(config: any): ConfigResponse {
    return {
      id: config.id,
      userId: config.userId,
      appId: config.appId,
      accountName: config.accountName,
      accountType: config.accountType,
      subjectType: config.subjectType,
      canPublish: config.canPublish,
      isActive: config.isActive,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    }
  }
}

/**
 * 导出单例实例
 */
export const wechatConfigService = new WechatConfigService()
