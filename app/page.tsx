'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUserStore } from '@/store/user.store'

export default function Home() {
  const router = useRouter()
  const { user } = useUserStore()

  useEffect(() => {
    // 如果用户已登录，检查是否有 token
    const token = localStorage.getItem('token')
    if (token && user) {
      // 已登录，跳转到 Dashboard
      router.push('/dashboard')
    }
  }, [user, router])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center max-w-2xl">
        <div className="mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <span className="text-4xl font-bold text-white">S</span>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            SocialWiz
          </h1>
          <p className="text-xl text-gray-700 mb-2">
            多智能体社交媒体统一管理平台
          </p>
          <p className="text-sm text-gray-500">
            集成多种 AI 大模型，一站式管理您的社交媒体内容
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
          <Link
            href="/login"
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
          >
            登录
          </Link>
          <Link
            href="/register"
            className="px-8 py-3 bg-white text-gray-700 rounded-lg font-medium shadow-md hover:shadow-lg border border-gray-200 transform hover:-translate-y-0.5 transition-all duration-200"
          >
            注册账号
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="text-3xl mb-3">🤖</div>
            <h3 className="font-semibold text-gray-900 mb-2">AI 智能创作</h3>
            <p className="text-sm text-gray-600">集成多种 AI 模型，一键生成高质量内容</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="font-semibold text-gray-900 mb-2">数据分析</h3>
            <p className="text-sm text-gray-600">实时监控多平台数据，AI 智能分析</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="text-3xl mb-3">🚀</div>
            <h3 className="font-semibold text-gray-900 mb-2">一键发布</h3>
            <p className="text-sm text-gray-600">同时发布到微信、微博、抖音等平台</p>
          </div>
        </div>
      </div>
    </main>
  )
}
