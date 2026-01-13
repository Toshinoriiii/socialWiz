'use client'

import React, { useState, useEffect } from 'react'
import { ContentEditor } from '@/components/dashboard/ContentEditor'
import { PlatformPreview } from '@/components/dashboard/PlatformPreview'
import { AIChatPanel } from '@/components/dashboard/AIChatPanel'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import styles from './publish.module.css'

// Mock 平台数据
const mockPlatforms = [
  {
    id: 'weibo',
    name: '微博',
    icon: '📱',
    color: '#ff6b6b',
    maxLength: 2000,
    connected: true
  },
  {
    id: 'wechat',
    name: '微信公众号',
    icon: '💬',
    color: '#51cf66',
    maxLength: 20000,
    connected: true
  },
  {
    id: 'douyin',
    name: '抖音',
    icon: '🎵',
    color: '#339af0',
    maxLength: 55,
    connected: true
  },
  {
    id: 'xiaohongshu',
    name: '小红书',
    icon: '📕',
    color: '#ff6b9d',
    maxLength: 1000,
    connected: false
  }
]

const tabs = [
  { id: 'editor', label: '编辑器', icon: '✏️' },
  { id: 'ai-chat', label: 'AI 对话', icon: '✨' }
]

export default function PublishPage() {
  const [activeTab, setActiveTab] = useState('editor')
  const [content, setContent] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['weibo'])
  const [images, setImages] = useState<string[]>([])
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null)
  const [mounted, setMounted] = useState(false)

  // 防止 hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Mock 图片数据
  const mockImages = [
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400',
    'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=400',
    'https://images.unsplash.com/photo-1557683316-973673baf926?w=400'
  ]

  const handlePlatformToggle = (platformId: string) => {
    setSelectedPlatforms((prev) => {
      if (prev.includes(platformId)) {
        return prev.filter((id) => id !== platformId)
      } else {
        return [...prev, platformId]
      }
    })
  }

  const handleAIContentReady = (aiContent: string) => {
    // AI 生成的内容准备好后，更新编辑器内容
    setContent(aiContent)
    // 可选：切换到编辑器标签页查看内容
    // setActiveTab('editor')
  }

  const handleAIPublish = (aiContent: string, platforms: string[]) => {
    // 从 AI 对话直接发布
    console.log('AI 对话发布:', {
      content: aiContent,
      platforms
    })
    alert('发布成功！（这是 mock 数据）')
  }

  const handlePublish = () => {
    if (!content.trim()) {
      alert('请输入内容')
      return
    }
    if (selectedPlatforms.length === 0) {
      alert('请至少选择一个发布平台')
      return
    }

    // Mock 发布逻辑
    console.log('发布内容:', {
      content,
      platforms: selectedPlatforms,
      images,
      scheduledTime
    })

    alert('发布成功！（这是 mock 数据）')
    
    // 重置表单
    setContent('')
    setSelectedPlatforms(['weibo'])
    setImages([])
    setScheduledTime(null)
  }

  const handleSchedule = () => {
    if (!content.trim()) {
      alert('请输入内容')
      return
    }
    if (selectedPlatforms.length === 0) {
      alert('请至少选择一个发布平台')
      return
    }

    // Mock 定时发布逻辑
    const scheduleDate = scheduledTime || new Date(Date.now() + 3600000) // 默认1小时后
    console.log('定时发布:', {
      content,
      platforms: selectedPlatforms,
      images,
      scheduledTime: scheduleDate
    })

    alert(`已设置为定时发布：${scheduleDate.toLocaleString()}（这是 mock 数据）`)
  }

  const connectedPlatforms = mockPlatforms.filter((p) => p.connected)

  // 在客户端挂载之前不渲染 Tabs，避免 hydration mismatch
  if (!mounted) {
    return (
      <div className={styles.publishPage}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>创建内容</h1>
          <p className={styles.pageSubtitle}>创作并发布到多个社交媒体平台</p>
        </div>
        <div className="flex items-center justify-center p-8">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.publishPage}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>创建内容</h1>
        <p className={styles.pageSubtitle}>创作并发布到多个社交媒体平台</p>
      </div>

      {/* 标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className={styles.layout}>
          {/* 左侧：编辑器或AI对话区域 */}
          <div className={styles.mainSection}>
            <TabsContent value="editor" className="mt-0">
              <div className={styles.editorCard}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>内容编辑</h2>
                </div>
                <ContentEditor
                  content={content}
                  onChange={setContent}
                  placeholder="分享你的想法..."
                  maxLength={2000}
                />
              </div>
            </TabsContent>
            <TabsContent value="ai-chat" className="mt-0">
              <div className={styles.chatCard}>
                <AIChatPanel
                  onContentReady={handleAIContentReady}
                  onPublish={handleAIPublish}
                  selectedPlatforms={selectedPlatforms}
                />
              </div>
            </TabsContent>
          </div>

        {/* 右侧：预览和设置区域 */}
        <div className={styles.previewSection}>
          {/* 平台选择预览 */}
          <div className={styles.previewCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>发布平台</h2>
              <span className={styles.selectedCount}>
                已选择 {selectedPlatforms.length} 个平台
              </span>
            </div>
            <div className={styles.platformList}>
              {connectedPlatforms.map((platform) => (
                <PlatformPreview
                  key={platform.id}
                  platform={platform}
                  content={content}
                  images={images.length > 0 ? images : mockImages}
                  isSelected={selectedPlatforms.includes(platform.id)}
                  onSelect={() => handlePlatformToggle(platform.id)}
                />
              ))}
            </div>
          </div>

          {/* 发布设置 */}
          <div className={styles.settingsCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>发布设置</h2>
            </div>
            <div className={styles.settingsContent}>
              <div className={styles.settingItem}>
                <label className={styles.settingLabel}>定时发布</label>
                <input
                  type="datetime-local"
                  className={styles.datetimeInput}
                  onChange={(e) => {
                    if (e.target.value) {
                      setScheduledTime(new Date(e.target.value))
                    } else {
                      setScheduledTime(null)
                    }
                  }}
                />
                {scheduledTime && (
                  <div className={styles.scheduledInfo}>
                    将在 {scheduledTime.toLocaleString()} 发布
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          {activeTab === 'editor' && (
            <div className={styles.actions}>
              <Button
                onClick={handleSchedule}
                variant="outline"
                disabled={!content.trim() || selectedPlatforms.length === 0}
              >
                <span>📅</span>
                定时发布
              </Button>
              <Button
                onClick={handlePublish}
                disabled={!content.trim() || selectedPlatforms.length === 0}
              >
                <span>🚀</span>
                立即发布
              </Button>
            </div>
          )}
        </div>
      </div>
      </Tabs>
    </div>
  )
}
