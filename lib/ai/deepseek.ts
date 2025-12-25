/**
 * DeepSeek AI集成
 * 官方文档: https://platform.deepseek.com/docs
 */

export interface DeepSeekConfig {
  apiKey: string
  baseURL?: string
  model?: string
}

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface DeepSeekOptions {
  messages: DeepSeekMessage[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export class DeepSeekClient {
  private apiKey: string
  private baseURL: string
  private model: string

  constructor(config: DeepSeekConfig) {
    this.apiKey = config.apiKey
    this.baseURL = config.baseURL || 'https://api.deepseek.com'
    this.model = config.model || 'deepseek-chat'
  }

  /**
   * 生成文本
   */
  async chat(options: DeepSeekOptions) {
    const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4000,
        stream: options.stream ?? false
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'DeepSeek API调用失败')
    }

    return await response.json()
  }

  /**
   * 流式生成
   */
  async *chatStream(options: DeepSeekOptions): AsyncGenerator<string, void, unknown> {
    const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4000,
        stream: true
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'DeepSeek API调用失败')
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
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const json = JSON.parse(data)
            const content = json.choices[0]?.delta?.content
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
 * DeepSeek AI集成
 * 官方文档: https://platform.deepseek.com/docs
 */

export interface DeepSeekConfig {
  apiKey: string
  baseURL?: string
  model?: string
}

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface DeepSeekOptions {
  messages: DeepSeekMessage[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export class DeepSeekClient {
  private apiKey: string
  private baseURL: string
  private model: string

  constructor(config: DeepSeekConfig) {
    this.apiKey = config.apiKey
    this.baseURL = config.baseURL || 'https://api.deepseek.com'
    this.model = config.model || 'deepseek-chat'
  }

  /**
   * 生成文本
   */
  async chat(options: DeepSeekOptions) {
    const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4000,
        stream: options.stream ?? false
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'DeepSeek API调用失败')
    }

    return await response.json()
  }

  /**
   * 流式生成
   */
  async *chatStream(options: DeepSeekOptions): AsyncGenerator<string, void, unknown> {
    const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4000,
        stream: true
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'DeepSeek API调用失败')
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
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const json = JSON.parse(data)
            const content = json.choices[0]?.delta?.content
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
