/**
 * 微信公众号平台相关类型定义
 */

/**
 * 微信公众号 OAuth Token 响应
 */
export interface WechatTokenInfo {
  access_token: string
  expires_in: number // 过期时间（秒）
  refresh_token?: string // 如果微信支持
  openid: string // 微信公众号用户 ID
  scope?: string // 授权范围
  unionid?: string // 用户统一标识（如果存在）
}

/**
 * 微信公众号用户信息
 */
export interface WechatUserInfo {
  openid: string // 用户唯一标识
  nickname: string // 用户昵称
  headimgurl?: string // 头像 URL
  sex?: number // 性别（1-男，2-女，0-未知）
  city?: string // 城市
  province?: string // 省份
  country?: string // 国家
  unionid?: string // 用户统一标识（如果存在）
  [key: string]: any // 允许其他字段
}

/**
 * 微信公众号发布结果
 */
export interface WechatPublishResult {
  msg_id?: string // 消息 ID（如果可用）
  msg_data_id?: string // 消息数据 ID（如果可用）
  [key: string]: any
}

/**
 * 微信公众号 API 错误响应
 */
export interface WechatError {
  errcode: number // 错误码
  errmsg: string // 错误信息
}

/**
 * 微信公众号配置
 */
export interface WechatConfig {
  appId: string
  appSecret: string
  redirectUri: string
  baseUrl?: string // API 基础 URL，默认 https://api.weixin.qq.com
}

/**
 * 微信公众号授权配置
 */
export interface WechatAuthConfig {
  clientId: string // AppID
  clientSecret: string // AppSecret
  redirectUri: string
  state: string
  scope?: string // 授权范围，默认 snsapi_userinfo
}

/**
 * 微信公众号 API 错误码映射
 * 参考：https://developers.weixin.qq.com/doc/offiaccount/en/Getting_Started/Global_Return_Code.html
 */
export const WECHAT_ERROR_CODES: Record<number, string> = {
  // Token 相关错误
  40001: 'access_token 无效',
  40014: 'access_token 过期',
  40002: '不合法的凭证类型',
  40003: '不合法的 OpenID',
  
  // 频率限制
  45009: '接口调用超过限制',
  45010: '创建菜单个数超过限制',
  45011: 'API 调用太频繁，请稍候再试',
  
  // 内容相关
  87014: '内容含有违法违规内容',
  85001: '微信号不存在或已经失效',
  
  // 系统错误
  -1: '系统繁忙，此时请开发者稍候再试',
  0: '请求成功',
  40013: '不合法的 AppID',
  40125: '不合法的 AppSecret',
  40164: '不合法的服务器 IP 地址',
  
  // 权限相关
  48001: 'api 功能未授权',
  48004: 'api 接口被封禁',
  48005: 'api 禁止删除被自动回复和自定义菜单引用的素材',
  48006: 'api 禁止清零调用次数，因为清零次数达到上限',
  48008: '没有该类型消息的发送权限',
}

/**
 * 获取微信错误信息
 */
export function getWechatErrorMessage(error: WechatError | number): string {
  const errcode = typeof error === 'number' ? error : error.errcode
  return WECHAT_ERROR_CODES[errcode] || `微信 API 错误: ${typeof error === 'object' ? error.errmsg : '未知错误'}`
}

/**
 * 检查是否为微信错误响应
 */
export function isWechatError(data: any): data is WechatError {
  return data && typeof data === 'object' && 'errcode' in data && 'errmsg' in data
}

/**
 * 检查微信 API 响应是否成功
 */
export function isWechatSuccess(data: any): boolean {
  if (isWechatError(data)) {
    return data.errcode === 0
  }
  return true
}
