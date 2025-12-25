import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SocialWiz - 多智能体社交媒体统一管理平台',
  description: '集成多种AI大模型的社交媒体统一管理平台'
}

export default function RootLayout ({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
