'use client'

/**
 * 微信平台配置字段组件
 * Feature: 006-platform-publish-config
 */

import React from 'react'
import { UseFormReturn } from 'react-hook-form'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/Button'

interface WechatConfigFieldsProps {
  form: UseFormReturn<any>
  disabled?: boolean
}

function CategoryShell ({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-background">
      <div className="border-b border-border bg-muted px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

export function WechatConfigFields ({ form, disabled }: WechatConfigFieldsProps) {
  const {
    register,
    watch,
    setValue,
    formState: { errors }
  } = form

  const needOpenComment = watch('configData.needOpenComment')
  const onlyFansCanComment = watch('configData.onlyFansCanComment')

  return (
    <div className="space-y-6">
      <CategoryShell
        title="基础信息"
        description="作者与原文链接会写入公众号草稿元数据，可按需留空。"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="author">
              作者
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                （可选）
              </span>
            </Label>
            <Input
              id="author"
              {...register('configData.author')}
              placeholder="请输入作者名（最多 64 字符）"
              disabled={disabled}
              className="bg-background"
              maxLength={64}
            />
            {(errors as any).configData?.author && (
              <p className="text-sm text-destructive">
                {(errors as any).configData.author.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              将显示在文章底部，最多 64 个字符
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contentSourceUrl">
              原文链接
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                （可选）
              </span>
            </Label>
            <Input
              id="contentSourceUrl"
              {...register('configData.contentSourceUrl')}
              type="url"
              placeholder="https://example.com/article"
              disabled={disabled}
              className="bg-background"
            />
            {(errors as any).configData?.contentSourceUrl && (
              <p className="text-sm text-destructive">
                {(errors as any).configData.contentSourceUrl.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              读者点击「阅读原文」时跳转的链接
            </p>
          </div>
        </div>
      </CategoryShell>

      <CategoryShell
        title="留言"
        description="控制发布后是否开放留言及谁可以留言。"
      >
        <div className="space-y-3">
          <div className="flex flex-col gap-3 rounded-md border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Label htmlFor="needOpenComment" className="cursor-pointer">
                开启留言
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                是否允许读者在文章下留言
              </p>
            </div>
            <Button
              type="button"
              variant={needOpenComment ? 'default' : 'outline'}
              size="sm"
              className="shrink-0"
              onClick={() =>
                setValue('configData.needOpenComment', !needOpenComment)
              }
              disabled={disabled}
            >
              {needOpenComment ? '已启用' : '已关闭'}
            </Button>
          </div>

          <div className="flex flex-col gap-3 rounded-md border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Label htmlFor="onlyFansCanComment" className="cursor-pointer">
                仅粉丝可留言
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                开启后只有关注公众号的用户可以留言
              </p>
            </div>
            <Button
              type="button"
              variant={onlyFansCanComment ? 'default' : 'outline'}
              size="sm"
              className="shrink-0"
              onClick={() =>
                setValue(
                  'configData.onlyFansCanComment',
                  !onlyFansCanComment
                )
              }
              disabled={disabled}
            >
              {onlyFansCanComment ? '已启用' : '已关闭'}
            </Button>
          </div>
        </div>
      </CategoryShell>
    </div>
  )
}
