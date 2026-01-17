/**
 * 配置数据映射工具
 * Feature: 006-platform-publish-config
 * 
 * 提供配置数据与表单数据之间的转换
 */

import type { PlatformConfigData } from '@/types/platform-config.types'

/**
 * 将配置数据转换为表单友好的格式
 * @param configData 原始配置数据
 */
export function configToFormData(configData: PlatformConfigData): Record<string, any> {
  return { ...configData }
}

/**
 * 将表单数据转换为配置数据格式
 * @param formData 表单数据
 */
export function formDataToConfig(formData: Record<string, any>): PlatformConfigData {
  return formData as PlatformConfigData
}

/**
 * 合并配置数据(用于部分更新)
 * @param original 原始配置
 * @param updates 更新的字段
 */
export function mergeConfigData(
  original: PlatformConfigData,
  updates: Partial<PlatformConfigData>
): PlatformConfigData {
  return {
    ...original,
    ...updates,
    type: original.type // 确保type字段不被修改
  } as PlatformConfigData
}

/**
 * 提取配置数据中的特定字段
 * @param configData 配置数据
 * @param keys 要提取的字段名
 */
export function extractConfigFields(
  configData: PlatformConfigData,
  keys: string[]
): Record<string, any> {
  const result: Record<string, any> = {}
  keys.forEach(key => {
    if (key in configData) {
      result[key] = (configData as any)[key]
    }
  })
  return result
}

/**
 * 验证配置数据的完整性
 * @param configData 配置数据
 * @param requiredKeys 必需的字段名
 */
export function validateConfigCompleteness(
  configData: PlatformConfigData,
  requiredKeys: string[]
): { valid: boolean; missingKeys: string[] } {
  const missingKeys = requiredKeys.filter(key => !(key in configData) || (configData as any)[key] === undefined)
  return {
    valid: missingKeys.length === 0,
    missingKeys
  }
}
