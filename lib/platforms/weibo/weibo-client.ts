/**
 * 微博 API 客户端
 * 封装微博 API 的 HTTP 请求
 */

import axios, { AxiosInstance, AxiosError } from 'axios'
import type { WeiboError, WeiboConfig } from './weibo-types'

export class WeiboClient {
  private client: AxiosInstance
  private config: WeiboConfig

  constructor(config: WeiboConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || 'https://api.weibo.com/2'
    }

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // 请求拦截器：添加 access_token
    this.client.interceptors.request.use(
      (config) => {
        // access_token 将通过参数传递，不在这里添加
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // 响应拦截器：统一错误处理和日志记录
    this.client.interceptors.response.use(
      (response) => {
        // 记录响应日志（生产环境可关闭）
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[WeiboClient] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`)
        }

        // 检查响应中是否包含错误
        if (response.data.error) {
          const error = response.data as WeiboError
          console.error(`[WeiboClient] API 错误: ${error.error_description} (${error.error_code})`)
          throw new Error(`微博 API 错误: ${error.error_description} (${error.error_code})`)
        }
        return response
      },
      (error: AxiosError) => {
        // 记录错误日志
        console.error(`[WeiboClient] 请求失败:`, {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          data: error.response?.data
        })

        // 处理 HTTP 错误
        if (error.response) {
          const status = error.response.status
          const data = error.response.data as any

          if (data?.error_code) {
            // 频率限制错误：返回特殊错误以便重试
            if (data.error_code === 21327 || status === 429) {
              const rateLimitError = new Error(`微博 API 错误: ${data.error_description || data.error} (${data.error_code})`)
              ;(rateLimitError as any).isRateLimit = true
              throw rateLimitError
            }
            throw new Error(`微博 API 错误: ${data.error_description || data.error} (${data.error_code})`)
          }

          switch (status) {
            case 400:
              throw new Error('请求参数错误')
            case 401:
              throw new Error('未授权，请检查 access_token')
            case 403:
              throw new Error('权限不足')
            case 404:
              throw new Error('接口不存在')
            case 429:
              throw new Error('请求频率过高，请稍后重试')
            case 500:
            case 502:
            case 503:
              throw new Error('微博服务器错误，请稍后重试')
            default:
              throw new Error(`请求失败: ${status}`)
          }
        } else if (error.request) {
          throw new Error('网络错误，请检查网络连接')
        } else {
          throw new Error(`请求配置错误: ${error.message}`)
        }
      }
    )
  }

  /**
   * GET 请求
   */
  async get<T = any>(url: string, params?: Record<string, any>): Promise<T> {
    const response = await this.client.get<T>(url, { params })
    return response.data
  }

  /**
   * POST 请求（表单格式）
   */
  async postForm<T = any>(url: string, data?: Record<string, any>): Promise<T> {
    const response = await this.client.post<T>(url, data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      transformRequest: [
        (data) => {
          const params = new URLSearchParams()
          if (data) {
            Object.keys(data).forEach((key) => {
              params.append(key, data[key])
            })
          }
          return params.toString()
        }
      ]
    })
    return response.data
  }

  /**
   * POST 请求（JSON 格式）
   */
  async post<T = any>(url: string, data?: Record<string, any>): Promise<T> {
    const response = await this.client.post<T>(url, data)
    return response.data
  }

  /**
   * 获取配置
   */
  getConfig(): WeiboConfig {
    return { ...this.config }
  }
}
