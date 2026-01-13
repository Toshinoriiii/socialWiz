/**
 * 微博平台相关类型定义
 */

/**
 * 微博 OAuth Token 响应
 */
export interface WeiboTokenInfo {
  access_token: string
  expires_in: number // 过期时间（秒）
  uid: string // 微博用户 ID
  refresh_token?: string // Web 应用不支持
  scope?: string
}

/**
 * 微博用户信息
 */
export interface WeiboUserInfo {
  id: string // uid
  screen_name: string // 用户名
  name: string // 昵称
  avatar_large: string // 头像 URL
  followers_count: number // 粉丝数
  friends_count: number // 关注数
  statuses_count: number // 微博数
  description?: string // 个人简介
  location?: string // 所在地
  [key: string]: any // 允许其他字段
}

/**
 * 微博发布结果
 */
export interface WeiboPublishResult {
  idstr: string // 微博 ID（字符串格式）
  id: number // 微博 ID（数字格式）
  text: string // 微博内容
  created_at: string // 创建时间
  user: {
    id: number
    screen_name: string
  }
  [key: string]: any
}

/**
 * 微博错误响应
 */
export interface WeiboError {
  error: string // 错误码
  error_code: number // 错误代码
  error_description: string // 错误描述
  request: string // 请求路径
}

/**
 * 微博配置
 */
export interface WeiboConfig {
  appKey: string
  appSecret: string
  redirectUri: string
  baseUrl?: string // API 基础 URL，默认 https://api.weibo.com/2
}

/**
 * 微博授权配置
 */
export interface WeiboAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  state: string
  scope?: string
}

/**
 * 微博 API 错误码映射
 */
export const WEIBO_ERROR_CODES: Record<number, string> = {
  21301: 'Token 过期',
  21314: 'Token 被撤销',
  21315: 'Token 不合法',
  21316: 'Token 不匹配',
  21317: 'Token 已过期',
  21327: '频率限制',
  10001: '系统错误',
  10002: '服务暂不可用',
  10003: '远程服务错误',
  10005: 'IP 请求超过上限',
  10006: '需要验证码',
  10007: '权限不足',
  10008: '参数错误',
  10009: '参数缺失',
  10010: '接口不存在',
  10011: '请求方式错误',
  10012: '图片太大',
  10013: '内容为空',
  10014: '内容重复',
  10016: '应用不存在',
  10017: '应用被禁用',
  10018: '应用类型错误',
  10020: '接口权限不足',
  10021: '接口调用次数超限',
  10022: 'RPC 错误',
  10023: '用户不存在',
  10024: '用户被屏蔽',
  20001: '内容不能为空',
  20002: '内容过长',
  20003: '内容包含敏感词',
  20005: '内容重复',
  20008: '内容包含非法链接',
  20009: '内容包含广告',
  20012: '内容包含垃圾信息',
  20014: '内容包含不当内容',
  20015: '内容包含不当图片',
  20016: '内容包含不当视频',
  20017: '内容包含不当音频',
  20019: '内容包含不当话题',
  20020: '内容包含不当@',
  20021: '内容包含不当转发',
  20022: '内容包含不当评论',
  20023: '内容包含不当点赞',
  20024: '内容包含不当收藏',
  20025: '内容包含不当分享',
  20026: '内容包含不当举报',
  20027: '内容包含不当删除',
  20028: '内容包含不当修改',
  20029: '内容包含不当发布',
  20030: '内容包含不当取消',
  20031: '内容包含不当恢复',
  20032: '内容包含不当置顶',
  20033: '内容包含不当取消置顶',
  20034: '内容包含不当加精',
  20035: '内容包含不当取消加精',
  20036: '内容包含不当推荐',
  20037: '内容包含不当取消推荐',
  20038: '内容包含不当屏蔽',
  20039: '内容包含不当取消屏蔽',
  20040: '内容包含不当删除评论',
  20041: '内容包含不当删除转发',
  20042: '内容包含不当删除点赞',
  20043: '内容包含不当删除收藏',
  20044: '内容包含不当删除分享',
  20045: '内容包含不当删除举报',
  20046: '内容包含不当删除删除',
  20047: '内容包含不当删除修改',
  20048: '内容包含不当删除发布',
  20049: '内容包含不当删除取消',
  20050: '内容包含不当删除恢复',
  20051: '内容包含不当删除置顶',
  20052: '内容包含不当删除取消置顶',
  20053: '内容包含不当删除加精',
  20054: '内容包含不当删除取消加精',
  20055: '内容包含不当删除推荐',
  20056: '内容包含不当删除取消推荐',
  20057: '内容包含不当删除屏蔽',
  20058: '内容包含不当删除取消屏蔽'
}

/**
 * 获取用户友好的错误消息
 */
export function getWeiboErrorMessage(errorCode: number | string): string {
  const code = typeof errorCode === 'string' ? parseInt(errorCode, 10) : errorCode
  return WEIBO_ERROR_CODES[code] || `未知错误 (错误码: ${errorCode})`
}
