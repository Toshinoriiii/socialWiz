'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  FileText,
  Users,
  Eye,
  Heart,
  MessageCircle,
  ThumbsUp,
  Share2,
  Image as ImageIcon,
  Video,
  TrendingUp,
  Globe
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/badge'

// 数据概览卡片数据（符合 FR-006）
const overviewCards = [
  {
    id: 'works-overview',
    title: '作品数据概览',
    description: '共1篇 已发布0篇',
    value: '1',
    badge: '近7日新增1',
    icon: <FileText className="size-5" />,
    color: 'blue' as const,
    href: '/data-overview'
  },
  {
    id: 'accounts-overview',
    title: '账号数据概览',
    description: '共0个账号',
    value: '0',
    badge: '连接平台 0',
    icon: <Users className="size-5" />,
    color: 'green' as const,
    href: '/accounts'
  },
  {
    id: 'publish-overview',
    title: '发布数据概览',
    description: '总发布0 成功发布0',
    value: '0',
    badge: '部分成功 0',
    icon: <TrendingUp className="size-5" />,
    color: 'purple' as const,
    href: '/publish/history'
  },
  {
    id: 'interaction-overview',
    title: '互动数据概览',
    description: '7日数据',
    value: '0',
    metrics: {
      views: 0,
      comments: 0,
      likes: 0,
      favorites: 0,
      shares: 0
    },
    icon: <Heart className="size-5" />,
    color: 'pink' as const,
    href: '/analytics'
  }
]

// 快速创作入口（符合 FR-007）
const quickCreateActions = [
  {
    id: 'create-article',
    label: '创建文章',
    description: '快速创建新的文章作品,在作品管理进行发布',
    icon: <FileText className="size-5" />,
    href: '/publish/create-article',
    color: 'green' as const
  },
  {
    id: 'create-image',
    label: '创建图文',
    description: '快速创建新的图文作品,在作品管理进行发布',
    icon: <ImageIcon className="size-5" />,
    href: '/publish/create-article',
    color: 'blue' as const
  },
  {
    id: 'create-video',
    label: '创建视频',
    description: '快速创建新的视频作品,在作品管理进行发布',
    icon: <Video className="size-5" />,
    href: '/publish/create-video',
    color: 'purple' as const
  }
]

export default function HomePage() {
  const router = useRouter()


  return (
    <div className="space-y-8 bg-white min-h-screen p-6">
      {/* 页面标题 - 移到内容区域 */}
      <div className="pt-2">
        <h1 className="text-3xl font-bold text-black mb-2">数据仪表盘</h1>
        <p className="text-sm text-gray-600">2026-01-14, 星期三</p>
      </div>

      {/* 数据概览卡片（FR-006） */}
      <div>
        <h2 className="text-lg font-semibold text-black mb-4">数据概览</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {overviewCards.map((card) => (
            <Card 
              key={card.id} 
              className="cursor-pointer hover:shadow-lg transition-all border border-gray-300 bg-white"
              onClick={() => router.push(card.href)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-sm font-medium text-black mb-1">
                      {card.title}
                    </CardTitle>
                    <CardDescription className="text-xs text-gray-600 mb-2">
                      {card.description}
                    </CardDescription>
                    {card.badge && (
                      <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700 border-gray-300">
                        {card.badge}
                      </Badge>
                    )}
                  </div>
                  <div className="text-black shrink-0">
                    {card.icon}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {card.metrics ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <Eye className="size-3" /> {card.metrics.views}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="size-3" /> {card.metrics.comments}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="size-3" /> {card.metrics.likes}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-black">{card.value}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 快速创作入口（FR-007） */}
      <div>
        <h2 className="text-lg font-semibold text-black mb-4">快速创作</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickCreateActions.map((action) => (
            <Card 
              key={action.id}
              className="cursor-pointer hover:shadow-lg transition-all border border-gray-300 bg-white"
              onClick={() => router.push(action.href)}
            >
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-black">
                    {action.icon}
                  </div>
                  <CardTitle className="text-base font-semibold text-black">
                    {action.label}
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-gray-600">
                  {action.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>

      {/* 最近动态 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">最近动态</h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-black hover:bg-gray-100">
              刷新
            </Button>
            <Button variant="ghost" size="sm" className="text-black hover:bg-gray-100">
              清空动态
            </Button>
          </div>
        </div>
        <Card className="bg-white border border-gray-300">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-sm text-black">
              <div className="w-2 h-2 rounded-full bg-black"></div>
              <span>作品数据同步未开启</span>
              <span className="text-xs text-gray-600">8分钟前</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
