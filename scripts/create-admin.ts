/**
 * 创建管理员账号脚本
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('正在创建管理员账号...')

    const adminHashedPassword = await bcrypt.hash('admin123', 10)
    
    const admin = await prisma.user.upsert({
      where: { email: 'admin@admin.com' },
      update: {
        password: adminHashedPassword,
        name: '管理员'
      },
      create: {
        email: 'admin@admin.com',
        password: adminHashedPassword,
        name: '管理员',
        avatar: null
      }
    })

    console.log('\n✓ 管理员账号创建成功!')
    console.log('\n管理员账号信息:')
    console.log('  邮箱: admin@admin.com')
    console.log('  密码: admin123')
    console.log(`  用户ID: ${admin.id}`)
    
  } catch (error) {
    console.error('❌ 创建管理员账号失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
