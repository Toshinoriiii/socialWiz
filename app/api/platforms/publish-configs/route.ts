/**
 * 平台发布配置API端点
 * Feature: 006-platform-publish-config
 * 
 * GET    /api/platforms/publish-configs - 获取配置列表
 * POST   /api/platforms/publish-configs - 创建配置
 * PUT    /api/platforms/publish-configs - 更新配置
 * DELETE /api/platforms/publish-configs - 删除配置
 */

import { NextRequest, NextResponse } from 'next/server'
import { PlatformConfigService } from '@/lib/services/platform-config.service'
import { CreateConfigInputSchema } from '@/lib/validators/platform-config.validator'
import { Platform } from '@/types/platform.types'

/**
 * GET /api/platforms/publish-configs
 * 获取用户的配置列表
 * 
 * Query参数:
 * - userId: 用户ID(必需)
 * - platform: 平台过滤(可选)
 * - isDefault: 是否默认配置(可选)
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 获取查询参数
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const platform = searchParams.get('platform') as Platform | null
    const isDefaultStr = searchParams.get('isDefault')
    const isDefault = isDefaultStr ? isDefaultStr === 'true' : undefined

    // 2. 验证userId
    if (!userId) {
      return NextResponse.json(
        { error: '缺少用户ID' },
        { status: 400 }
      )
    }

    // 3. 调用服务层获取配置
    const configs = await PlatformConfigService.getUserConfigs(
      userId,
      {
        platform: platform || undefined,
        isDefault
      }
    )

    return NextResponse.json({
      configs,
      total: configs.length
    })
  } catch (error) {
    console.error('Get configs error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取配置失败' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/platforms/publish-configs
 * 创建新配置
 * 
 * Body:
 * {
 *   userId: 'user-id',
 *   platform: 'WECHAT',
 *   configName: '默认配置',
 *   description: '描述',
 *   configData: { type: 'wechat', author: '作者', ... }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 解析请求体
    const body = await request.json()

    // 2. 验证userId
    if (!body.userId) {
      return NextResponse.json(
        { error: '缺少用户ID' },
        { status: 400 }
      )
    }

    const userId = body.userId
    const { platform, configName, description, configData } = body

    // 3. 验证输入数据
    const validation = CreateConfigInputSchema.safeParse({
      platform,
      configName,
      description,
      configData
    })
    
    if (!validation.success) {
      const errorMessages = validation.error.issues
        .map(issue => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')
      
      return NextResponse.json(
        { error: `数据验证失败: ${errorMessages}` },
        { status: 400 }
      )
    }

    // 4. 调用服务层创建配置
    const newConfig = await PlatformConfigService.createConfig(
      userId,
      validation.data
    )

    return NextResponse.json(newConfig, { status: 201 })
  } catch (error) {
    console.error('Create config error:', error)
    
    // 处理特定错误
    if (error instanceof Error) {
      if (error.message.includes('已存在')) {
        return NextResponse.json(
          { error: error.message },
          { status: 409 }
        )
      }
      
      if (error.message.includes('验证失败')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建配置失败' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/platforms/publish-configs
 * 更新配置
 * 
 * Body:
 * {
 *   userId: 'user-id',
 *   configId: 'config-id',
 *   originalConfigName: '原配置名',
 *   platform: 'WECHAT',
 *   configName: '新配置名',
 *   description: '描述',
 *   configData: { type: 'wechat', author: '作者', ... }
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    // 1. 解析请求体
    const body = await request.json()

    // 2. 验证userId和configId
    if (!body.userId) {
      return NextResponse.json(
        { error: '缺少用户ID' },
        { status: 400 }
      )
    }

    if (!body.configId) {
      return NextResponse.json(
        { error: '缺少配置ID' },
        { status: 400 }
      )
    }

    const userId = body.userId
    const configId = body.configId
    const originalConfigName = body.originalConfigName
    const { platform, configName, description, configData } = body

    // 3. 验证输入数据
    const validation = CreateConfigInputSchema.safeParse({
      platform,
      configName,
      description,
      configData
    })
    
    if (!validation.success) {
      const errorMessages = validation.error.issues
        .map(issue => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')
      
      return NextResponse.json(
        { error: `数据验证失败: ${errorMessages}` },
        { status: 400 }
      )
    }

    // 4. 判断是否修改了配置名称
    const configNameChanged = originalConfigName && configName !== originalConfigName

    if (configNameChanged) {
      // 配置名修改了：创建新配置 + 删除旧配置
      const newConfig = await PlatformConfigService.createConfig(
        userId,
        validation.data
      )

      // 删除旧配置
      await PlatformConfigService.deleteConfig(configId, userId)

      return NextResponse.json({
        ...newConfig,
        _action: 'replaced'
      })
    } else {
      // 配置名未改变：直接更新
      const updatedConfig = await PlatformConfigService.updateConfig(
        configId,
        userId,
        {
          configName: validation.data.configName,
          description: validation.data.description,
          configData: validation.data.configData
        }
      )

      return NextResponse.json({
        ...updatedConfig,
        _action: 'updated'
      })
    }
  } catch (error) {
    console.error('Update config error:', error)
    
    // 处理特定错误
    if (error instanceof Error) {
      if (error.message.includes('已存在')) {
        return NextResponse.json(
          { error: error.message },
          { status: 409 }
        )
      }
      
      if (error.message.includes('不存在') || error.message.includes('无权访问')) {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        )
      }
      
      if (error.message.includes('验证失败')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新配置失败' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/platforms/publish-configs
 * 删除配置
 * 
 * Query参数:
 * - userId: 用户ID(必需)
 * - configId: 配置ID(必需)
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. 获取查询参数
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const configId = searchParams.get('configId')

    // 2. 验证参数
    if (!userId) {
      return NextResponse.json(
        { error: '缺少用户ID' },
        { status: 400 }
      )
    }

    if (!configId) {
      return NextResponse.json(
        { error: '缺少配置ID' },
        { status: 400 }
      )
    }

    // 3. 调用服务层删除配置
    await PlatformConfigService.deleteConfig(configId, userId)

    return NextResponse.json({ message: '配置已删除' })
  } catch (error) {
    console.error('Delete config error:', error)
    
    // 处理特定错误
    if (error instanceof Error) {
      if (error.message.includes('不存在') || error.message.includes('无权访问')) {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        )
      }
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除配置失败' },
      { status: 500 }
    )
  }
}
