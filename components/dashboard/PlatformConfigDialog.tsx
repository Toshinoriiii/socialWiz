'use client'

/**
 * 平台配置弹窗组件
 * Feature: 006-platform-publish-config
 * 
 * 显示平台的配置列表,支持创建新配置
 */

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Plus, Settings, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Platform } from '@/types/platform.types'
import {
  WechatConfigFields,
  WeiboConfigFields,
  ZhihuConfigFields
} from './platform-config-fields'
import { PlatformBrandLogo } from '@/components/dashboard/PlatformBrandLogo'
import { cn } from '@/lib/utils'
import { CreateConfigInputSchema } from '@/lib/validators/platform-config.validator'
import { useUserStore } from '@/store/user.store'
import { toast } from 'sonner'

interface PlatformConfigDialogProps {
  platform: Platform
  platformName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfigsChange?: () => void
}

function defaultWeiboConfigData () {
  return {
    type: 'weibo' as const,
    articleColumnName: '',
    articleFollowersOnlyFullText: false,
    articleVisibility: 'public' as const,
    articleContentDeclaration: '0' as const,
    articleWeiboStatusText: '',
    imageTextLocation: '',
    imageTextVisibility: 'public' as const,
    imageTextContentDeclaration: '0' as const
  }
}

function defaultZhihuConfigData () {
  return {
    type: 'zhihu' as const,
    articleCommentPermission: 'anyone' as const,
    articleSubmitToQuestionKeywords: '',
    articleCreationDeclaration: 'none' as const,
    articleTopicsLine: '',
    zhuanlanColumnName: ''
  }
}

function defaultConfigDataForPlatform (p: Platform) {
  if (p === Platform.WECHAT) {
    return {
      type: 'wechat' as const,
      author: '',
      contentSourceUrl: ''
    }
  }
  if (p === Platform.ZHIHU) return defaultZhihuConfigData()
  return defaultWeiboConfigData()
}

export function PlatformConfigDialog({
  platform,
  platformName,
  open,
  onOpenChange,
  onConfigsChange
}: PlatformConfigDialogProps) {
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list')
  const [editingConfig, setEditingConfig] = useState<any>(null)
  const { user } = useUserStore()
  const [configs, setConfigs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // 加载配置
  const loadConfigs = async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      const response = await fetch(
        `/api/platforms/publish-configs?userId=${user.id}&platform=${platform}`
      )
      if (response.ok) {
        const data = await response.json()
        setConfigs(data.configs || [])
      }
    } catch (error) {
      console.error('Load configs error:', error)
    } finally {
      setLoading(false)
    }
  }

  // 表单
  const form = useForm<any>({
    resolver: zodResolver(CreateConfigInputSchema),
    defaultValues: {
      platform,
      configName: '',
      description: '',
      configData: defaultConfigDataForPlatform(platform)
    }
  })

  // 重置表单
  const resetForm = () => {
    form.reset({
      platform,
      configName: '',
      description: '',
      configData: defaultConfigDataForPlatform(platform)
    })
  }

  // 打开创建模式
  const handleCreate = () => {
    resetForm()
    setEditingConfig(null)
    setMode('create')
  }

  // 打开编辑模式
  const handleEdit = (config: any) => {
    setEditingConfig(config)
    const mergedConfigData =
      config.platform === Platform.WEIBO
        ? (() => {
            const raw = (config.configData || {}) as Record<string, unknown>
            const m = { ...defaultWeiboConfigData(), ...raw } as Record<
              string,
              unknown
            >
            const legacyVis = raw.visibility as string | undefined
            if (
              legacyVis &&
              (m.articleVisibility == null || m.articleVisibility === '')
            ) {
              m.articleVisibility = legacyVis
            }
            if (
              legacyVis &&
              (m.imageTextVisibility == null || m.imageTextVisibility === '')
            ) {
              m.imageTextVisibility = legacyVis
            }
            return m
          })()
        : config.platform === Platform.ZHIHU
          ? (() => {
              const raw = (config.configData || {}) as Record<string, unknown>
              const m = {
                ...defaultZhihuConfigData(),
                ...raw
              } as Record<string, unknown>
              if (
                !m.articleTopicsLine &&
                Array.isArray(raw.topicIds) &&
                (raw.topicIds as unknown[]).length
              ) {
                m.articleTopicsLine = (raw.topicIds as string[]).join('/')
              }
              if (!m.zhuanlanColumnName && raw.zhuanlanColumnId) {
                m.zhuanlanColumnName = String(raw.zhuanlanColumnId)
              }
              delete m.topicIds
              delete m.zhuanlanColumnId
              delete m.pinViewPermission
              delete m.pinCommentPermission
              return m
            })()
          : config.configData
    form.reset({
      platform: config.platform,
      configName: config.configName,
      description: config.description || '',
      configData: mergedConfigData
    })
    setMode('edit')
  }

  // 返回列表
  const handleBackToList = () => {
    setMode('list')
    setEditingConfig(null)
    resetForm()
  }

  // 删除配置
  const handleDelete = async (config: any) => {
    if (!user?.id) {
      toast.error('请先登录')
      return
    }

    if (!confirm(`确定要删除配置“${config.configName}”吗？`)) {
      return
    }

    try {
      const response = await fetch(
        `/api/platforms/publish-configs?userId=${user.id}&configId=${config.id}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '删除失败')
      }

      toast.success('配置已删除')
      loadConfigs()
      onConfigsChange?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败')
    }
  }

  // 加载配置列表
  React.useEffect(() => {
    if (open && user?.id) {
      loadConfigs()
      setMode('list') // 每次打开弹窗时重置为列表模式
    }
  }, [open, platform, user])

  // 提交表单
  const onSubmit = async (data: any) => {
    if (!user?.id) {
      toast.error('请先登录')
      return
    }

    try {
      if (mode === 'edit' && editingConfig) {
        // 编辑模式：调用 PUT API
        const response = await fetch('/api/platforms/publish-configs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            userId: user.id,
            configId: editingConfig.id,
            originalConfigName: editingConfig.configName
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || '更新失败')
        }

        const result = await response.json()
        const actionText = result._action === 'replaced' ? '配置已更新（配置名已变更）' : '配置更新成功'
        toast.success(actionText)
      } else {
        // 创建模式：调用 POST API
        const response = await fetch('/api/platforms/publish-configs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, userId: user.id })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || '创建失败')
        }

        await response.json()
        toast.success('配置创建成功')
      }

      form.reset()
      handleBackToList()
      loadConfigs()
      onConfigsChange?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : mode === 'edit' ? '更新失败' : '创建失败')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[90vh] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0',
          'border-neutral-200 bg-white sm:rounded-lg dark:border-neutral-800 dark:bg-neutral-950'
        )}
      >
        <div className="shrink-0 border-b border-neutral-200 px-6 pb-4 pt-5 pr-14 dark:border-neutral-800">
          <DialogHeader className="space-y-3 text-left sm:text-left">
            <div className="flex items-start gap-4">
              <PlatformBrandLogo
                platform={platform}
                size={36}
                tileClassName="bg-neutral-100 dark:bg-neutral-800"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <DialogTitle className="text-lg font-semibold tracking-tight">
                  {platformName} · 发布配置
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  为不同场景保存预设参数；发文或排期时可一键选用。
                </p>
              </div>
            </div>

            {mode === 'list' && (
              <div className="mt-4 flex flex-col gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-base font-medium text-foreground">配置列表</p>
                  <p className="text-sm text-muted-foreground">
                    共 {configs.length} 个配置
                    {configs.some((c) => c.isDefault)
                      ? `，含 ${configs.filter((c) => c.isDefault).length} 个默认项`
                      : ''}
                  </p>
                </div>
                <Button size="sm" className="shrink-0" onClick={handleCreate}>
                  <Plus className="mr-1 size-4" />
                  新建配置
                </Button>
              </div>
            )}

            {(mode === 'create' || mode === 'edit') && (
              <div className="mt-4 flex flex-col gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-base font-medium text-foreground">
                    {mode === 'edit' ? '编辑配置' : '新建配置'}
                  </p>
                  {mode === 'edit' && editingConfig ? (
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {editingConfig.configName}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      填写名称与平台参数后保存
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={handleBackToList}
                >
                  <ArrowLeft className="mr-1 size-4" />
                  返回列表
                </Button>
              </div>
            )}
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          <div className="space-y-4 px-6 py-4">
            {mode === 'list' && (
              <div className="space-y-4">
                {loading ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    加载中…
                  </p>
                ) : configs.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-12 text-center dark:border-neutral-700">
                    <Settings className="mx-auto mb-4 size-10 text-muted-foreground" />
                    <p className="mb-1 font-medium text-foreground">
                      还没有配置
                    </p>
                    <p className="mb-6 text-sm text-muted-foreground">
                      创建后可在发布流程中快速选择预设
                    </p>
                    <Button size="sm" onClick={handleCreate}>
                      <Plus className="mr-1 size-4" />
                      创建第一个配置
                    </Button>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {configs.map((config) => (
                      <li
                        key={config.id}
                        className="rounded-lg border border-neutral-200 p-4 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-900"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <h4 className="text-base font-semibold">
                                {config.configName}
                              </h4>
                              {config.isDefault && (
                                <Badge variant="secondary" className="text-xs">
                                  默认
                                </Badge>
                              )}
                            </div>
                            {config.description ? (
                              <p className="mb-2 text-sm text-muted-foreground">
                                {config.description}
                              </p>
                            ) : null}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>使用 {config.usageCount} 次</span>
                              <span className="hidden sm:inline">·</span>
                              <span>
                                创建于{' '}
                                {new Date(config.createdAt).toLocaleDateString(
                                  'zh-CN'
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2 sm:ml-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(config)}
                            >
                              编辑
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(config)}
                              className="text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {(mode === 'create' || mode === 'edit') && (
              <form
                id="platform-config-form"
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                  <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
                  <div className="border-b border-neutral-200 bg-neutral-100 px-4 py-2.5 text-sm font-medium text-foreground dark:border-neutral-800 dark:bg-neutral-900">
                    基本信息
                  </div>
                  <div className="space-y-4 p-4">
                    <div className="space-y-2">
                      <Label htmlFor="configName">
                        配置名称 <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="configName"
                        {...form.register('configName')}
                        placeholder="例如：默认配置 / 活动专题"
                        className="bg-white dark:bg-neutral-900"
                      />
                      {form.formState.errors.configName && (
                        <p className="text-sm text-destructive">
                          {String(
                            form.formState.errors.configName.message || ''
                          )}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">配置描述</Label>
                      <Textarea
                        id="description"
                        {...form.register('description')}
                        placeholder="简要说明用途，方便日后挑选"
                        className="resize-none bg-white dark:bg-neutral-900"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    平台参数
                  </p>
                  {platform === Platform.WECHAT && (
                    <WechatConfigFields form={form} />
                  )}
                  {platform === Platform.WEIBO && (
                    <WeiboConfigFields form={form} />
                  )}
                  {platform === Platform.ZHIHU && (
                    <ZhihuConfigFields form={form} />
                  )}
                </div>
              </form>
            )}
          </div>
        </div>

        {(mode === 'create' || mode === 'edit') && (
          <div className="shrink-0 border-t border-neutral-200 bg-neutral-100 px-6 py-4 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="w-full border-neutral-200 bg-white sm:w-auto dark:border-neutral-700 dark:bg-neutral-950"
                onClick={handleBackToList}
              >
                取消
              </Button>
              <Button
                type="submit"
                form="platform-config-form"
                className="w-full sm:w-auto"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting
                  ? mode === 'edit'
                    ? '保存中…'
                    : '创建中…'
                  : mode === 'edit'
                    ? '保存修改'
                    : '创建配置'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
