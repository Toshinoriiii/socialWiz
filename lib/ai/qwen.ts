/**
 * Qwen (通义千问) AI集成
 * 官方文档: https://help.aliyun.com/zh/dashscope/
 */

export interface QwenConfig {
  apiKey: string
  baseURL?: string
  model?: string
}

export interface QwenMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface QwenOptions {
  messages: QwenMessage[]
  temperature?: number
  maxTokens?: number
}

export class QwenClient {
  private apiKey: string
  private baseURL: string
  private model: string

  constructor(config: QwenConfig) {
    this.apiKey = config.apiKey
    this.baseURL = config.baseURL || 'https://dashscope.aliyuncs.com/api'
    this.model = config.model || 'qwen-turbo'
  }

  /**
   * 生成文本
   */
  async chat(options: QwenOptions) {
    const response = await fetch(
      `${this.baseURL}/v1/services/aigc/text-generation/generation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          input: {
            messages: options.messages
          },
          parameters: {
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 4000,
            result_format: 'message'
          }
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Qwen API调用失败')
    }

    return await response.json()
  }

  /**
   * 流式生成
   */
  async *chatStream(options: QwenOptions): AsyncGenerator<string, void, unknown> {
    const response = await fetch(
      `${this.baseURL}/v1/services/aigc/text-generation/generation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-DashScope-SSE': 'enable'
        },
        body: JSON.stringify({
          model: this.model,
          input: {
            messages: options.messages
          },
          parameters: {
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 4000,
            result_format: 'message',
            incremental_output: true
          }
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Qwen API调用失败')
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应流')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim()
          
          try {
            const json = JSON.parse(data)
            const content = json.output?.choices?.[0]?.message?.content
            if (content) {
              yield content
            }
          } catch (e) {
            console.error('解析SSE数据失败:', e)
          }
        }
      }
    }
  }
}
/**
 * Qwen (通义千问) AI集成
 * 官方文档: https://help.aliyun.com/zh/dashscope/
 */

export interface QwenConfig {
  apiKey: string
  baseURL?: string
  model?: string
}

export interface QwenMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface QwenOptions {
  messages: QwenMessage[]
  temperature?: number
  maxTokens?: number
}

export class QwenClient {
  private apiKey: string
  private baseURL: string
  private model: string

  constructor(config: QwenConfig) {
    this.apiKey = config.apiKey
    this.baseURL = config.baseURL || 'https://dashscope.aliyuncs.com/api'
    this.model = config.model || 'qwen-turbo'
  }

  /**
   * 生成文本
   */
  async chat(options: QwenOptions) {
    const response = await fetch(
      `${this.baseURL}/v1/services/aigc/text-generation/generation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          input: {
            messages: options.messages
          },
          parameters: {
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 4000,
            result_format: 'message'
          }
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Qwen API调用失败')
    }

    return await response.json()
  }

  /**
   * 流式生成
   */
  async *chatStream(options: QwenOptions): AsyncGenerator<string, void, unknown> {
    const response = await fetch(
      `${this.baseURL}/v1/services/aigc/text-generation/generation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-DashScope-SSE': 'enable'
        },
        body: JSON.stringify({
          model: this.model,
          input: {
            messages: options.messages
          },
          parameters: {
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 4000,
            result_format: 'message',
            incremental_output: true
          }
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Qwen API调用失败')
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应流')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim()
          
          try {
            const json = JSON.parse(data)
            const content = json.output?.choices?.[0]?.message?.content
            if (content) {
              yield content
            }
          } catch (e) {
            console.error('解析SSE数据失败:', e)
          }
        }
      }
    }
  }
}
