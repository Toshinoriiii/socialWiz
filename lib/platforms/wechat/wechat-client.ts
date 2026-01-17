/**
 * 微信公众号API客户端
 * Feature: 005-wechat-integration
 */

import axios, { AxiosInstance } from 'axios'
import {
  WechatApiBaseResponse,
  WechatTokenResponse,
  WechatDraftAddRequest,
  WechatDraftAddResponse,
  WechatErrorCode,
  WECHAT_ERROR_MAP
} from './wechat-types'

/**
 * 微信API基础URL
 */
const WECHAT_API_BASE_URL = 'https://api.weixin.qq.com'

/**
 * 微信API客户端类
 */
export class WechatApiClient {
  private readonly axios: AxiosInstance
  
  constructor() {
    this.axios = axios.create({
      baseURL: WECHAT_API_BASE_URL,
      timeout: 30000, // 30秒超时
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    // 添加响应拦截器处理错误
    this.axios.interceptors.response.use(
      response => response,
      error => {
        console.error('[WechatApiClient] Request failed:', error.message)
        throw error
      }
    )
  }
  
  /**
   * 获取access_token
   * @param appId 公众号AppID
   * @param appSecret 公众号AppSecret
   * @returns Token响应
   */
  async getAccessToken(appId: string, appSecret: string): Promise<WechatTokenResponse> {
    try {
      const response = await this.axios.get<WechatTokenResponse>('/cgi-bin/token', {
        params: {
          grant_type: 'client_credential',
          appid: appId,
          secret: appSecret
        }
      })
      
      const data = response.data
      
      // 检查是否有错误
      if (data.errcode && data.errcode !== WechatErrorCode.SUCCESS) {
        throw this.createWechatError(data.errcode, data.errmsg)
      }
      
      return data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`微信API请求失败: ${error.message}`)
      }
      throw error
    }
  }
  
  /**
   * 创建草稿
   * @param accessToken Access Token
   * @param request 草稿创建请求
   * @returns 草稿创建响应
   */
  async createDraft(
    accessToken: string,
    request: WechatDraftAddRequest
  ): Promise<WechatDraftAddResponse> {
    try {
      const response = await this.axios.post<WechatDraftAddResponse>(
        '/cgi-bin/draft/add',
        request,
        {
          params: { access_token: accessToken }
        }
      )
      
      const data = response.data
      
      // 检查是否有错误
      if (data.errcode && data.errcode !== WechatErrorCode.SUCCESS) {
        throw this.createWechatError(data.errcode, data.errmsg)
      }
      
      return data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`微信草稿创建失败: ${error.message}`)
      }
      throw error
    }
  }
  
  /**
   * 创建微信错误对象
   * @param errcode 错误码
   * @param errmsg 错误消息
   * @returns Error对象
   */
  private createWechatError(errcode: number, errmsg?: string): Error {
    const errorInfo = WECHAT_ERROR_MAP[errcode]
    
    if (errorInfo) {
      const error = new Error(
        `[${errcode}] ${errorInfo.message}: ${errmsg || ''}\n建议: ${errorInfo.suggestion}`
      )
      ;(error as any).code = errcode
      ;(error as any).suggestion = errorInfo.suggestion
      return error
    }
    
    const error = new Error(`[${errcode}] 微信API错误: ${errmsg || '未知错误'}`)
    ;(error as any).code = errcode
    return error
  }
  
  /**
   * 通用GET请求
   * @param endpoint API端点
   * @param params 请求参数
   * @returns 响应数据
   */
  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const response = await this.axios.get<T>(endpoint, { params })
    return response.data
  }
  
  /**
   * 通用POST请求
   * @param endpoint API端点
   * @param data 请求数据
   * @param params URL参数
   * @returns 响应数据
   */
  async post<T = any>(
    endpoint: string,
    data?: any,
    params?: Record<string, any>
  ): Promise<T> {
    const response = await this.axios.post<T>(endpoint, data, { params })
    return response.data
  }
}

/**
 * 导出单例实例
 */
export const wechatApiClient = new WechatApiClient()
