'use client'

/**
 * 微信平台配置字段组件
 * Feature: 006-platform-publish-config
 * 
 * 渲染微信公众号的配置表单字段
 */

import React from 'react'
import { UseFormReturn } from 'react-hook-form'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/Button'
import type { WechatPublishConfigData } from '@/types/platform-config.types'

interface WechatConfigFieldsProps {
  form: UseFormReturn<any>
  disabled?: boolean
}

export function WechatConfigFields({ form, disabled }: WechatConfigFieldsProps) {
  const { register, watch, setValue, formState: { errors } } = form
  
  const needOpenComment = watch('configData.needOpenComment')
  const onlyFansCanComment = watch('configData.onlyFansCanComment')

  return (
    <div className="space-y-4">
      {/* 作者名 */}
      <div className="space-y-2">
        <Label htmlFor="author">
          作者
          <span className="text-gray-500 text-sm ml-2">(可选)</span>
        </Label>
        <Input
          id="author"
          {...register('configData.author')}
          placeholder="请输入作者名(最多64字符)"
          disabled={disabled}
          className="bg-white border-gray-300"
          maxLength={64}
        />
        {(errors as any).configData?.author && (
          <p className="text-sm text-red-600">
            {(errors as any).configData.author.message}
          </p>
        )}
        <p className="text-xs text-gray-500">
          将显示在文章底部,最多64个字符
        </p>
      </div>

      {/* 原文链接 */}
      <div className="space-y-2">
        <Label htmlFor="contentSourceUrl">
          原文链接
          <span className="text-gray-500 text-sm ml-2">(可选)</span>
        </Label>
        <Input
          id="contentSourceUrl"
          {...register('configData.contentSourceUrl')}
          type="url"
          placeholder="https://example.com/article"
          disabled={disabled}
          className="bg-white border-gray-300"
        />
        {(errors as any).configData?.contentSourceUrl && (
          <p className="text-sm text-red-600">
            {(errors as any).configData.contentSourceUrl.message}
          </p>
        )}
        <p className="text-xs text-gray-500">
          点击"阅读原文"跳转的链接
        </p>
      </div>

      {/* 开启留言 */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <Label htmlFor="needOpenComment" className="cursor-pointer">
            开启留言
          </Label>
          <p className="text-xs text-gray-500 mt-1">
            是否允许读者留言
          </p>
        </div>
        <Button
          type="button"
          variant={needOpenComment ? 'default' : 'outline'}
          size="sm"
          onClick={() => setValue('configData.needOpenComment', !needOpenComment)}
          disabled={disabled}
          className={needOpenComment 
            ? 'bg-black text-white hover:bg-gray-800' 
            : 'border-gray-300 text-black hover:bg-gray-100'}
        >
          {needOpenComment ? '已启用' : '已禁用'}
        </Button>
      </div>

      {/* 仅粉丝可留言 */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <Label htmlFor="onlyFansCanComment" className="cursor-pointer">
            仅粉丝可留言
          </Label>
          <p className="text-xs text-gray-500 mt-1">
            如果开启,只有关注的粉丝可以留言
          </p>
        </div>
        <Button
          type="button"
          variant={onlyFansCanComment ? 'default' : 'outline'}
          size="sm"
          onClick={() => setValue('configData.onlyFansCanComment', !onlyFansCanComment)}
          disabled={disabled}
          className={onlyFansCanComment 
            ? 'bg-black text-white hover:bg-gray-800' 
            : 'border-gray-300 text-black hover:bg-gray-100'}
        >
          {onlyFansCanComment ? '已启用' : '已禁用'}
        </Button>
      </div>
    </div>
  )
}
