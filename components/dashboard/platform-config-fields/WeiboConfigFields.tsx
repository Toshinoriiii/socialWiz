'use client'

/**
 * 微博平台发布配置：按「文章」「图文」两类分别展示（与会话发博 contentType 对应）。
 */

import React, { useState } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/textarea'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const VISIBILITY_OPTIONS = [
  { value: 'public', label: '公开' },
  { value: 'friends', label: '好友圈' },
  { value: 'self', label: '仅自己可见' }
] as const

const DECLARATION_OPTIONS = [
  { value: '0', label: '不声明' },
  { value: '1', label: '含营销推广或商业目的' },
  { value: '2', label: '个人观点，仅供参考' },
  { value: '3', label: '内容取材网络等（含人工智能）' }
] as const

interface WeiboConfigFieldsProps {
  form: UseFormReturn<any>
  disabled?: boolean
}

function CategoryCollapsible ({
  title,
  description,
  defaultOpen = true,
  children
}: {
  title: string
  description?: string
  /** 首次展开状态 */
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="overflow-visible rounded-lg border border-border bg-background"
    >
      <CollapsibleTrigger
        type="button"
        className="flex w-full cursor-pointer items-start gap-3 border-b border-border bg-muted px-4 py-3 text-left outline-none hover:bg-neutral-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:hover:bg-neutral-800"
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            'mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180'
          )}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-visible">
        <div className="space-y-4 p-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function WeiboConfigFields ({ form, disabled }: WeiboConfigFieldsProps) {
  const { watch, setValue, register, formState: { errors } } = form

  /** 仅在为 `true` 时视为开启；`undefined`/false 均为关闭（与默认不勾选一致） */
  const followersOnlyEnabled =
    watch('configData.articleFollowersOnlyFullText') === true
  const articleVis = watch('configData.articleVisibility') || 'public'
  const articleDecl = watch('configData.articleContentDeclaration') ?? '0'
  const imageVis = watch('configData.imageTextVisibility') || 'public'
  const imageDecl = watch('configData.imageTextContentDeclaration') ?? '0'

  return (
    <div className="space-y-8">
      {/* —— 文章（头条 / contentType: article）—— */}
      <CategoryCollapsible
        title="文章"
        description="适用于发布头条文章、长文。文章封面请在「创建/编辑文章」页上传，发布微博时会一并使用。"
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="articleColumnName">专栏</Label>
              <Input
                id="articleColumnName"
                {...register('configData.articleColumnName')}
                placeholder="请输入专栏名称"
                disabled={disabled}
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">
                请确保专栏已经在平台创建；当前会写入草稿 source，供与专栏 ID 对接。
              </p>
            </div>

            <div className="flex min-h-[88px] flex-col justify-between rounded-lg border border-border bg-muted px-4 py-3">
              <div>
                <Label className="cursor-pointer">仅粉丝阅读全文</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  开启后仅粉丝可阅读全文
                </p>
              </div>
              <div className="flex justify-end mt-3">
                <Button
                  type="button"
                  variant={followersOnlyEnabled ? 'default' : 'outline'}
                  size="sm"
                  disabled={disabled}
                  onClick={() => {
                    setValue(
                      'configData.articleFollowersOnlyFullText',
                      !followersOnlyEnabled
                    )
                  }}
                >
                  {followersOnlyEnabled ? '启用' : '关闭'}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>可见范围</Label>
              <Select
                value={articleVis}
                onValueChange={(v) => setValue('configData.articleVisibility', v)}
                disabled={disabled}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">设置作品的可见范围</p>
            </div>

            <div className="space-y-2">
              <Label>内容声明</Label>
              <Select
                value={articleDecl}
                onValueChange={(v) =>
                  setValue('configData.articleContentDeclaration', v)
                }
                disabled={disabled}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DECLARATION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                选择作品的内容声明，仅对可见范围公开的作品生效
              </p>
            </div>
          </div>

        <div className="space-y-2 border-t border-border pt-4">
          <Label htmlFor="articleWeiboStatusText">微博动态</Label>
          <Textarea
            id="articleWeiboStatusText"
            {...register('configData.articleWeiboStatusText')}
            placeholder="请输入微博动态内容"
            disabled={disabled}
            className="min-h-[120px] bg-background"
            rows={5}
          />
          <p className="text-xs text-muted-foreground">
            支持话题、@用户、微博表情，如：#话题名称# @用户名称
            我发布了一篇新文章，快来围观吧 [666][干杯]。留空则使用默认「发布了头条文章：《标题》」。
          </p>
        </div>
      </CategoryCollapsible>

      {/* —— 图文（信息流 / contentType: image-text）—— */}
      <CategoryCollapsible
        title="图文"
        description="适用于带图信息流发帖；与「图文」类型及九图长文一致。"
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="imageTextLocation">地点</Label>
              <Input
                id="imageTextLocation"
                {...register('configData.imageTextLocation')}
                placeholder="请输入地理位置"
                disabled={disabled}
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">
                将选择搜索到的第一个结果作为发布位置
              </p>
            </div>

            <div className="space-y-2">
              <Label>可见范围</Label>
              <Select
                value={imageVis}
                onValueChange={(v) => setValue('configData.imageTextVisibility', v)}
                disabled={disabled}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">设置作品的可见范围</p>
            </div>

            <div className="space-y-2 md:col-span-1">
              <Label>内容声明</Label>
              <Select
                value={imageDecl}
                onValueChange={(v) =>
                  setValue('configData.imageTextContentDeclaration', v)
                }
                disabled={disabled}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DECLARATION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                选择作品的内容声明，仅对可见范围公开的作品生效
              </p>
            </div>
          </div>
      </CategoryCollapsible>

      {(errors as any).configData &&
        typeof (errors as any).configData === 'object' &&
        (errors as any).configData.message && (
          <p className="text-sm text-red-600">{(errors as any).configData.message}</p>
        )}
    </div>
  )
}
