'use client'

import React from 'react'
import Link from 'next/link'
import {
  FileTextOutlined,
  UserOutlined,
  EyeOutlined,
  HeartOutlined,
  PlusOutlined
} from '@ant-design/icons'
import { Button } from '@/components/ui'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { ContentGrid } from '@/components/dashboard/ContentGrid'
import styles from './page.module.css'

// 模拟数据
const statsData = [
  {
    title: '总内容数',
    value: '128',
    change: 12,
    trend: 'up' as const,
    icon: <FileTextOutlined />
  },
  {
    title: '总粉丝数',
    value: '12.5K',
    change: 8,
    trend: 'up' as const,
    icon: <UserOutlined />
  },
  {
    title: '总阅读量',
    value: '98.2K',
    change: 15,
    trend: 'up' as const,
    icon: <EyeOutlined />
  },
  {
    title: '互动率',
    value: '5.8%',
    change: 3,
    trend: 'down' as const,
    icon: <HeartOutlined />
  }
]

const recentContent = [
  {
    id: '1',
    title: '如何使用AI工具提升工作效率',
    coverImage: 'https://ai-public.mastergo.com/ai/img_res/53dbc71c3ee165ca1fb15d8a5ba05e09.jpg',
    createdAt: new Date('2024-01-15'),
    platforms: ['微信', '微博'],
    status: 'PUBLISHED'
  },
  {
    id: '2',
    title: '2024年社交媒体营销趋势分析',
    coverImage: 'https://ai-public.mastergo.com/ai/img_res/c1d67fa560a2cd8c8c9f0f82f8831c3e.jpg',
    createdAt: new Date('2024-01-14'),
    platforms: ['小红书', '抖音'],
    status: 'SCHEDULED'
  },
  {
    id: '3',
    title: '内容创作者必备的10个工具',
    createdAt: new Date('2024-01-13'),
    platforms: ['微信'],
    status: 'DRAFT'
  },
  {
    id: '4',
    title: '打造个人品牌的5个关键步骤',
    coverImage: 'https://ai-public.mastergo.com/ai/img_res/2d7da9c1dcae6ceb2e2f0ed6f8e90fb3.jpg',
    createdAt: new Date('2024-01-12'),
    platforms: ['微博', '小红书'],
    status: 'PUBLISHED'
  }
]

export default function DashboardPage() {
  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>数据概览</h1>
          <p className={styles.subtitle}>查看您的内容表现和统计数据</p>
        </div>
        <Link href="/publish">
          <Button icon={<PlusOutlined />} size="lg">
            创建内容
          </Button>
        </Link>
      </div>

      <div className={styles.stats}>
        {statsData.map((stat, index) => (
          <StatsCard key={index} {...stat} />
        ))}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>最近内容</h2>
          <Link href="/content" className={styles.viewAll}>
            查看全部
          </Link>
        </div>
        <ContentGrid items={recentContent} />
      </div>
    </div>
  )
}