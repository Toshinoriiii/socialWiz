'use client'

/**
 * 知乎专栏文章发布配置（与产品「发布文章配置」一致）→ zhihu-article-publish
 */

import React from 'react'
import { UseFormReturn } from 'react-hook-form'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

interface ZhihuConfigFieldsProps {
  form: UseFormReturn<any>
  disabled?: boolean
}

export function ZhihuConfigFields ({ form, disabled }: ZhihuConfigFieldsProps) {
  const base = 'configData' as const

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-foreground">发布文章配置</h4>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-6 md:gap-y-4">
        <div className="space-y-2">
          <Label>投稿至问题</Label>
          <Input
            disabled={disabled}
            value={form.watch(`${base}.articleSubmitToQuestionKeywords`) ?? ''}
            onChange={(e) =>
              form.setValue(
                `${base}.articleSubmitToQuestionKeywords`,
                e.target.value,
                { shouldDirty: true }
              )
            }
            placeholder="请输入问题关键词"
            className="bg-white dark:bg-neutral-900"
          />
          <p className="text-xs text-muted-foreground">
            将选择搜索到的第一个结果作为投稿问题
          </p>
        </div>

        <div className="space-y-2">
          <Label>创作声明</Label>
          <Select
            disabled={disabled}
            value={form.watch(`${base}.articleCreationDeclaration`) ?? 'none'}
            onValueChange={(v) =>
              form.setValue(`${base}.articleCreationDeclaration`, v, {
                shouldDirty: true
              })
            }
          >
            <SelectTrigger className="bg-white dark:bg-neutral-900">
              <SelectValue placeholder="选择创作声明" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">无声明</SelectItem>
              <SelectItem value="medical">包含医疗建议</SelectItem>
              <SelectItem value="fictional">虚构创作</SelectItem>
              <SelectItem value="ai_generated">包含 AI 生成内容</SelectItem>
              <SelectItem value="investment">包含投资理财内容</SelectItem>
              <SelectItem value="commercial">包含品牌推广 / 商业合作</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">选择文章的创作声明</p>
        </div>

        <div className="space-y-2">
          <Label>文章话题</Label>
          <Input
            disabled={disabled}
            value={form.watch(`${base}.articleTopicsLine`) ?? ''}
            onChange={(e) =>
              form.setValue(`${base}.articleTopicsLine`, e.target.value, {
                shouldDirty: true
              })
            }
            placeholder="请输入话题，以/分割"
            className="bg-white dark:bg-neutral-900"
          />
          <p className="text-xs text-muted-foreground">
            最多支持 3 个话题，仅对文章生效，视频话题将自动从描述的话题中提取
          </p>
        </div>

        <div className="space-y-2">
          <Label>专栏</Label>
          <Input
            disabled={disabled}
            value={form.watch(`${base}.zhuanlanColumnName`) ?? ''}
            onChange={(e) =>
              form.setValue(`${base}.zhuanlanColumnName`, e.target.value, {
                shouldDirty: true
              })
            }
            placeholder="请输入专栏名称"
            className="bg-white dark:bg-neutral-900"
          />
          <p className="text-xs text-muted-foreground">
            为空表示不发布到专栏，请确保专栏已经在平台创建
          </p>
        </div>
      </div>
    </div>
  )
}
