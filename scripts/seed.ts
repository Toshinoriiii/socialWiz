/**
 * 数据库种子数据脚本
 * 用于初始化测试数据
 */

import { PrismaClient, Platform } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('开始填充种子数据...')

    // 1. 创建测试用户
    const hashedPassword = await bcrypt.hash('Test@123456', 10)
    const user = await prisma.user.upsert({
      where: { email: 'test@socialwiz.com' },
      update: {},
      create: {
        email: 'test@socialwiz.com',
        password: hashedPassword,
        name: '测试用户',
        avatar: null
      }
    })
    console.log('✓ 创建测试用户:', user.email)

    // 2. 创建平台账号
    const platforms: Platform[] = ['WECHAT', 'WEIBO', 'DOUYIN', 'XIAOHONGSHU']
    
    for (const platform of platforms) {
      const account = await prisma.platformAccount.upsert({
        where: {
          userId_platform_platformUserId: {
            userId: user.id,
            platform,
            platformUserId: `test_${platform.toLowerCase()}_id`
          }
        },
        update: {},
        create: {
          userId: user.id,
          platform,
          platformUserId: `test_${platform.toLowerCase()}_id`,
          platformUsername: `测试${platform}账号`,
          accessToken: 'test_access_token',
          refreshToken: 'test_refresh_token',
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90天后过期
        }
      })
      console.log(`✓ 创建${platform}平台账号`)
    }

    // 3. 创建示例内容
    const platformAccounts = await prisma.platformAccount.findMany({
      where: { userId: user.id }
    })

    const contents = [
      {
        title: '欢迎使用SocialWiz',
        content: '这是一个多智能体社交媒体统一管理平台的示例内容。支持多平台发布、AI内容生成和数据分析。',
        coverImage: null
      },
      {
        title: 'AI驱动的内容创作',
        content: 'SocialWiz集成了DeepSeek、Qwen等多种AI模型,帮助您轻松生成高质量内容。',
        coverImage: null
      },
      {
        title: '多平台一键发布',
        content: '支持微信公众号、微博、抖音、小红书等多个平台,一键发布到所有平台。',
        coverImage: null
      }
    ]

    for (const contentData of contents) {
      const content = await prisma.content.create({
        data: {
          ...contentData,
          userId: user.id,
          status: 'DRAFT',
          contentPlatforms: {
            create: platformAccounts.slice(0, 2).map(pa => ({
              platformAccountId: pa.id,
              publishStatus: 'PENDING'
            }))
          }
        }
      })
      console.log(`✓ 创建示例内容: ${content.title}`)
    }

    console.log('\n✓ 种子数据填充完成!')
    console.log('\n测试账号信息:')
    console.log('  邮箱: test@socialwiz.com')
    console.log('  密码: Test@123456')
  } catch (error) {
    console.error('填充种子数据失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
