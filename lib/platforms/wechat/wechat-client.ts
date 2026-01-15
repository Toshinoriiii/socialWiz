/**
 * 微信公众号 API 客户端
 * 
 * 封装微信公众号 API 的 HTTP 请求，提供统一的错误处理和日志记录。
 * 支持 OAuth 2.0 Token 获取、用户信息获取等功能。
 * 
 * @example
 * ```typescript
 * const client = new WechatClient({
 *   appId: 'your_app_id',
 *   appSecret: 'your_app_secret',
 *   redirectUri: 'http://localhost:3000/callback'
 * })
 * 
 * const tokenInfo = await client.getAccessToken(code)
 * const userInfo = await client.getUserInfo(tokenInfo.access_token, tokenInfo.openid)
 * ```
 */

export class WechatClient {
  private client: AxiosInstance
  private config: WechatConfig

  constructor(config: WechatConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || 'https://api.weixin.qq.com'
    }

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // 请求拦截器：记录请求日志
    this.client.interceptors.request.use(
      (config) => {
        // 记录请求日志（生产环境可关闭）
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[WechatClient] ${config.method?.toUpperCase()} ${config.url}`)
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // 响应拦截器：统一错误处理和日志记录
    this.client.interceptors.response.use(
      (response) => {
        // 记录响应日志
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[WechatClient] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`)
        }

        // 检查微信 API 错误响应
        const data = response.data
        if (isWechatError(data) && !isWechatSuccess(data)) {
          const errorMsg = getWechatErrorMessage(data)
          console.error(`[WechatClient] API 错误: ${errorMsg} (${data.errcode})`)
          throw new Error(errorMsg)
        }

        return response
      },
      (error: AxiosError) => {
        // 记录错误日志
        console.error(`[WechatClient] 请求失败:`, {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          data: error.response?.data
        })

        // 处理 HTTP 错误
        if (error.response) {
          const status = error.response.status
          const data = error.response.data as any

          // 检查是否为微信错误格式
          if (isWechatError(data)) {
            const errorMsg = getWechatErrorMessage(data)
            // 频率限制错误：标记以便重试
            if (data.errcode === 45009 || data.errcode === 45011) {
              const rateLimitError = new Error(errorMsg)
              ;(rateLimitError as any).isRateLimit = true
              ;(rateLimitError as any).retryAfter = 60 // 建议 60 秒后重试
              console.warn(`[WechatClient] 频率限制错误: ${errorMsg}, 建议 ${(rateLimitError as any).retryAfter} 秒后重试`)
              throw rateLimitError
            }
            // Token 错误：标记以便重新授权
            if (data.errcode === 40001 || data.errcode === 40014) {
              const tokenError = new Error(errorMsg)
              ;(tokenError as any).isTokenError = true
              console.error(`[WechatClient] Token 错误: ${errorMsg}`)
              throw tokenError
            }
            console.error(`[WechatClient] API 错误: ${errorMsg} (${data.errcode})`)
            throw new Error(errorMsg)
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
              throw new Error('微信服务器错误，请稍后重试')
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
   * 
   * @param url API 路径（相对于 baseURL）
   * @param params 查询参数
   * @returns 响应数据
   */
  async get<T = any>(url: string, params?: Record<string, any>): Promise<T> {
    const response = await this.client.get<T>(url, { params })
    return response.data
  }

  /**
   * POST 请求（JSON）
   * 
   * @param url API 路径（相对于 baseURL）
   * @param data 请求体数据
   * @returns 响应数据
   */
  async post<T = any>(url: string, data?: any): Promise<T> {
    const response = await this.client.post<T>(url, data)
    return response.data
  }

  /**
   * POST 请求（表单）
   * 
   * @param url API 路径（相对于 baseURL）
   * @param data 表单数据
   * @returns 响应数据
   */
  async postForm<T = any>(url: string, data?: Record<string, any>): Promise<T> {
    const formData = new URLSearchParams()
    if (data) {
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value))
        }
      })
    }

    const response = await this.client.post<T>(url, formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
    return response.data
  }

  /**
   * 获取 Access Token
   * 
   * 使用 OAuth 2.0 授权码换取 access_token。
   * 
   * @param code OAuth 2.0 授权码
   * @returns Token 信息，包含 access_token、expires_in、openid 等
   * @throws 如果授权码无效或已过期，抛出错误
   */
  async getAccessToken(code: string): Promise<WechatTokenInfo> {
    const response = await this.postForm<WechatTokenInfo>('/sns/oauth2/access_token', {
      appid: this.config.appId,
      secret: this.config.appSecret,
      code,
      grant_type: 'authorization_code'
    })
    return response
  }

  /**
   * 刷新 Access Token
   * 
   * 使用 refresh_token 刷新 access_token（如果微信支持）。
   * 注意：需要根据微信 API 文档确认是否支持 refresh_token。
   * 
   * @param refreshToken 刷新令牌
   * @returns 新的 Token 信息
   * @throws 如果 refresh_token 无效或微信不支持，抛出错误
   */
  async refreshAccessToken(refreshToken: string): Promise<WechatTokenInfo> {
    const response = await this.postForm<WechatTokenInfo>('/sns/oauth2/refresh_token', {
      appid: this.config.appId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
    return response
  }

  /**
   * 获取用户信息
   * 
   * 通过 access_token 和 openid 获取微信公众号用户信息。
   * 
   * @param accessToken 访问令牌
   * @param openid 用户唯一标识
   * @returns 用户信息，包含 openid、nickname、headimgurl 等
   * @throws 如果 access_token 无效或 openid 不匹配，抛出错误
   */
  async getUserInfo(accessToken: string, openid: string): Promise<WechatUserInfo> {
    const response = await this.get<WechatUserInfo>('/sns/userinfo', {
      access_token: accessToken,
      openid,
      lang: 'zh_CN'
    })
    return response
  }

  /**
   * 发布内容
   * 
   * 注意：具体接口需要根据微信 API 文档确定（T019 任务）。
   * 这里提供一个基础框架，实际实现需要根据微信的具体 API 调整。
   * 
   * @param accessToken 访问令牌
   * @param content 发布内容
   * @returns 发布结果
   * @throws 如果发布失败，抛出错误
   */
  async publish(accessToken: string, content: any): Promise<any> {
    // TODO: 根据微信 API 文档实现具体的发布接口（T019 任务）
    // 可能是群发消息接口或素材管理接口
    console.warn('[WechatClient] 发布接口待实现，需要根据微信 API 文档确定具体接口')
    throw new Error('发布接口待实现，需要根据微信 API 文档确定具体接口')
  }
}
