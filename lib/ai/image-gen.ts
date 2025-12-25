/**
 * AI图片生成集成
 * 支持DALL-E 3和Stable Diffusion
 */

export interface ImageGenOptions {
  prompt: string
  model?: 'dalle3' | 'sd'
  size?: '1024x1024' | '1792x1024' | '1024x1792'
  quality?: 'standard' | 'hd'
  style?: 'vivid' | 'natural'
  n?: number
}

export interface ImageGenResult {
  url: string
  revisedPrompt?: string
}

/**
 * 图片生成客户端
 */
export class ImageGenClient {
  /**
   * 生成图片
   */
  static async generate(options: ImageGenOptions): Promise<ImageGenResult[]> {
    const { model = 'dalle3' } = options

    if (model === 'dalle3') {
      return await this.generateWithDALLE3(options)
    } else if (model === 'sd') {
      return await this.generateWithSD(options)
    }

    throw new Error(`不支持的图片生成模型: ${model}`)
  }

  /**
   * 使用DALL-E 3生成图片
   */
  private static async generateWithDALLE3(
    options: ImageGenOptions
  ): Promise<ImageGenResult[]> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OpenAI API Key未配置')
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: options.prompt,
        size: options.size || '1024x1024',
        quality: options.quality || 'standard',
        style: options.style || 'vivid',
        n: options.n || 1
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'DALL-E 3生成失败')
    }

    const data = await response.json()
    
    return data.data.map((item: any) => ({
      url: item.url,
      revisedPrompt: item.revised_prompt
    }))
  }

  /**
   * 使用Stable Diffusion生成图片
   */
  private static async generateWithSD(
    options: ImageGenOptions
  ): Promise<ImageGenResult[]> {
    const apiKey = process.env.SD_API_KEY
    if (!apiKey) {
      throw new Error('Stable Diffusion API Key未配置')
    }

    // 这里是示例，实际需要根据具体的SD API接口调整
    const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        text_prompts: [
          {
            text: options.prompt,
            weight: 1
          }
        ],
        cfg_scale: 7,
        height: 1024,
        width: 1024,
        samples: options.n || 1,
        steps: 30
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Stable Diffusion生成失败')
    }

    const data = await response.json()
    
    return data.artifacts.map((artifact: any) => ({
      url: `data:image/png;base64,${artifact.base64}`
    }))
  }

  /**
   * 上传图片到云存储（可选）
   * 可以集成阿里云OSS、腾讯云COS等
   */
  static async uploadImage(base64: string): Promise<string> {
    // 这里是示例，实际需要实现真实的上传逻辑
    // 可以上传到OSS、COS或其他云存储服务
    
    // 临时返回base64数据URL
    return base64
  }
}
/**
 * AI图片生成集成
 * 支持DALL-E 3和Stable Diffusion
 */

export interface ImageGenOptions {
  prompt: string
  model?: 'dalle3' | 'sd'
  size?: '1024x1024' | '1792x1024' | '1024x1792'
  quality?: 'standard' | 'hd'
  style?: 'vivid' | 'natural'
  n?: number
}

export interface ImageGenResult {
  url: string
  revisedPrompt?: string
}

/**
 * 图片生成客户端
 */
export class ImageGenClient {
  /**
   * 生成图片
   */
  static async generate(options: ImageGenOptions): Promise<ImageGenResult[]> {
    const { model = 'dalle3' } = options

    if (model === 'dalle3') {
      return await this.generateWithDALLE3(options)
    } else if (model === 'sd') {
      return await this.generateWithSD(options)
    }

    throw new Error(`不支持的图片生成模型: ${model}`)
  }

  /**
   * 使用DALL-E 3生成图片
   */
  private static async generateWithDALLE3(
    options: ImageGenOptions
  ): Promise<ImageGenResult[]> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OpenAI API Key未配置')
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: options.prompt,
        size: options.size || '1024x1024',
        quality: options.quality || 'standard',
        style: options.style || 'vivid',
        n: options.n || 1
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'DALL-E 3生成失败')
    }

    const data = await response.json()
    
    return data.data.map((item: any) => ({
      url: item.url,
      revisedPrompt: item.revised_prompt
    }))
  }

  /**
   * 使用Stable Diffusion生成图片
   */
  private static async generateWithSD(
    options: ImageGenOptions
  ): Promise<ImageGenResult[]> {
    const apiKey = process.env.SD_API_KEY
    if (!apiKey) {
      throw new Error('Stable Diffusion API Key未配置')
    }

    // 这里是示例，实际需要根据具体的SD API接口调整
    const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        text_prompts: [
          {
            text: options.prompt,
            weight: 1
          }
        ],
        cfg_scale: 7,
        height: 1024,
        width: 1024,
        samples: options.n || 1,
        steps: 30
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Stable Diffusion生成失败')
    }

    const data = await response.json()
    
    return data.artifacts.map((artifact: any) => ({
      url: `data:image/png;base64,${artifact.base64}`
    }))
  }

  /**
   * 上传图片到云存储（可选）
   * 可以集成阿里云OSS、腾讯云COS等
   */
  static async uploadImage(base64: string): Promise<string> {
    // 这里是示例，实际需要实现真实的上传逻辑
    // 可以上传到OSS、COS或其他云存储服务
    
    // 临时返回base64数据URL
    return base64
  }
}
