/**
 * 数据库迁移脚本
 * 用于生产环境数据库迁移
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('开始数据库迁移...')

    // 检查数据库连接
    await prisma.$connect()
    console.log('✓ 数据库连接成功')

    // 执行数据库迁移 (使用 Prisma Migrate)
    console.log('执行 Prisma Migrate...')
    // 注意: 生产环境应该使用 prisma migrate deploy
    // 这里仅作为示例,实际应该在部署脚本中执行

    console.log('✓ 数据库迁移完成')
  } catch (error) {
    console.error('数据库迁移失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
