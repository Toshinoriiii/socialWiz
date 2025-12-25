export interface AIModelConfig {
  name: string
  provider: string
  apiKey: string
  baseURL?: string
  maxTokens: number
  temperature: number
}

export interface AITemplate {
  id: number
  name: string
  description: string
  prompt: string
}

export const AI_MODELS = {
  DEEPSEEK: 'deepseek',
  QWEN: 'qwen',
  OPENAI: 'openai'
} as const

export const AI_TEMPLATES: AITemplate[] = [
  {
    id: 1,
    name: '产品推广',
    description: '突出产品特点和优势',
    prompt: '创作一篇产品推广文案，突出产品的核心特点和竞争优势，吸引用户购买'
  },
  {
    id: 2,
    name: '活动宣传',
    description: '吸引用户参与活动',
    prompt: '撰写一篇活动宣传文案，强调活动亮点和参与价值，引导用户积极参与'
  },
  {
    id: 3,
    name: '节日祝福',
    description: '温馨的节日问候',
    prompt: '创作一段温馨的节日祝福文案，传递品牌温度和节日氛围'
  },
  {
    id: 4,
    name: '知识分享',
    description: '专业领域的干货内容',
    prompt: '撰写一篇专业知识分享文章，深入浅出，提供实用的干货内容'
  },
  {
    id: 5,
    name: '用户故事',
    description: '真实案例，情感共鸣',
    prompt: '讲述一个真实的用户故事或案例，引发情感共鸣，增强品牌认同'
  },
  {
    id: 6,
    name: '行业资讯',
    description: '客观报道，快速传递信息',
    prompt: '撰写一篇行业资讯或新闻快讯，客观准确，快速传递重要信息'
  }
]

export const getAIModelConfig = (model: string): Partial<AIModelConfig> => {
  switch (model) {
    case AI_MODELS.DEEPSEEK:
      return {
        name: 'DeepSeek V3',
        provider: 'DeepSeek',
        apiKey: process.env.DEEPSEEK_API_KEY || '',
        baseURL: 'https://api.deepseek.com',
        maxTokens: 4000,
        temperature: 0.7
      }
    case AI_MODELS.QWEN:
      return {
        name: 'Qwen',
        provider: 'Alibaba Cloud',
        apiKey: process.env.QWEN_API_KEY || '',
        baseURL: 'https://dashscope.aliyuncs.com/api/v1',
        maxTokens: 2000,
        temperature: 0.7
      }
    case AI_MODELS.OPENAI:
      return {
        name: 'GPT-4',
        provider: 'OpenAI',
        apiKey: process.env.OPENAI_API_KEY || '',
        baseURL: 'https://api.openai.com/v1',
        maxTokens: 4000,
        temperature: 0.7
      }
    default:
      return {}
  }
}
export interface AIModelConfig {
  name: string
  provider: string
  apiKey: string
  baseURL?: string
  maxTokens: number
  temperature: number
}

export interface AITemplate {
  id: number
  name: string
  description: string
  prompt: string
}

export const AI_MODELS = {
  DEEPSEEK: 'deepseek',
  QWEN: 'qwen',
  OPENAI: 'openai'
} as const

export const AI_TEMPLATES: AITemplate[] = [
  {
    id: 1,
    name: '产品推广',
    description: '突出产品特点和优势',
    prompt: '创作一篇产品推广文案，突出产品的核心特点和竞争优势，吸引用户购买'
  },
  {
    id: 2,
    name: '活动宣传',
    description: '吸引用户参与活动',
    prompt: '撰写一篇活动宣传文案，强调活动亮点和参与价值，引导用户积极参与'
  },
  {
    id: 3,
    name: '节日祝福',
    description: '温馨的节日问候',
    prompt: '创作一段温馨的节日祝福文案，传递品牌温度和节日氛围'
  },
  {
    id: 4,
    name: '知识分享',
    description: '专业领域的干货内容',
    prompt: '撰写一篇专业知识分享文章，深入浅出，提供实用的干货内容'
  },
  {
    id: 5,
    name: '用户故事',
    description: '真实案例，情感共鸣',
    prompt: '讲述一个真实的用户故事或案例，引发情感共鸣，增强品牌认同'
  },
  {
    id: 6,
    name: '行业资讯',
    description: '客观报道，快速传递信息',
    prompt: '撰写一篇行业资讯或新闻快讯，客观准确，快速传递重要信息'
  }
]

export const getAIModelConfig = (model: string): Partial<AIModelConfig> => {
  switch (model) {
    case AI_MODELS.DEEPSEEK:
      return {
        name: 'DeepSeek V3',
        provider: 'DeepSeek',
        apiKey: process.env.DEEPSEEK_API_KEY || '',
        baseURL: 'https://api.deepseek.com',
        maxTokens: 4000,
        temperature: 0.7
      }
    case AI_MODELS.QWEN:
      return {
        name: 'Qwen',
        provider: 'Alibaba Cloud',
        apiKey: process.env.QWEN_API_KEY || '',
        baseURL: 'https://dashscope.aliyuncs.com/api/v1',
        maxTokens: 2000,
        temperature: 0.7
      }
    case AI_MODELS.OPENAI:
      return {
        name: 'GPT-4',
        provider: 'OpenAI',
        apiKey: process.env.OPENAI_API_KEY || '',
        baseURL: 'https://api.openai.com/v1',
        maxTokens: 4000,
        temperature: 0.7
      }
    default:
      return {}
  }
}
