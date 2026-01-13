/**
 * 查看数据库数据脚本
 * 用于快速查看数据库中的数据
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('📊 数据库数据概览\n')

    // 1. 用户数据
    const userCount = await prisma.user.count()
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true
      },
      take: 10
    })
    console.log(`👤 用户总数: ${userCount}`)
    if (users.length > 0) {
      console.log('前10个用户:')
      users.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.name} (${user.email}) - ${user.createdAt.toLocaleString('zh-CN')}`)
      })
    }
    console.log('')

    // 2. 平台账号数据
    const platformAccountCount = await prisma.platformAccount.count()
    const platformAccounts = await prisma.platformAccount.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      take: 10
    })
    console.log(`🔗 平台账号总数: ${platformAccountCount}`)
    if (platformAccounts.length > 0) {
      console.log('前10个平台账号:')
      platformAccounts.forEach((account, index) => {
        console.log(`  ${index + 1}. ${account.platform} - ${account.platformUsername} (用户: ${account.user.name})`)
      })
    }
    console.log('')

    // 3. 内容数据
    const contentCount = await prisma.content.count()
    const contents = await prisma.content.findMany({
      include: {
        user: {
          select: {
            name: true
          }
        }
      },
      take: 10,
      orderBy: {
        createdAt: 'desc'
      }
    })
    console.log(`📝 内容总数: ${contentCount}`)
    if (contents.length > 0) {
      console.log('最新10条内容:')
      contents.forEach((content, index) => {
        console.log(`  ${index + 1}. [${content.status}] ${content.title} (作者: ${content.user.name})`)
        console.log(`     创建时间: ${content.createdAt.toLocaleString('zh-CN')}`)
      })
    }
    console.log('')

    // 4. AI生成记录
    const aiLogCount = await prisma.aIGenerationLog.count()
    const aiLogs = await prisma.aIGenerationLog.findMany({
      include: {
        user: {
          select: {
            name: true
          }
        }
      },
      take: 5,
      orderBy: {
        createdAt: 'desc'
      }
    })
    console.log(`🤖 AI生成记录总数: ${aiLogCount}`)
    if (aiLogs.length > 0) {
      console.log('最新5条AI生成记录:')
      aiLogs.forEach((log, index) => {
        console.log(`  ${index + 1}. [${log.type}] ${log.model} (用户: ${log.user.name})`)
        console.log(`     时间: ${log.createdAt.toLocaleString('zh-CN')}`)
        console.log(`     提示词: ${log.prompt.substring(0, 50)}...`)
      })
    }
    console.log('')

    // 5. 发布状态统计
    const publishStats = await prisma.contentPlatform.groupBy({
      by: ['publishStatus'],
      _count: {
        id: true
      }
    })
    console.log('📤 发布状态统计:')
    publishStats.forEach(stat => {
      console.log(`  ${stat.publishStatus}: ${stat._count.id} 条`)
    })

  } catch (error) {
    console.error('❌ 查看数据失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
