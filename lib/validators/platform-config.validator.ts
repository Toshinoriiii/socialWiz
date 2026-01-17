/**
 * 平台发布配置验证器
 * Feature: 006-platform-publish-config
 * 
 * 使用Zod进行运行时数据验证
 */

import { z } from 'zod'
import { Platform } from '@/types/platform.types'
import type { PlatformConfigData } from '@/types/platform-config.types'

/**
 * 基础配置验证(所有平台通用)
 */
export const BaseConfigSchema = z.object({
  configName: z.string()
    .min(1, '配置名称不能为空')
    .max(50, '配置名称不能超过50个字符')
    .regex(
      /^[\u4e00-\u9fa5a-zA-Z0-9_\-\s]+$/,
      '配置名称只能包含中文、英文、数字、下划线和短横线'
    ),
  description: z.string()
    .max(500, '配置描述不能超过500个字符')
    .optional()
})

/**
 * 微信配置数据验证
 */
export const WechatConfigDataSchema = z.object({
  type: z.literal('wechat'),
  author: z.string()
    .max(64, '作者名不能超过64个字符')
    .optional(),
  contentSourceUrl: z.string()
    .url('请输入有效的URL')
    .optional()
    .or(z.literal('')),
  needOpenComment: z.boolean().optional().default(false),
  onlyFansCanComment: z.boolean().optional().default(false)
})

/**
 * 微博配置数据验证
 */
export const WeiboConfigDataSchema = z.object({
  type: z.literal('weibo'),
  visibility: z.enum(['public', 'friends', 'self']).default('public'),
  allowComment: z.boolean().default(true),
  allowRepost: z.boolean().default(true)
})

/**
 * 抖音配置数据验证
 */
export const DouyinConfigDataSchema = z.object({
  type: z.literal('douyin'),
  allowComment: z.boolean().optional(),
  allowDuet: z.boolean().optional(),
  allowStitch: z.boolean().optional(),
  privacyLevel: z.enum(['public', 'friends', 'self']).optional()
})

/**
 * 小红书配置数据验证
 */
export const XiaohongshuConfigDataSchema = z.object({
  type: z.literal('xiaohongshu'),
  noteType: z.enum(['normal', 'video']).optional(),
  allowComment: z.boolean().optional(),
  poiId: z.string().optional()
})

/**
 * 平台配置数据联合验证
 */
export const PlatformConfigDataSchema = z.discriminatedUnion('type', [
  WechatConfigDataSchema,
  WeiboConfigDataSchema,
  DouyinConfigDataSchema,
  XiaohongshuConfigDataSchema
])

/**
 * 创建配置输入验证
 */
export const CreateConfigInputSchema = BaseConfigSchema.extend({
  platform: z.nativeEnum(Platform),
  configData: PlatformConfigDataSchema
})

/**
 * 更新配置输入验证
 */
export const UpdateConfigInputSchema = BaseConfigSchema.partial().extend({
  configData: PlatformConfigDataSchema.optional()
})

/**
 * 类型推导
 */
export type CreateConfigInput = z.infer<typeof CreateConfigInputSchema>
export type UpdateConfigInput = z.infer<typeof UpdateConfigInputSchema>

/**
 * 验证配置数据格式
 */
export function validateConfigData(
  platform: Platform,
  data: unknown
): { success: true; data: PlatformConfigData } | { success: false; error: string } {
  const result = PlatformConfigDataSchema.safeParse(data)
  
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map(i => i.message).join(', ')
    }
  }
  
  // 验证platform与configData.type匹配
  const typeMap: Record<Platform, string> = {
    [Platform.WECHAT]: 'wechat',
    [Platform.WEIBO]: 'weibo',
    [Platform.DOUYIN]: 'douyin',
    [Platform.XIAOHONGSHU]: 'xiaohongshu'
  }
  
  if (result.data.type !== typeMap[platform]) {
    return {
      success: false,
      error: `配置数据类型与平台不匹配: ${result.data.type} vs ${platform}`
    }
  }
  
  return { success: true, data: result.data }
}
