'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  FileText,
  Users,
  Eye,
  Heart,
  Plus,
  Search,
  Filter,
  MessageCircle,
  ThumbsUp,
  Share2
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'
import { Badge } from '@/components/ui/badge'

// 模拟数据
const statsData = [
  {
    title: '总粉丝数',
    value: '128,456',
    change: '+12.5%',
    chartType: 'line',
    icon: <Users className="size-5" />
  },
  {
    title: '互动增长率',
    value: '42.3%',
    change: '+8.2%',
    chartType: 'bar',
    icon: <Heart className="size-5" />
  },
  {
    title: '内容发布量',
    value: '1,248',
    change: '+5.7%',
    chartType: 'area',
    icon: <FileText className="size-5" />
  },
  {
    title: '转化率',
    value: '3.8%',
    change: '-1.2%',
    chartType: 'pie',
    icon: <Eye className="size-5" />
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
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 min-h-screen p-6">
      <div className="flex flex-col gap-8">
        {/* 数据概览区域 */}
        <div>
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-1">数据概览</h2>
              <p className="text-sm text-muted-foreground">实时监控平台表现</p>
            </div>
            <Button variant="outline" size="sm">
              <Filter className="size-4" />
              <span>筛选</span>
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {statsData.map((stat, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                      <h3 className="text-3xl font-bold mb-2">{stat.value}</h3>
                      <p className={`text-sm ${stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                        {stat.change} 环比
                      </p>
                    </div>
                    <div className="w-16 h-16 border-2 border-foreground rounded-lg flex items-center justify-center bg-muted/50">
                      {stat.icon}
                    </div>
                  </div>
                  <div className="h-12 mt-4">
                    <div className="w-full h-full bg-gradient-to-r from-muted to-muted/50 rounded-md opacity-70"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* 内容管理区域 */}
        <div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-2xl font-bold">内容管理</h2>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial sm:max-w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="搜索内容..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Link href="/publish">
                <Button size="lg" className="w-full sm:w-auto">
                  <Plus className="size-4" />
                  新建内容
                </Button>
              </Link>
            </div>
          </div>

          {/* 内容网格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {contentItems.map((item) => {
              const platformColorMap: Record<string, string> = {
                green: 'bg-green-500',
                red: 'bg-red-500',
                purple: 'bg-purple-500',
                pink: 'bg-pink-500'
              }
              return (
                <Card key={item.id} className="hover:shadow-md transition-all hover:-translate-y-1">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${platformColorMap[item.platformColor] || 'bg-gray-500'}`}></div>
                        <span className="text-sm font-semibold">{item.platform}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{item.time}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-foreground line-clamp-2 mb-4">{item.content}</p>
                    {item.image && (
                      <div className="h-48 overflow-hidden rounded-md mb-4">
                        <img src={item.image} alt={item.platform} className="w-full h-full object-cover" />
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="pt-0 flex justify-between border-t">
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="size-4" /> {item.metrics.views}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="size-4" /> {item.metrics.comments}
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="size-4" /> {item.metrics.likes}
                      </span>
                    </div>
                    <Share2 className="size-4 text-muted-foreground" />
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        </div>
      </div>

      {/* 右侧边栏 */}
      <aside className="space-y-6">
        {/* 热门话题 */}
        <Card className="sticky top-6">
          <CardHeader>
            <CardTitle className="text-lg">热门话题</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {trendingTopics.map((topic, index) => (
                <button
                  key={index}
                  className="w-full text-left p-3 bg-muted/50 border border-border rounded-md hover:bg-muted hover:border-foreground/20 transition-colors"
                >
                  <span className="text-sm font-semibold text-primary">{topic}</span>
                  <p className="text-xs text-muted-foreground mt-1">1,245 条相关内容</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 草稿箱 */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">草稿箱</CardTitle>
              <button className="text-sm text-primary font-semibold hover:text-primary/80 transition-colors">
                查看全部
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="p-3 bg-muted/50 border border-border rounded-md hover:bg-muted hover:border-foreground/20 transition-colors cursor-pointer"
                >
                  <h4 className="text-sm font-semibold truncate">{draft.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{draft.time}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}
