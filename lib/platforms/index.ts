/**
 * 平台适配器统一导出
 */

export * from './base/types'
export * from './base/platform-adapter'
export * from './weibo/weibo-types'
export * from './weibo/weibo-client'

// 导出适配器实现
export { WeiboAdapter } from './weibo/weibo-adapter'
