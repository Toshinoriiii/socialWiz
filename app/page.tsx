'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUserStore } from '@/store/user.store'
import { verifyToken } from '@/lib/utils/auth'

export default function Home() {
  const router = useRouter()
  const { token, setUser, clearUser } = useUserStore()
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
          // 重定向到首页
          router.push('/home')
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

  // 只显示加载状态，不显示任何其他内容
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-16 h-16 border-2 border-black rounded-lg flex items-center justify-center mx-auto mb-4 animate-pulse">
          <span className="text-2xl font-bold text-black">S</span>
        </div>
        <p className="text-gray-600">加载中...</p>
      </div>
    </main>
  )
}
