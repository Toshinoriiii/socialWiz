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
import { X, Plus, Settings, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Platform } from '@/types/platform.types'
import { WechatConfigFields } from './platform-config-fields'
import { usePlatformConfig } from '@/lib/hooks/use-platform-config'
import { CreateConfigInputSchema } from '@/lib/validators/platform-config.validator'
import { useUserStore } from '@/store/user.store'
import { toast } from 'sonner'
import { z } from 'zod'

interface PlatformConfigDialogProps {
  platform: Platform
  platformName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfigsChange?: () => void
}

type FormData = z.infer<typeof CreateConfigInputSchema>

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
      configData: {
        type: platform === Platform.WECHAT ? 'wechat' : 'weibo',
        author: '',
        contentSourceUrl: ''
      }
    }
  })

  // 重置表单
  const resetForm = () => {
    form.reset({
      platform,
      configName: '',
      description: '',
      configData: {
        type: platform === Platform.WECHAT ? 'wechat' : 'weibo',
        author: '',
        contentSourceUrl: ''
      }
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
    form.reset({
      platform: config.platform,
      configName: config.configName,
      description: config.description || '',
      configData: config.configData
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader className="space-y-3 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <Settings className="size-5 text-foreground" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold mb-1">
                  {platformName} - 平台配置
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  管理 {platformName} 平台的各种配置，每个配置可以用于不同的场景
                </p>
              </div>
            </div>
          </div>
          
          {mode === 'list' && (
            <div className="flex items-center justify-between pt-2">
              <div>
                <h3 className="text-base font-medium">配置列表</h3>
                <p className="text-sm text-muted-foreground">当前有 {configs.length} 个配置，{configs.filter(c => !c.isDefault).length} 个已启用</p>
              </div>
              <Button
                size="sm"
                onClick={handleCreate}
              >
                <Plus className="size-4 mr-1" />
                新建配置
              </Button>
            </div>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* 配置列表视图 */}
          {mode === 'list' && (
            <div className="space-y-4">
              {loading ? (
                <p className="text-center text-gray-500 py-8">加载中...</p>
              ) : configs.length === 0 ? (
                <div className="text-center py-12 bg-muted/50 rounded-lg">
                  <Settings className="size-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-foreground mb-4">还没有配置</p>
                  <p className="text-sm text-muted-foreground mb-6">
                    创建配置后,发布内容时可以快速选择预设参数
                  </p>
                  <Button
                    size="sm"
                    onClick={handleCreate}
                  >
                    <Plus className="size-4 mr-1" />
                    创建第一个配置
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {configs.map((config) => (
                    <div
                      key={config.id}
                      className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-base">{config.configName}</h4>
                            {config.isDefault && (
                              <Badge variant="secondary" className="text-xs">
                                默认
                              </Badge>
                            )}
                          </div>
                          {config.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {config.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>使用 {config.usageCount} 次</span>
                            <span>•</span>
                            <span>
                              创建于 {new Date(config.createdAt).toLocaleDateString('zh-CN')}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 创建/编辑表单视图 */}
          {(mode === 'create' || mode === 'edit') && (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {mode === 'edit' ? '编辑配置' : '创建新配置'}
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToList}
                >
                  <X className="size-4 mr-1" />
                  返回
                </Button>
              </div>

              {/* 配置名称 */}
              <div className="space-y-2">
                <Label htmlFor="configName">
                  配置名称 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="configName"
                  {...form.register('configName')}
                  placeholder="例如:默认配置"
                  className="bg-white border-gray-300"
                />
                {form.formState.errors.configName && (
                  <p className="text-sm text-red-600">
                    {String(form.formState.errors.configName.message || '')}
                  </p>
                )}
              </div>

              {/* 配置描述 */}
              <div className="space-y-2">
                <Label htmlFor="description">配置描述</Label>
                <Textarea
                  id="description"
                  {...form.register('description')}
                  placeholder="简要描述这个配置的用途"
                  className="bg-white border-gray-300 resize-none"
                  rows={2}
                />
              </div>

              {/* 平台特定字段 */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-4">平台参数</h4>
                {platform === Platform.WECHAT && (
                  <WechatConfigFields form={form} />
                )}
              </div>

              {/* 提交按钮 */}
              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBackToList}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting 
                    ? (mode === 'edit' ? '更新中...' : '创建中...') 
                    : (mode === 'edit' ? '保存修改' : '创建配置')}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
