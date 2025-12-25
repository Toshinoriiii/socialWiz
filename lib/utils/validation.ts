import { z } from 'zod'

// 用户注册验证
export const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z
    .string()
    .min(8, '密码至少8位')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, '密码必须包含大小写字母和数字'),
  name: z.string().min(2, '用户名至少2个字符').max(20, '用户名最多20个字符')
})

// 用户登录验证
export const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '密码不能为空')
})

// 内容创建验证
export const createContentSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(100, '标题最多100字符'),
  content: z.string().min(1, '内容不能为空'),
  coverImage: z.string().url('封面图URL格式不正确').optional(),
  images: z.array(z.string().url('图片URL格式不正确')).optional(),
  selectedPlatforms: z.array(z.string()).min(1, '至少选择一个发布平台'),
  scheduledAt: z.string().datetime().optional()
})

// AI生成验证
export const aiGenerateSchema = z.object({
  prompt: z.string().min(1, '提示词不能为空').max(500, '提示词最多500字符'),
  template: z.string().optional(),
  model: z.enum(['deepseek', 'qwen', 'openai']).optional()
})

// 邮箱验证
export const isValidEmail = (email: string): boolean => {
  return z.string().email().safeParse(email).success
}

// URL验证
export const isValidUrl = (url: string): boolean => {
  return z.string().url().safeParse(url).success
}

// 验证助手函数
export const validateWithSchema = <T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: boolean; data?: T; errors?: Record<string, string> } => {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  const errors: Record<string, string> = {}
  result.error.issues.forEach((err) => {
    const path = err.path.join('.')
    errors[path] = err.message
  })
  
  return { success: false, errors }
}
