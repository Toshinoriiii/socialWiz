'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUserStore } from '@/store/user.store'
import { verifyToken } from '@/lib/utils/auth'

export default function Home() {
  const router = useRouter()
  const { user, token, setUser, clearUser, isAuthenticated } = useUserStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 认证状态检查逻辑
    const checkAuthAndRedirect = async () => {
      try {
        // 从 localStorage 获取 token（如果 store 中没有）
        const storedToken = token || localStorage.getItem('token')
        
        if (!storedToken) {
          // 没有 token，重定向到登录页
          router.push('/login')
          return
        }

        // 验证 token
        const result = await verifyToken(storedToken)

        if (result.valid && result.user) {
          // Token 有效，更新 store 状态
          setUser(result.user, storedToken)
          // 重定向到管理页面
          router.push('/dashboard')
        } else {
          // Token 无效或过期，清除状态并重定向到登录页
          if (process.env.NODE_ENV === 'development') {
            const errorMsg = !result.valid && 'error' in result ? result.error : 'Unknown error'
            console.log('[Auth Routing] Token invalid:', errorMsg)
          }
          clearUser()
          localStorage.removeItem('token')
          router.push('/login')
        }
      } catch (error) {
        // 网络错误或其他错误，默认重定向到登录页
        if (process.env.NODE_ENV === 'development') {
          console.error('[Auth Routing] Authentication check failed:', error)
        }
        clearUser()
        localStorage.removeItem('token')
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    checkAuthAndRedirect()
  }, [router, token, setUser, clearUser])

  // 多标签页同步：监听 localStorage 变化
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user-storage') {
        // 其他标签页修改了用户状态，重新检查认证
        const storedToken = localStorage.getItem('token')
        if (!storedToken) {
          clearUser()
          router.push('/login')
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [router, clearUser])

  // 显示加载状态，避免页面闪烁
  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg animate-pulse">
            <span className="text-4xl font-bold text-white">S</span>
          </div>
          <p className="text-gray-600">正在检查登录状态...</p>
        </div>
      </main>
    )
  }

  // 正常情况下不应该显示这个页面（应该已经重定向）
  // 但为了安全起见，保留原有的首页内容作为后备
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
