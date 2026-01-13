/**
 * 平台适配器基础接口
 * 所有平台适配器必须实现此接口
 */

import type {
  AuthConfig,
  TokenInfo,
  PublishContent,
  PublishResult,
  UserInfo,
  ValidationResult,
  DataQueryOptions,
  ContentData
} from './types'
import { Platform } from '@/types/platform.types'

/**
 * 平台适配器接口
 * 定义所有平台必须实现的标准方法
 */
export interface PlatformAdapter {
  /**
   * 平台标识符
   */
  readonly platform: Platform

  /**
   * 获取授权 URL
   * @param config 授权配置
   * @returns 授权 URL
   */
  getAuthUrl(config: AuthConfig): Promise<string>

  /**
   * 交换授权码获取 Token
   * @param code 授权码
   * @param config 授权配置
   * @returns Token 信息
   */
  exchangeToken(code: string, config: AuthConfig): Promise<TokenInfo>

  /**
   * 刷新 Token
   * @param refreshToken 刷新令牌
   * @returns 新的 Token 信息
   */
  refreshToken(refreshToken: string): Promise<TokenInfo>

  /**
   * 发布内容
   * @param token 访问令牌
   * @param content 发布内容
   * @returns 发布结果
   */
  publish(token: string, content: PublishContent): Promise<PublishResult>

  /**
   * 获取用户信息
   * @param token 访问令牌
   * @returns 用户信息
   */
  getUserInfo(token: string): Promise<UserInfo>

  /**
   * 获取内容数据
   * @param token 访问令牌
   * @param options 查询选项
   * @returns 内容数据列表
   */
  getContentData(token: string, options: DataQueryOptions): Promise<ContentData[]>

  /**
   * 验证内容是否符合平台限制
   * @param content 发布内容
   * @returns 验证结果
   */
  validateContent(content: PublishContent): ValidationResult
}
