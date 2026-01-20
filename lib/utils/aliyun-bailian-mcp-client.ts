// lib/utils/aliyun-bailian-mcp-client.ts

import axios, { AxiosInstance, AxiosError } from 'axios'
import type { SearchResults, GeneratedImage } from '@/types/content-generation.types'

/**
 * 阿里云百炼 MCP 客户端配置
 */
interface MCPClientConfig {
  apiKey: string
  searchUrl: string
  imageUrl: string
  timeout?: number
}

/**
 * 搜索请求参数
 */
interface SearchRequest {
  query: string
  maxResults?: number
}

/**
 * 生图请求参数
 */
interface ImageGenerationRequest {
  prompt: string
  aspectRatio?: '1:1' | '16:9' | '9:16'
  style?: string
}

/**
 * 阿里云百炼 MCP 客户端错误
 */
export class MCPClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: any
  ) {
    super(message)
    this.name = 'MCPClientError'
  }
}

/**
 * 阿里云百炼 MCP 客户端
 * 通过 HTTP API 调用远程部署的 MCP 服务
 */
export class AliyunBailianMCPClient {
  private client: AxiosInstance
  private config: MCPClientConfig

  constructor(config: MCPClientConfig) {
    this.config = {
      timeout: 30000, // 默认 30 秒超时
      ...config,
    }

    this.client = axios.create({
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
    })
  }

  /**
   * 执行搜索
   */
  async search(request: SearchRequest): Promise<SearchResults> {
    try {
      const response = await this.client.post<SearchResults>(
        this.config.searchUrl,
        {
          query: request.query,
          max_results: request.maxResults || 10,
        }
      )

      return response.data
    } catch (error) {
      throw this.handleError(error, 'Search')
    }
  }

  /**
   * 生成图片
   */
  async generateImage(request: ImageGenerationRequest): Promise<GeneratedImage> {
    try {
      const response = await this.client.post<GeneratedImage>(
        this.config.imageUrl,
        {
          prompt: request.prompt,
          aspect_ratio: request.aspectRatio || '1:1',
          style: request.style,
        }
      )

      return response.data
    } catch (error) {
      throw this.handleError(error, 'ImageGeneration')
    }
  }

  /**
   * 统一错误处理
   */
  private handleError(error: unknown, operation: string): MCPClientError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError
      const statusCode = axiosError.response?.status
      const message = axiosError.response?.data
        ? JSON.stringify(axiosError.response.data)
        : axiosError.message

      if (statusCode === 401) {
        return new MCPClientError(
          `${operation} failed: Authentication failed. Please check your API key.`,
          statusCode,
          error
        )
      }

      if (statusCode === 429) {
        return new MCPClientError(
          `${operation} failed: Rate limit exceeded. Please try again later.`,
          statusCode,
          error
        )
      }

      if (statusCode === 503) {
        return new MCPClientError(
          `${operation} failed: Service unavailable. Please try again later.`,
          statusCode,
          error
        )
      }

      if (axiosError.code === 'ECONNABORTED') {
        return new MCPClientError(
          `${operation} failed: Request timeout.`,
          undefined,
          error
        )
      }

      return new MCPClientError(
        `${operation} failed: ${message}`,
        statusCode,
        error
      )
    }

    return new MCPClientError(
      `${operation} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      error
    )
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      // 尝试一个简单的搜索请求来验证服务可用性
      await this.search({ query: 'test', maxResults: 1 })
      return true
    } catch (error) {
      console.error('MCP health check failed:', error)
      return false
    }
  }
}

/**
 * 创建 MCP 客户端实例
 */
export function createMCPClient(): AliyunBailianMCPClient {
  const apiKey = process.env.ALIYUN_BAILIAN_MCP_API_KEY
  const searchUrl = process.env.ALIYUN_BAILIAN_MCP_SEARCH_URL
  const imageUrl = process.env.ALIYUN_BAILIAN_MCP_IMAGE_URL
  const timeout = process.env.ALIYUN_BAILIAN_MCP_TIMEOUT
    ? parseInt(process.env.ALIYUN_BAILIAN_MCP_TIMEOUT, 10)
    : undefined

  if (!apiKey || !searchUrl || !imageUrl) {
    throw new Error(
      'Missing required MCP configuration. Please set ALIYUN_BAILIAN_MCP_API_KEY, ALIYUN_BAILIAN_MCP_SEARCH_URL, and ALIYUN_BAILIAN_MCP_IMAGE_URL environment variables.'
    )
  }

  return new AliyunBailianMCPClient({
    apiKey,
    searchUrl,
    imageUrl,
    timeout,
  })
}
