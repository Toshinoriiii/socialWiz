'use client'

/**
 * 平台管理页面
 * Feature: 006-platform-publish-config
 */

import React, { useState, useEffect } from 'react'
import { Settings, FileText, Image as ImageIcon, Sparkles } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/badge'
import { Platform } from '@/types/platform.types'
import { PlatformConfigDialog } from '@/components/dashboard/PlatformConfigDialog'
import { PlatformBrandLogo } from '@/components/dashboard/PlatformBrandLogo'
import { useUserStore } from '@/store/user.store'
import { toast } from 'sonner'

const PLATFORM_INFO = [
  {
    id: Platform.WECHAT,
    name: '微信公众号',
    supportedTypes: ['文章'],
    description: '公众平台图文、草稿与正式发布能力'
  },
  {
    id: Platform.WEIBO,
    name: '微博',
    supportedTypes: ['文章', '图文'],
    description: '头条文章与会话图文，浏览器会话发博'
  },
  {
    id: Platform.DOUYIN,
    name: '抖音',
    supportedTypes: ['视频'],
    description: '短视频发布（能力接入中）'
  },
  {
    id: Platform.XIAOHONGSHU,
    name: '小红书',
    supportedTypes: ['图文', '视频'],
    description: '笔记与视频（能力接入中）'
  }
] as const

export default function PlatformsPage () {
  const { user } = useUserStore()
  const [configCounts, setConfigCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    loadConfigCounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在用户就绪时拉取
  }, [user?.id])

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

  const platformsWithConfigUi: Platform[] = [Platform.WECHAT, Platform.WEIBO]

  const handleConfigClick = (platformId: Platform) => {
    if (platformsWithConfigUi.includes(platformId)) {
      setSelectedPlatform(platformId)
      setDialogOpen(true)
    } else {
      toast.info(`${platformId} 配置功能开发中...`)
    }
  }

  return (
    <div className="min-h-[calc(100vh-6rem)]">
      <div className="mx-auto max-w-5xl space-y-10 px-1">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            平台管理
          </h1>
          <p className="max-w-2xl leading-relaxed text-muted-foreground">
            发文时选用模板即可快速对齐可见范围、同步文案等设置。
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {PLATFORM_INFO.map((platform) => (
            <Card
              key={platform.id}
              className="overflow-hidden border border-border bg-background transition-colors hover:bg-muted"
            >
              <CardHeader className="space-y-4 pb-2">
                <div className="flex items-start gap-4">
                  <PlatformBrandLogo
                    platform={platform.id}
                    size={44}
                    tileClassName="bg-muted"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <CardTitle className="text-xl font-semibold tracking-tight text-foreground">
                      {platform.name}
                    </CardTitle>
                    <p className="text-sm leading-snug text-muted-foreground">
                      {platform.description}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-5 pt-2">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    支持类型
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {platform.supportedTypes.map((type) => (
                      <Badge
                        key={type}
                        variant="secondary"
                        className="border border-border font-normal"
                      >
                        {type === '文章' && <FileText className="mr-1 size-3 opacity-80" />}
                        {(type === '图文' || type === '视频') && (
                          <ImageIcon className="mr-1 size-3 opacity-80" />
                        )}
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Settings className="size-4 text-muted-foreground" />
                    <span>配置模板</span>
                    <span className="inline-flex min-w-[1.75rem] items-center justify-center rounded-md border border-border bg-muted px-2 py-0.5 text-sm font-semibold tabular-nums text-foreground">
                      {loading ? '…' : configCounts[platform.id] ?? 0}
                    </span>
                  </div>
                  <Button size="sm" onClick={() => handleConfigClick(platform.id)}>
                    <Settings className="mr-1 size-4" />
                    配置
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border border-border bg-muted">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground">
                <Sparkles className="size-5" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">使用说明</h3>
                <ul className="list-inside list-disc space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                  <li>点击「配置」可为该平台创建多套发布模板（如微博文章 / 图文分区选项）。</li>
                  <li>模板里是平台侧参数；正文、封面等仍在作品编辑页维护。</li>
                  <li>发布时选择账号与模板，即可复用同一套参数。</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedPlatform ? (
          <PlatformConfigDialog
            platform={selectedPlatform}
            platformName={
              PLATFORM_INFO.find((p) => p.id === selectedPlatform)?.name ?? ''
            }
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            onConfigsChange={loadConfigCounts}
          />
        ) : null}
      </div>
    </div>
  )
}
