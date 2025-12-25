'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  FileTextOutlined,
  UserOutlined,
  EyeOutlined,
  HeartOutlined,
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  CommentOutlined,
  LikeOutlined,
  ShareAltOutlined
} from '@ant-design/icons'
import { Button } from '@/components/ui'
import styles from './home.module.css'

// 模拟数据
const statsData = [
  {
    title: '总粉丝数',
    value: '128,456',
    change: '+12.5%',
    chartType: 'line',
    icon: <UserOutlined />
  },
  {
    title: '互动增长率',
    value: '42.3%',
    change: '+8.2%',
    chartType: 'bar',
    icon: <HeartOutlined />
  },
  {
    title: '内容发布量',
    value: '1,248',
    change: '+5.7%',
    chartType: 'area',
    icon: <FileTextOutlined />
  },
  {
    title: '转化率',
    value: '3.8%',
    change: '-1.2%',
    chartType: 'pie',
    icon: <EyeOutlined />
  }
]

const contentItems = [
  {
    id: '1',
    platform: '微信',
    platformColor: 'green',
    time: '2 小时前',
    content: '新产品发布会即将开始，敬请期待！#新品发布 #科技创新',
    metrics: { views: 1245, comments: 64, likes: 231 },
    image: 'https://ai-public.mastergo.com/ai/img_res/1975e2e250b3ec842131639b4aab269e.jpg'
  },
  {
    id: '2',
    platform: '微博',
    platformColor: 'red',
    time: '5 小时前',
    content: '用户调研结果显示，90% 的用户对我们的新功能表示满意。感谢大家的支持！',
    metrics: { views: 5621, comments: 128, likes: 842 },
    image: 'https://ai-public.mastergo.com/ai/img_res/8e66e784dabd76df6f15a36c359be94a.jpg'
  },
  {
    id: '3',
    platform: '抖音',
    platformColor: 'purple',
    time: '1 天前',
    content: 'Behind the scenes of our latest product photoshoot. #bts #productphotography',
    metrics: { views: 12540, comments: 356, likes: 2156 },
    image: 'https://ai-public.mastergo.com/ai/img_res/2690002600ca096f5c0dd5234b6f1df9.jpg'
  },
  {
    id: '4',
    platform: '微信',
    platformColor: 'green',
    time: '1 天前',
    content: '行业专家分享数字化转型的最佳实践案例，不容错过！',
    metrics: { views: 892, comments: 24, likes: 156 },
    image: 'https://ai-public.mastergo.com/ai/img_res/094c83c800f2b824d0d021491327534b.jpg'
  },
  {
    id: '5',
    platform: '小红书',
    platformColor: 'pink',
    time: '2 天前',
    content: '分享一些日常好物，提升生活品质💕',
    metrics: { views: 3420, comments: 89, likes: 567 },
    image: 'https://ai-public.mastergo.com/ai/img_res/53dbc71c3ee165ca1fb15d8a5ba05e09.jpg'
  },
  {
    id: '6',
    platform: '微博',
    platformColor: 'red',
    time: '3 天前',
    content: '品牌营销的新趨势，你了解多少？',
    metrics: { views: 2156, comments: 45, likes: 334 },
    image: 'https://ai-public.mastergo.com/ai/img_res/c1d67fa560a2cd8c8c9f0f82f8831c3e.jpg'
  }
]

const trendingTopics = [
  '#数字化转型',
  '#AI技术',
  '#用户体验',
  '#品牌营销',
  '#社交媒体'
]

const drafts = [
  { id: 1, title: '新产品发布会预告', time: '昨天 15:30' },
  { id: 2, title: '用户调研报告分享', time: '前天 10:15' }
]

export default function HomePage() {
  const [searchText, setSearchText] = useState('')

  return (
    <div className={styles.home}>
      <div className={styles.mainContent}>
        {/* 数据概览区域 */}
        <div className={styles.statsSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>数据概览</h2>
              <p className={styles.sectionSubtitle}>实时监控平台表现</p>
            </div>
            <button className={styles.filterBtn}>
              <FilterOutlined />
              <span>筛选</span>
            </button>
          </div>
          <div className={styles.statsGrid}>
            {statsData.map((stat, index) => (
              <div key={index} className={styles.statCard}>
                <div className={styles.statHeader}>
                  <div>
                    <p className={styles.statLabel}>{stat.title}</p>
                    <h3 className={styles.statValue}>{stat.value}</h3>
                    <p className={stat.change.startsWith('+') ? styles.statChangeUp : styles.statChangeDown}>
                      {stat.change} 环比
                    </p>
                  </div>
                  <div className={styles.statIcon}>
                    {stat.icon}
                  </div>
                </div>
                <div className={styles.statChart}>
                  <div className={styles.chartPlaceholder}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 内容管理区域 */}
        <div className={styles.contentSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>内容管理</h2>
            <div className={styles.headerActions}>
              <div className={styles.searchBox}>
                <SearchOutlined className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="搜索内容..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              <Link href="/publish">
                <Button icon={<PlusOutlined />} size="lg">
                  新建内容
                </Button>
              </Link>
            </div>
          </div>

          {/* 内容网格 */}
          <div className={styles.contentGrid}>
            {contentItems.map((item) => (
              <div key={item.id} className={styles.contentCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.platformBadge}>
                    <div className={`${styles.platformDot} ${styles[`platform${item.platformColor.charAt(0).toUpperCase() + item.platformColor.slice(1)}`]}`}></div>
                    <span>{item.platform}</span>
                  </div>
                  <span className={styles.contentTime}>{item.time}</span>
                </div>
                <p className={styles.contentText}>{item.content}</p>
                {item.image && (
                  <div className={styles.contentImage}>
                    <img src={item.image} alt={item.platform} />
                  </div>
                )}
                <div className={styles.cardFooter}>
                  <span className={styles.metricItem}>
                    <EyeOutlined /> {item.metrics.views}
                  </span>
                  <span className={styles.metricItem}>
                    <CommentOutlined /> {item.metrics.comments}
                  </span>
                  <span className={styles.metricItem}>
                    <LikeOutlined /> {item.metrics.likes}
                  </span>
                  <span className={styles.metricItem}>
                    <ShareAltOutlined />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧边栏 */}
      <aside className={styles.sidebar}>
        {/* 热门话题 */}
        <div className={styles.sidebarSection}>
          <h3 className={styles.sidebarTitle}>热门话题</h3>
          <div className={styles.topicList}>
            {trendingTopics.map((topic, index) => (
              <button key={index} className={styles.topicItem}>
                <span className={styles.topicTag}>{topic}</span>
                <p className={styles.topicCount}>1,245 条相关内容</p>
              </button>
            ))}
          </div>
        </div>

        {/* 草稿箱 */}
        <div className={styles.sidebarSection}>
          <div className={styles.sidebarHeader}>
            <h3 className={styles.sidebarTitle}>草稿箱</h3>
            <button className={styles.viewAllBtn}>查看全部</button>
          </div>
          <div className={styles.draftList}>
            {drafts.map((draft) => (
              <div key={draft.id} className={styles.draftItem}>
                <h4 className={styles.draftTitle}>{draft.title}</h4>
                <p className={styles.draftTime}>{draft.time}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}
