/**
 * 平台发布配置管理服务
 * Feature: 006-platform-publish-config
 * 
 * 提供配置的CRUD操作、权限校验和数据验证
 */

import { prisma } from '@/lib/db/prisma'
import { Platform } from '@/types/platform.types'
import type {
  PlatformPublishConfig,
  CreateConfigInput,
  UpdateConfigInput,
  GetConfigsParams,
  PlatformConfigData
} from '@/types/platform-config.types'
import { validateConfigData } from '@/lib/validators/platform-config.validator'

export class PlatformConfigService {
  /**
   * 获取用户的所有配置
   * @param userId 用户ID
   * @param params 查询参数(可选的平台过滤和默认配置过滤)
   */
  static async getUserConfigs(
    userId: string,
    params?: GetConfigsParams
  ): Promise<PlatformPublishConfig[]> {
    const configs = await prisma.platformPublishConfig.findMany({
      where: {
        userId,
        ...(params?.platform && { platform: params.platform }),
        ...(params?.isDefault !== undefined && { isDefault: params.isDefault })
      },
      orderBy: [
        { isDefault: 'desc' }, // 默认配置排在前面
        { usageCount: 'desc' }, // 使用次数多的排前面
        { updatedAt: 'desc' } // 最近更新的排前面
      ]
    })

    return configs as PlatformPublishConfig[]
  }

  /**
   * 根据ID获取单个配置
   * @param configId 配置ID
   * @param userId 用户ID(用于权限校验)
   */
  static async getConfigById(
    configId: string,
    userId: string
  ): Promise<PlatformPublishConfig | null> {
    const config = await prisma.platformPublishConfig.findFirst({
      where: {
        id: configId,
        userId // 确保用户只能访问自己的配置
      }
    })

    return config as PlatformPublishConfig | null
  }

  /**
   * 创建新配置
   * @param userId 用户ID
   * @param input 配置输入
   */
  static async createConfig(
    userId: string,
    input: CreateConfigInput
  ): Promise<PlatformPublishConfig> {
    try {
      // 1. 验证配置数据格式
      const validation = validateConfigData(input.platform, input.configData)
      if (!validation.success) {
        throw new Error(`配置数据验证失败: ${validation.error}`)
      }

      // 2. 检查配置名称唯一性(同一用户+同一平台下唯一)
      const existingConfig = await prisma.platformPublishConfig.findFirst({
        where: {
          userId,
          platform: input.platform,
          configName: input.configName
        }
      })

      if (existingConfig) {
        throw new Error(`配置名称"${input.configName}"已存在于该平台`)
      }

      // 3. 创建配置
      const config = await prisma.platformPublishConfig.create({
        data: {
          userId,
          platform: input.platform,
          configName: input.configName,
          description: input.description,
          configData: validation.data as any,
          isDefault: false,
          usageCount: 0
        }
      })

      return config as PlatformPublishConfig
    } catch (error) {
      console.error('PlatformConfigService.createConfig error:', error)
      if (error instanceof Error && error.message.includes('prisma')) {
        throw new Error('数据库连接失败,请确保已执行: npx prisma generate')
      }
      throw error
    }
  }

  /**
   * 更新配置
   * @param configId 配置ID
   * @param userId 用户ID(用于权限校验)
   * @param input 更新输入
   */
  static async updateConfig(
    configId: string,
    userId: string,
    input: UpdateConfigInput
  ): Promise<PlatformPublishConfig> {
    // 1. 检查配置是否存在且属于当前用户
    const existingConfig = await this.getConfigById(configId, userId)
    if (!existingConfig) {
      throw new Error('配置不存在或无权访问')
    }

    // 2. 如果更新configData,进行验证
    if (input.configData) {
      const validation = validateConfigData(
        existingConfig.platform,
        input.configData
      )
      if (!validation.success) {
        throw new Error(`配置数据验证失败: ${validation.error}`)
      }
    }

    // 3. 如果更新配置名称,检查唯一性
    if (input.configName && input.configName !== existingConfig.configName) {
      const duplicateConfig = await prisma.platformPublishConfig.findFirst({
        where: {
          userId,
          platform: existingConfig.platform,
          configName: input.configName,
          id: { not: configId }
        }
      })

      if (duplicateConfig) {
        throw new Error(`配置名称"${input.configName}"已存在于该平台`)
      }
    }

    // 4. 更新配置
    const updatedConfig = await prisma.platformPublishConfig.update({
      where: { id: configId },
      data: {
        ...(input.configName && { configName: input.configName }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.configData && { configData: input.configData as any })
      }
    })

    return updatedConfig as PlatformPublishConfig
  }

  /**
   * 删除配置
   * @param configId 配置ID
   * @param userId 用户ID(用于权限校验)
   */
  static async deleteConfig(
    configId: string,
    userId: string
  ): Promise<void> {
    // 1. 检查配置是否存在且属于当前用户
    const existingConfig = await this.getConfigById(configId, userId)
    if (!existingConfig) {
      throw new Error('配置不存在或无权访问')
    }

    // 2. 删除配置
    await prisma.platformPublishConfig.delete({
      where: { id: configId }
    })
  }

  /**
   * 设置默认配置
   * @param configId 配置ID
   * @param userId 用户ID(用于权限校验)
   */
  static async setDefaultConfig(
    configId: string,
    userId: string
  ): Promise<PlatformPublishConfig> {
    // 1. 检查配置是否存在且属于当前用户
    const existingConfig = await this.getConfigById(configId, userId)
    if (!existingConfig) {
      throw new Error('配置不存在或无权访问')
    }

    // 2. 取消该平台下其他配置的默认状态
    await prisma.platformPublishConfig.updateMany({
      where: {
        userId,
        platform: existingConfig.platform,
        id: { not: configId }
      },
      data: {
        isDefault: false
      }
    })

    // 3. 设置当前配置为默认
    const updatedConfig = await prisma.platformPublishConfig.update({
      where: { id: configId },
      data: { isDefault: true }
    })

    return updatedConfig as PlatformPublishConfig
  }

  /**
   * 增加配置使用次数
   * @param configId 配置ID
   */
  static async incrementUsageCount(configId: string): Promise<void> {
    await prisma.platformPublishConfig.update({
      where: { id: configId },
      data: {
        usageCount: {
          increment: 1
        }
      }
    })
  }

  /**
   * 获取配置的快照(用于发布时存储)
   * @param configId 配置ID
   * @param userId 用户ID(用于权限校验)
   */
  static async getConfigSnapshot(
    configId: string,
    userId: string
  ): Promise<PlatformConfigData> {
    const config = await this.getConfigById(configId, userId)
    if (!config) {
      throw new Error('配置不存在或无权访问')
    }

    // 增加使用次数
    await this.incrementUsageCount(configId)

    // 返回配置数据的副本(快照)
    return JSON.parse(JSON.stringify(config.configData)) as PlatformConfigData
  }
}
