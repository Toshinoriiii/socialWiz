'use client'

import Image from 'next/image'
import { Platform } from '@/types/platform.types'
import { cn } from '@/lib/utils'

const LOGO_SRC: Partial<Record<Platform, string>> = {
  [Platform.WECHAT]: '/platforms/wechat.svg',
  [Platform.WEIBO]: '/platforms/sinaweibo.svg',
  [Platform.ZHIHU]: '/platforms/zhihu.svg',
  [Platform.DOUYIN]: '/platforms/douyin.svg',
  [Platform.XIAOHONGSHU]: '/platforms/xiaohongshu.svg'
}

const ALT: Partial<Record<Platform, string>> = {
  [Platform.WECHAT]: '微信',
  [Platform.WEIBO]: '微博',
  [Platform.ZHIHU]: '知乎',
  [Platform.DOUYIN]: '抖音',
  [Platform.XIAOHONGSHU]: '小红书'
}

export function PlatformBrandLogo ({
  platform,
  size = 48,
  className,
  tileClassName
}: {
  platform: Platform
  size?: number
  className?: string
  /** 外圈衬底 */
  tileClassName?: string
}) {
  const src = LOGO_SRC[platform] ?? '/platforms/wechat.svg'
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg border border-border',
        tileClassName
      )}
      style={{ width: size + 24, height: size + 24 }}
    >
      <Image
        unoptimized
        src={src}
        alt={ALT[platform] ?? '平台'}
        width={size}
        height={size}
        className={cn('object-contain', className)}
      />
    </div>
  )
}
