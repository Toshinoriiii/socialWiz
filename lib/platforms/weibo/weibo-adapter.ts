/**
 * 微博平台适配器实现
 * 
 * 实现 PlatformAdapter 接口，提供微博平台的具体实现。
 * 支持 OAuth 2.0 授权、内容发布、用户信息获取等功能。
 * 
 * @example
 * ```typescript
 * const adapter = new WeiboAdapter({
 *   appKey: 'your_app_key',
 *   appSecret: 'your_app_secret',
 *   redirectUri: 'http://localhost:3000/callback'
 * })
 * 
 * // 获取授权 URL
 * const authUrl = await adapter.getAuthUrl(config)
 * 
 * // 发布内容
 * const result = await adapter.publish(token, { text: 'Hello Weibo!' })
 * ```
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
import { WeiboClient } from './weibo-client'
import type {
  WeiboTokenInfo,
  WeiboUserInfo,
  WeiboPublishResult,
  WeiboConfig,
  WeiboAuthConfig
} from './weibo-types'
import { getWeiboErrorMessage } from './weibo-types'
import { validateWeiboContent } from './weibo-utils'

export class WeiboAdapter implements PlatformAdapter {
  readonly platform = Platform.WEIBO
  private client: WeiboClient

  constructor(config: WeiboConfig) {
    this.client = new WeiboClient(config)
  }

  /**
   * 获取授权 URL
   * 
   * 生成微博 OAuth 2.0 授权 URL，用户跳转到此 URL 完成授权。
   * 
   * @param config 授权配置，包含 clientId、clientSecret、redirectUri、state 等
   * @returns 授权 URL
   */
  async getAuthUrl(config: AuthConfig): Promise<string> {
    const weiboConfig = config as WeiboAuthConfig
    const params = new URLSearchParams({
      client_id: weiboConfig.clientId,
      response_type: 'code',
      redirect_uri: weiboConfig.redirectUri,
      state: weiboConfig.state,
      scope: weiboConfig.scope || 'all'
    })

    return `https://api.weibo.com/oauth2/authorize?${params.toString()}`
  }

  /**
   * 交换授权码获取 Token
   * 
   * 使用授权码换取 access_token 和 refresh_token（如果支持）。
   * 
   * @param code OAuth 授权码
   * @param config 授权配置
   * @returns Token 信息，包含 accessToken、refreshToken、expiresIn 等
   */
  async exchangeToken(code: string, config: AuthConfig): Promise<TokenInfo> {
    try {
      const response = await this.client.postForm<WeiboTokenInfo>('/oauth2/access_token', {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri
      })

      return {
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        expiresIn: response.expires_in,
        tokenType: 'Bearer',
        scope: response.scope
      }
    } catch (error: any) {
      throw new Error(`获取 Token 失败: ${error.message}`)
    }
  }

  /**
   * 刷新 Token
   * 
   * 注意：微博 Web 应用不支持 refresh_token，此方法主要用于移动应用。
   * Web 应用需要重新授权。
   * 
   * @param refreshToken 刷新令牌
   * @returns 新的 Token 信息
   * @throws 如果 Web 应用调用此方法，将抛出错误
   */
  async refreshToken(refreshToken: string): Promise<TokenInfo> {
    // 微博 Web 应用不支持 refresh_token
    // 如果未来支持，可以在这里实现
    throw new Error('微博 Web 应用不支持 refresh_token，请重新授权')
  }

  /**
   * 发布内容到微博
   * 
   * 发布文字内容到微博。目前仅支持纯文字发布（图片和视频功能暂不考虑）。
   * 
   * @param token 访问令牌
   * @param content 发布内容，包含 text（必填）、images（可选）、video（可选）等
   * @returns 发布结果，包含 success、platformPostId、publishedUrl 等
   */
  async publish(token: string, content: PublishContent): Promise<PublishResult> {
    // 验证内容
    const validation = this.validateContent(content)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join('; '),
        errorCode: 'VALIDATION_ERROR'
      }
    }

    try {
      // 目前仅支持纯文字发布（图片和视频功能暂不考虑）
      const response = await this.client.postForm<WeiboPublishResult>('/statuses/update.json', {
        access_token: token,
        status: content.text
      })

      return {
        success: true,
        platformPostId: response.idstr,
        publishedUrl: `https://weibo.com/${response.user.id}/${response.idstr}`
      }
    } catch (error: any) {
      // 提取错误码
      const errorCode = this.extractErrorCode(error.message)
      return {
        success: false,
        error: this.getUserFriendlyError(error.message, errorCode),
        errorCode
      }
    }
  }

  /**
   * 获取用户信息
   * 
   * 从微博 API 获取当前授权用户的信息。
   * 
   * @param token 访问令牌
   * @returns 用户信息，包含 id、username、name、avatar 等
   */
  async getUserInfo(token: string): Promise<UserInfo> {
    try {
      const response = await this.client.get<WeiboUserInfo>('/users/show.json', {
        access_token: token
      })

      return {
        id: response.id,
        username: response.screen_name,
        name: response.name,
        avatar: response.avatar_large,
        followersCount: response.followers_count,
        friendsCount: response.friends_count,
        statusesCount: response.statuses_count
      }
    } catch (error: any) {
      throw new Error(`获取用户信息失败: ${error.message}`)
    }
  }

  /**
   * 获取内容数据（暂不实现）
   */
  async getContentData(token: string, options: any): Promise<any[]> {
    // 后续迭代实现
    throw new Error('功能暂未实现')
  }

  /**
   * 验证内容是否符合微博限制
   * 
   * 检查文字长度、图片数量等是否符合微博平台的要求。
   * 
   * @param content 发布内容
   * @returns 验证结果，包含 valid 和 errors 数组
   */
  validateContent(content: PublishContent): ValidationResult {
    return validateWeiboContent(content)
  }

  /**
   * 提取错误码
   */
  private extractErrorCode(errorMessage: string): string {
    const match = errorMessage.match(/\((\d+)\)/)
    return match ? match[1] : 'UNKNOWN'
  }

  /**
   * 获取用户友好的错误消息
   */
  private getUserFriendlyError(errorMessage: string, errorCode: string): string {
    // 如果是频率限制错误
    if (errorCode === '21327' || errorMessage.includes('频率')) {
      return '发布频率过高，请稍后再试'
    }

    // 如果是 Token 错误
    if (errorCode.startsWith('213') || errorMessage.includes('Token') || errorMessage.includes('token')) {
      return '授权已过期，请重新连接账号'
    }

    // 如果是内容错误
    if (errorMessage.includes('内容') || errorMessage.includes('敏感')) {
      return '内容不符合平台规范，请修改后重试'
    }

    // 使用错误码映射
    const friendlyMessage = getWeiboErrorMessage(parseInt(errorCode, 10))
    if (friendlyMessage && !friendlyMessage.includes('未知错误')) {
      return friendlyMessage
    }

    // 默认错误消息
    return '发布失败，请稍后重试'
  }
}
