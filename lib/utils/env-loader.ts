/**
 * 环境变量加载工具
 * 统一使用 .env.local 文件
 */
import { config } from 'dotenv'
import { resolve } from 'path'

// 加载 .env.local 文件
config({ path: resolve(process.cwd(), '.env.local') })

// 如果 .env.local 不存在，尝试加载 .env（向后兼容）
if (!process.env.DATABASE_URL) {
  config({ path: resolve(process.cwd(), '.env') })
}
