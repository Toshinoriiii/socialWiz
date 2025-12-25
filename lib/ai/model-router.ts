import { AI_MODELS, getAIModelConfig } from '@/config/ai.config'

export interface AIGenerateOptions {
  prompt: string
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface AIGenerateResult {
  content: string
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * AI模型路由器
 * 根据指定的模型类型，路由到对应的AI服务
 */
export class AIModelRouter {
  /**
   * 生成文本内容
   */
  static async generateText(options: AIGenerateOptions): Promise<AIGenerateResult> {
    const { model = AI_MODELS.DEEPSEEK, prompt, temperature, maxTokens } = options
    
    const config = getAIModelConfig(model)
    
    if (!config.apiKey) {
      throw new Error(`${config.name} API Key未配置`)
    }

    try {
      // 根据不同的模型调用不同的服务
      switch (model) {
        case AI_MODELS.DEEPSEEK:
          return await this.callDeepSeek(prompt, config, temperature, maxTokens)
        
        case AI_MODELS.QWEN:
          return await this.callQwen(prompt, config, temperature, maxTokens)
        
        case AI_MODELS.OPENAI:
          return await this.callOpenAI(prompt, config, temperature, maxTokens)
        
        default:
          throw new Error(`不支持的AI模型: ${model}`)
      }
    } catch (error) {
      console.error(`AI生成失败 (${model}):`, error)
      throw error
    }
  }

  /**
   * 调用DeepSeek API
   */
  private static async callDeepSeek(
    prompt: string,
    config: any,
    temperature?: number,
    maxTokens?: number
  ): Promise<AIGenerateResult> {
    const response = await fetch(`${config.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的内容创作助手，擅长撰写各类社交媒体文案。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: temperature ?? config.temperature,
        max_tokens: maxTokens ?? config.maxTokens
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'DeepSeek API调用失败')
    }

    const data = await response.json()
    
    return {
      content: data.choices[0].message.content,
      model: AI_MODELS.DEEPSEEK,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined
    }
  }

  /**
   * 调用Qwen API
   */
  private static async callQwen(
    prompt: string,
    config: any,
    temperature?: number,
    maxTokens?: number
  ): Promise<AIGenerateResult> {
    const response = await fetch(`${config.baseURL}/v1/services/aigc/text-generation/generation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: 'qwen-turbo',
        input: {
          messages: [
            {
              role: 'system',
              content: '你是一个专业的内容创作助手，擅长撰写各类社交媒体文案。'
            },
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        parameters: {
          temperature: temperature ?? config.temperature,
          max_tokens: maxTokens ?? config.maxTokens
        }
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Qwen API调用失败')
    }

    const data = await response.json()
    
    return {
      content: data.output.choices[0].message.content,
      model: AI_MODELS.QWEN,
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined
    }
  }

  /**
   * 调用OpenAI API
   */
  private static async callOpenAI(
    prompt: string,
    config: any,
    temperature?: number,
    maxTokens?: number
  ): Promise<AIGenerateResult> {
    const response = await fetch(`${config.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的内容创作助手，擅长撰写各类社交媒体文案。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: temperature ?? config.temperature,
        max_tokens: maxTokens ?? config.maxTokens
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'OpenAI API调用失败')
    }

    const data = await response.json()
    
    return {
      content: data.choices[0].message.content,
      model: AI_MODELS.OPENAI,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined
    }
  }

  /**
   * 流式生成文本（用于实时显示）
   */
  static async *generateTextStream(
    options: AIGenerateOptions
  ): AsyncGenerator<string, void, unknown> {
    const { model = AI_MODELS.DEEPSEEK, prompt } = options
    const config = getAIModelConfig(model)
    
    if (!config.apiKey) {
      throw new Error(`${config.name} API Key未配置`)
    }

    // 这里简化处理，实际应该根据不同模型使用不同的流式API
    const result = await this.generateText(options)
    
    // 模拟流式输出
    const words = result.content.split('')
    for (const word of words) {
      yield word
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }
}
import { AI_MODELS, getAIModelConfig } from '@/config/ai.config'

export interface AIGenerateOptions {
  prompt: string
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface AIGenerateResult {
  content: string
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * AI模型路由器
 * 根据指定的模型类型，路由到对应的AI服务
 */
export class AIModelRouter {
  /**
   * 生成文本内容
   */
  static async generateText(options: AIGenerateOptions): Promise<AIGenerateResult> {
    const { model = AI_MODELS.DEEPSEEK, prompt, temperature, maxTokens } = options
    
    const config = getAIModelConfig(model)
    
    if (!config.apiKey) {
      throw new Error(`${config.name} API Key未配置`)
    }

    try {
      // 根据不同的模型调用不同的服务
      switch (model) {
        case AI_MODELS.DEEPSEEK:
          return await this.callDeepSeek(prompt, config, temperature, maxTokens)
        
        case AI_MODELS.QWEN:
          return await this.callQwen(prompt, config, temperature, maxTokens)
        
        case AI_MODELS.OPENAI:
          return await this.callOpenAI(prompt, config, temperature, maxTokens)
        
        default:
          throw new Error(`不支持的AI模型: ${model}`)
      }
    } catch (error) {
      console.error(`AI生成失败 (${model}):`, error)
      throw error
    }
  }

  /**
   * 调用DeepSeek API
   */
  private static async callDeepSeek(
    prompt: string,
    config: any,
    temperature?: number,
    maxTokens?: number
  ): Promise<AIGenerateResult> {
    const response = await fetch(`${config.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的内容创作助手，擅长撰写各类社交媒体文案。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: temperature ?? config.temperature,
        max_tokens: maxTokens ?? config.maxTokens
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'DeepSeek API调用失败')
    }

    const data = await response.json()
    
    return {
      content: data.choices[0].message.content,
      model: AI_MODELS.DEEPSEEK,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined
    }
  }

  /**
   * 调用Qwen API
   */
  private static async callQwen(
    prompt: string,
    config: any,
    temperature?: number,
    maxTokens?: number
  ): Promise<AIGenerateResult> {
    const response = await fetch(`${config.baseURL}/v1/services/aigc/text-generation/generation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: 'qwen-turbo',
        input: {
          messages: [
            {
              role: 'system',
              content: '你是一个专业的内容创作助手，擅长撰写各类社交媒体文案。'
            },
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        parameters: {
          temperature: temperature ?? config.temperature,
          max_tokens: maxTokens ?? config.maxTokens
        }
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Qwen API调用失败')
    }

    const data = await response.json()
    
    return {
      content: data.output.choices[0].message.content,
      model: AI_MODELS.QWEN,
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined
    }
  }

  /**
   * 调用OpenAI API
   */
  private static async callOpenAI(
    prompt: string,
    config: any,
    temperature?: number,
    maxTokens?: number
  ): Promise<AIGenerateResult> {
    const response = await fetch(`${config.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的内容创作助手，擅长撰写各类社交媒体文案。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: temperature ?? config.temperature,
        max_tokens: maxTokens ?? config.maxTokens
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'OpenAI API调用失败')
    }

    const data = await response.json()
    
    return {
      content: data.choices[0].message.content,
      model: AI_MODELS.OPENAI,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined
    }
  }

  /**
   * 流式生成文本（用于实时显示）
   */
  static async *generateTextStream(
    options: AIGenerateOptions
  ): AsyncGenerator<string, void, unknown> {
    const { model = AI_MODELS.DEEPSEEK, prompt } = options
    const config = getAIModelConfig(model)
    
    if (!config.apiKey) {
      throw new Error(`${config.name} API Key未配置`)
    }

    // 这里简化处理，实际应该根据不同模型使用不同的流式API
    const result = await this.generateText(options)
    
    // 模拟流式输出
    const words = result.content.split('')
    for (const word of words) {
      yield word
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }
}
