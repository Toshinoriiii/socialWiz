import React, { forwardRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * 与 @ant-design/icons 用法兼容：可作为 PLATFORM_CONFIGS 的 icon 组件，
 * 展示 /public/platforms/zhihu.svg（Simple Icons 知乎字形 + 品牌色）。
 */
export const PlatformZhihuIcon = forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(function PlatformZhihuIcon ({ className, style, ...rest }, ref) {
  return (
    <span
      ref={ref}
      role="img"
      aria-label="知乎"
      className={cn('inline-flex size-[1em] shrink-0 items-center justify-center', className)}
      style={style}
      {...rest}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/platforms/zhihu.svg"
        alt=""
        className="size-[1em] max-h-[1em] w-auto object-contain"
        draggable={false}
      />
    </span>
  )
})
