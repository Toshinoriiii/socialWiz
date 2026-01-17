/**
 * 平台字段配置定义
 * Feature: 006-platform-publish-config
 * 
 * 定义每个平台的配置字段元数据,用于动态生成表单
 */

import { Platform } from '@/types/platform.types'

/**
 * 字段类型枚举
 */
export enum FieldType {
  TEXT = 'text',
  URL = 'url',
  BOOLEAN = 'boolean',
  SELECT = 'select',
  NUMBER = 'number',
  TEXTAREA = 'textarea'
}

/**
 * 字段配置接口
 */
export interface PlatformFieldConfig {
  key: string // 字段名(对应configData中的key)
  label: string // 字段展示名称
  type: FieldType // 字段类型
  required: boolean // 是否必填
  placeholder?: string // 输入提示
  helpText?: string // 字段说明
  maxLength?: number // 最大长度
  options?: Array<{ value: string; label: string }> // 下拉选项(仅type=SELECT时)
  defaultValue?: any // 默认值
}

/**
 * 微信公众号配置字段
 */
export const WECHAT_CONFIG_FIELDS: PlatformFieldConfig[] = [
  {
    key: 'author',
    label: '作者',
    type: FieldType.TEXT,
    required: false,
    placeholder: '请输入作者名',
    helpText: '将显示在文章底部,最多64个字符',
    maxLength: 64,
    defaultValue: ''
  },
  {
    key: 'contentSourceUrl',
    label: '原文链接',
    type: FieldType.URL,
    required: false,
    placeholder: 'https://example.com/article',
    helpText: '点击"阅读原文"跳转的链接',
    defaultValue: ''
  },
  {
    key: 'needOpenComment',
    label: '开启留言',
    type: FieldType.BOOLEAN,
    required: false,
    helpText: '是否允许读者留言',
    defaultValue: false
  },
  {
    key: 'onlyFansCanComment',
    label: '仅粉丝可留言',
    type: FieldType.BOOLEAN,
    required: false,
    helpText: '如果开启,只有关注的粉丝可以留言',
    defaultValue: false
  }
]

/**
 * 微博配置字段
 */
export const WEIBO_CONFIG_FIELDS: PlatformFieldConfig[] = [
  {
    key: 'visibility',
    label: '可见范围',
    type: FieldType.SELECT,
    required: false,
    helpText: '选择谁可以看到这条微博',
    options: [
      { value: 'public', label: '公开' },
      { value: 'friends', label: '仅好友' },
      { value: 'self', label: '仅自己' }
    ],
    defaultValue: 'public'
  },
  {
    key: 'allowComment',
    label: '允许评论',
    type: FieldType.BOOLEAN,
    required: false,
    helpText: '是否允许其他用户评论',
    defaultValue: true
  },
  {
    key: 'allowRepost',
    label: '允许转发',
    type: FieldType.BOOLEAN,
    required: false,
    helpText: '是否允许其他用户转发',
    defaultValue: true
  }
]

/**
 * 抖音配置字段
 */
export const DOUYIN_CONFIG_FIELDS: PlatformFieldConfig[] = [
  {
    key: 'privacyLevel',
    label: '隐私设置',
    type: FieldType.SELECT,
    required: false,
    helpText: '选择视频的可见范围',
    options: [
      { value: 'public', label: '公开' },
      { value: 'friends', label: '好友可见' },
      { value: 'self', label: '仅自己可见' }
    ],
    defaultValue: 'public'
  },
  {
    key: 'allowComment',
    label: '允许评论',
    type: FieldType.BOOLEAN,
    required: false,
    helpText: '是否允许其他用户评论',
    defaultValue: true
  },
  {
    key: 'allowDuet',
    label: '允许合拍',
    type: FieldType.BOOLEAN,
    required: false,
    helpText: '是否允许其他用户合拍你的视频',
    defaultValue: true
  },
  {
    key: 'allowStitch',
    label: '允许使用视频',
    type: FieldType.BOOLEAN,
    required: false,
    helpText: '是否允许其他用户使用你的视频片段',
    defaultValue: true
  }
]

/**
 * 小红书配置字段
 */
export const XIAOHONGSHU_CONFIG_FIELDS: PlatformFieldConfig[] = [
  {
    key: 'noteType',
    label: '笔记类型',
    type: FieldType.SELECT,
    required: false,
    helpText: '选择发布的内容类型',
    options: [
      { value: 'normal', label: '图文笔记' },
      { value: 'video', label: '视频笔记' }
    ],
    defaultValue: 'normal'
  },
  {
    key: 'allowComment',
    label: '允许评论',
    type: FieldType.BOOLEAN,
    required: false,
    helpText: '是否允许其他用户评论',
    defaultValue: true
  },
  {
    key: 'poiId',
    label: '地点ID',
    type: FieldType.TEXT,
    required: false,
    placeholder: '请输入地点ID',
    helpText: '关联笔记的地理位置(可选)',
    defaultValue: ''
  }
]

/**
 * 获取平台的字段配置
 */
export function getPlatformFields(platform: Platform): PlatformFieldConfig[] {
  switch (platform) {
    case Platform.WECHAT:
      return WECHAT_CONFIG_FIELDS
    case Platform.WEIBO:
      return WEIBO_CONFIG_FIELDS
    case Platform.DOUYIN:
      return DOUYIN_CONFIG_FIELDS
    case Platform.XIAOHONGSHU:
      return XIAOHONGSHU_CONFIG_FIELDS
    default:
      return []
  }
}

/**
 * 获取字段的默认值对象
 */
export function getDefaultConfigData(platform: Platform): Record<string, any> {
  const fields = getPlatformFields(platform)
  const defaultData: Record<string, any> = {}
  
  // 添加type字段(Discriminated Union所需)
  const platformTypeMap: Record<Platform, string> = {
    [Platform.WECHAT]: 'wechat',
    [Platform.WEIBO]: 'weibo',
    [Platform.DOUYIN]: 'douyin',
    [Platform.XIAOHONGSHU]: 'xiaohongshu'
  }
  defaultData.type = platformTypeMap[platform]
  
  // 添加各字段默认值
  fields.forEach(field => {
    if (field.defaultValue !== undefined) {
      defaultData[field.key] = field.defaultValue
    }
  })
  
  return defaultData
}
