/**
 * 微信公众号平台适配器实现
 * 
 * 实现 PlatformAdapter 接口，提供微信公众号平台的具体实现。
 * 支持 OAuth 2.0 授权、内容发布、用户信息获取等功能。
 * 
 * @example
 * ```typescript
 * const adapter = new WechatAdapter({
 *   appId: 'your_app_id',
 *   appSecret: 'your_app_secret',
 *   redirectUri: 'http://localhost:3000/callback'
 * })
 * 
 * // 获取授权 URL
 * const authUrl = await adapter.getAuthUrl(config)
 * 
 * // 发布内容
 * const result = await adapter.publish(token, { text: 'Hello WeChat!' })
 * ```
 * 
 * @remarks
 * - Token 刷新机制：需要根据微信 API 文档确认是否支持 refresh_token
 * - 内容发布接口：需要根据微信 API 文档确定具体的发布接口（T019 任务）
 * - 内容限制：需要根据微信 API 文档确认具体的内容限制数值
 */

import { PlatformAdapter } from '../base/platform-adapter'
import type {
  AuthConfig,
  TokenInfo,
  PublishContent,
  PublishResult,
  UserInfo,
  ValidationResult
} from '../base/types'
import { Platform } from '@/types/platform.types'
import { WechatClient } from './wechat-client'
import type {
  WechatTokenInfo,
  WechatUserInfo,
  WechatConfig,
  WechatAuthConfig
} from './wechat-types'
import { getWechatErrorMessage } from './wechat-types'

export class WechatAdapter implements PlatformAdapter {
  readonly platform = Platform.WECHAT
  private client: WechatClient

  constructor(config: WechatConfig) {
    this.client = new WechatClient(config)
  }

  /**
   * 获取授权 URL
   * 
   * 生成微信公众号 OAuth 2.0 授权 URL，用户跳转到此 URL 完成授权。
   * 
   * @param config 授权配置，包含 clientId、clientSecret、redirectUri、state 等
   * @returns 授权 URL
   */
  async getAuthUrl(config: AuthConfig): Promise<string> {
    const wechatConfig = config as WechatAuthConfig
    const params = new URLSearchParams({
      appid: wechatConfig.clientId,
      redirect_uri: wechatConfig.redirectUri,
      response_type: 'code',
      scope: wechatConfig.scope || 'snsapi_userinfo',
      state: wechatConfig.state
    })

    return `https://open.weixin.qq.com/connect/oauth2/authorize?${params.toString()}#wechat_redirect`
  }

  /**
   * 交换授权码获取 Token
   * 
   * 使用授权码换取 access_token 和 refresh_token（如果支持）。
   * 
   * @param code OAuth 授权码
   * @param config 授权配置
   * @returns Token 信息，包含 accessToken、refreshToken、expiresIn、openid 等
   */
  async exchangeToken(code: string, config: AuthConfig): Promise<TokenInfo & { openid?: string }> {
    try {
      const response = await this.client.getAccessToken(code)

      return {
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        expiresIn: response.expires_in,
        tokenType: 'Bearer',
        scope: response.scope,
        openid: response.openid // 保存 openid 以便后续使用
      }
    } catch (error: any) {
      throw new Error(`获取 Token 失败: ${error.message}`)
    }
  }

  /**
   * 刷新 Token
   * 
   * 使用 refresh_token 刷新 access_token（如果微信支持）。
   * 注意：微信公众号 OAuth 2.0 可能不支持 refresh_token，需要根据实际 API 文档调整。
   * 
   * @param refreshToken 刷新令牌
   * @returns 新的 Token 信息
   */
  async refreshToken(refreshToken: string): Promise<TokenInfo> {
    try {
      // 尝试使用 refresh_token 刷新
      const response = await this.client.refreshAccessToken(refreshToken)

      return {
        accessToken: response.access_token,
        refreshToken: response.refresh_token || refreshToken, // 如果新 token 没有 refresh_token，保留旧的
        expiresIn: response.expires_in,
        tokenType: 'Bearer',
        scope: response.scope
      }
    } catch (error: any) {
      // 如果微信不支持 refresh_token 或刷新失败，抛出错误
      // 调用方应该捕获此错误并引导用户重新授权
      throw new Error(`刷新 Token 失败: ${error.message}`)
    }
  }

  /**
   * 获取用户信息
   * 
   * 通过 access_token 和 openid 获取微信公众号用户信息。
   * 
   * @param token 访问令牌
   * @param openid 用户唯一标识（可选，如果未提供则从 token 中提取）
   * @returns 用户信息
   */
  async getUserInfo(token: string, openid?: string): Promise<UserInfo> {
    try {
      // 如果未提供 openid，需要从 token 中提取
      // 注意：实际实现中，openid 应该从 exchangeToken 的响应中获取并保存
      // 这里提供一个基础实现，实际使用时需要传入 openid
      if (!openid) {
        throw new Error('getUserInfo 需要 openid 参数')
      }

      const userInfo = await this.client.getUserInfo(token, openid)

      return {
        id: userInfo.openid,
        username: userInfo.nickname,
        name: userInfo.nickname,
        avatar: userInfo.headimgurl
      }
    } catch (error: any) {
      throw new Error(`获取用户信息失败: ${error.message}`)
    }
  }

  /**
   * 发布内容
   * 
   * 发布内容到微信公众号。
   * 
   * @param token 访问令牌
   * @param content 发布内容
   * @returns 发布结果
   */
  async publish(token: string, content: PublishContent): Promise<PublishResult> {
    try {
      // 验证内容
      const validation = this.validateContent(content)
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(', ')
        }
      }

      // TODO: 实现具体的发布逻辑（T019 任务）
      // 需要根据微信 API 文档确定具体的发布接口
      // 可能是群发消息接口或素材管理接口
      // 当前返回待实现错误，实际使用时需要根据微信 API 文档实现
      
      // 记录日志
      console.warn('[WechatAdapter] 发布接口待实现，需要根据微信 API 文档确定具体接口')
      
      return {
        success: false,
        error: '发布接口待实现，需要根据微信 API 文档确定具体接口（T019 任务）',
        errorCode: 'NOT_IMPLEMENTED'
      }
    } catch (error: any) {
      // 记录错误日志
      console.error('[WechatAdapter] 发布内容失败:', {
        error: error.message,
        contentLength: content.text?.length || 0
      })

      // 检查是否为 token 过期错误
      if (error.message.includes('40001') || error.message.includes('40014')) {
        return {
          success: false,
          error: 'Token 已过期，请重新授权',
          errorCode: 'TOKEN_EXPIRED'
        }
      }

      // 提取错误码并转换为用户友好消息
      const errorCode = this.extractErrorCode(error.message)
      const friendlyError = this.getUserFriendlyError(error.message, errorCode)

      return {
        success: false,
        error: friendlyError,
        errorCode: errorCode !== 'UNKNOWN' ? errorCode : 'PUBLISH_FAILED'
      }
    }
  }

  /**
   * 获取内容数据
   * 
   * 从微信公众号获取已发布的内容数据。
   * 
   * @param token 访问令牌
   * @param options 查询选项
   * @returns 内容数据列表
   */
  async getContentData(token: string, options: any): Promise<any[]> {
    // TODO: 实现内容数据获取
    throw new Error('getContentData 待实现')
  }

  /**
   * 验证内容是否符合平台限制
   * 
   * 验证内容是否符合微信公众号的限制要求。
   * 注意：具体限制数值需要根据微信 API 文档确认。
   * 
   * @param content 发布内容
   * @returns 验证结果，包含 valid 和 errors 数组
   */
  validateContent(content: PublishContent): ValidationResult {
    const errors: string[] = []

    // TODO: 根据微信 API 文档确定具体的内容限制
    // 目前使用临时值，实际需要根据微信文档调整
    const MAX_TEXT_LENGTH = 20000 // 临时值，需要确认微信的实际限制

    if (!content.text || content.text.trim().length === 0) {
      errors.push('内容不能为空')
    }

    if (content.text && content.text.length > MAX_TEXT_LENGTH) {
      errors.push(`文字内容超过限制（最多 ${MAX_TEXT_LENGTH} 字）`)
    }

    // 图片数量限制（需要确认微信的实际限制）
    if (content.images && content.images.length > 8) {
      errors.push('图片数量超过限制（最多 8 张）')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 提取错误码
   * 
   * 从错误消息中提取微信错误码。
   * 
   * @param errorMessage 错误消息
   * @returns 错误码字符串
   */
  private extractErrorCode(errorMessage: string): string {
    // 尝试从错误消息中提取错误码（格式：错误码: 错误信息）
    const match = errorMessage.match(/\((\d+)\)|错误码[：:]\s*(\d+)/i)
    return match ? (match[1] || match[2]) : 'UNKNOWN'
  }

  /**
   * 获取用户友好的错误消息
   * 
   * 将微信 API 错误转换为用户友好的错误消息。
   * 
   * @param errorMessage 原始错误消息
   * @param errorCode 错误码
   * @returns 用户友好的错误消息
   */
  private getUserFriendlyError(errorMessage: string, errorCode: string): string {
    // 如果是频率限制错误
    if (errorCode === '45009' || errorCode === '45011' || errorMessage.includes('频率')) {
      return '请求频率过高，请稍后再试'
    }

    // 如果是 Token 错误
    if (errorCode === '40001' || errorCode === '40014' || errorMessage.includes('Token') || errorMessage.includes('token')) {
      return '授权已过期，请重新连接账号'
    }

    // 如果是内容错误
    if (errorCode === '87014' || errorMessage.includes('内容') || errorMessage.includes('敏感')) {
      return '内容不符合平台规范，请修改后重试'
    }

    // 使用错误码映射
    const friendlyMessage = getWechatErrorMessage(parseInt(errorCode, 10))
    if (friendlyMessage && !friendlyMessage.includes('未知错误')) {
      return friendlyMessage
    }

    // 默认错误消息
    return '操作失败，请稍后重试'
  }
}
