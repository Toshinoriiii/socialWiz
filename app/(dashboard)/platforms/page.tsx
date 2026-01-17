'use client'

/**
 * 平台管理页面
 * Feature: 006-platform-publish-config
 * 
 * 功能:
 * 1. 展示已支持的发布平台列表
 * 2. 显示每个平台支持的发布类型
 * 3. 显示每个平台的配置数量
 * 4. 提供配置按钮,打开配置弹窗
 */

import React, { useState, useEffect } from 'react'
import { Settings, FileText, Image as ImageIcon } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/badge'
import { Platform } from '@/types/platform.types'
import { PlatformConfigDialog } from '@/components/dashboard/PlatformConfigDialog'
import { useUserStore } from '@/store/user.store'
import { toast } from 'sonner'

// 平台配置信息
const PLATFORM_INFO = [
  {
    id: Platform.WECHAT,
    name: '微信公众号',
    icon: '🟢',
    color: 'bg-green-50 border-green-200',
    textColor: 'text-green-700',
    supportedTypes: ['文章'],
    description: '微信公众平台图文发布'
  },
  {
    id: Platform.WEIBO,
    name: '微博',
    icon: '🔴',
    color: 'bg-red-50 border-red-200',
    textColor: 'text-red-700',
    supportedTypes: ['图文'],
    description: '新浪微博内容发布'
  },
  {
    id: Platform.DOUYIN,
    name: '抖音',
    icon: '⚫',
    color: 'bg-gray-50 border-gray-200',
    textColor: 'text-gray-700',
    supportedTypes: ['视频'],
    description: '抖音短视频发布'
  },
  {
    id: Platform.XIAOHONGSHU,
    name: '小红书',
    icon: '🔴',
    color: 'bg-pink-50 border-pink-200',
    textColor: 'text-pink-700',
    supportedTypes: ['图文', '视频'],
    description: '小红书笔记发布'
  }
]

export default function PlatformsPage() {
  const { user } = useUserStore()
  const [configCounts, setConfigCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // 加载每个平台的配置数量
  useEffect(() => {
    loadConfigCounts()
  }, [])

  const loadConfigCounts = async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      const counts: Record<string, number> = {}
      
      for (const platform of PLATFORM_INFO) {
        try {
          const response = await fetch(
            `/api/platforms/publish-configs?userId=${user.id}&platform=${platform.id}`
          )
          
          if (response.ok) {
            const data = await response.json()
            counts[platform.id] = data.configs?.length || 0
          } else {
            counts[platform.id] = 0
          }
        } catch (error) {
          console.error(`Failed to load config count for ${platform.id}:`, error)
          counts[platform.id] = 0
        }
      }
      
      setConfigCounts(counts)
    } catch (error) {
      console.error('Failed to load config counts:', error)
      toast.error('加载配置数量失败')
    } finally {
      setLoading(false)
    }
  }

  const handleConfigClick = (platformId: Platform) => {
    // 仅微信平台已实现
    if (platformId === Platform.WECHAT) {
      const platformInfo = PLATFORM_INFO.find(p => p.id === platformId)
      setSelectedPlatform(platformId)
      setDialogOpen(true)
    } else {
      toast.info(`${platformId}配置功能开发中...`)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold text-black mb-2">平台管理</h1>
        <p className="text-gray-600">
          配置不同平台的发布参数,创建可复用的配置模板
        </p>
      </div>

      {/* 平台卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {PLATFORM_INFO.map((platform) => (
          <Card
            key={platform.id}
            className={`border-2 ${platform.color} hover:shadow-lg transition-all duration-200`}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{platform.icon}</span>
                  <div>
                    <CardTitle className={`text-xl ${platform.textColor}`}>
                      {platform.name}
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      {platform.description}
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* 支持的发布类型 */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  支持类型:
                </p>
                <div className="flex gap-2 flex-wrap">
                  {platform.supportedTypes.map((type) => (
                    <Badge
                      key={type}
                      variant="secondary"
                      className="bg-white border border-gray-300 text-gray-700"
                    >
                      {type === '文章' && <FileText className="size-3 mr-1" />}
                      {type === '图文' && <ImageIcon className="size-3 mr-1" />}
                      {type === '视频' && <ImageIcon className="size-3 mr-1" />}
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* 配置数量 */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <Settings className="size-4 text-gray-600" />
                  <span className="text-sm text-gray-600">
                    配置模板:
                  </span>
                  <Badge variant="outline" className="font-semibold">
                    {loading ? '...' : (configCounts[platform.id] || 0)}
                  </Badge>
                </div>

                {/* 配置按钮 */}
                <Button
                  size="sm"
                  onClick={() => handleConfigClick(platform.id)}
                  className="bg-black text-white hover:bg-gray-800"
                >
                  <Settings className="size-4 mr-1" />
                  配置
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 使用说明 */}
      <Card className="border border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="text-2xl">💡</div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">使用说明</h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>点击"配置"按钮可以为该平台创建多个配置模板</li>
                <li>每个配置包含平台特定的发布参数(如微信的作者名、原文链接等)</li>
                <li>发布内容时可以选择预设的配置,快速填充发布参数</li>
                <li>配置可以在多个账号间复用,提高发布效率</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 配置弹窗 */}
      {selectedPlatform && (
        <PlatformConfigDialog
          platform={selectedPlatform}
          platformName={PLATFORM_INFO.find(p => p.id === selectedPlatform)?.name || ''}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onConfigsChange={loadConfigCounts}
        />
      )}
    </div>
  )
}
