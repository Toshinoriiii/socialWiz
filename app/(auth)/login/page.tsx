'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'
import { useUserStore } from '@/store/user.store'
import { verifyToken } from '@/lib/utils/auth'

export default function LoginPage() {
  const router = useRouter()
  const { user, token, setUser } = useUserStore()
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })

  // 检查用户是否已登录，如果已登录则重定向到管理页面
  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        const storedToken = token || localStorage.getItem('token')
        
        if (storedToken) {
          // 验证 token
          const result = await verifyToken(storedToken)
          
          if (result.valid && result.user) {
            // 已登录，更新 store 并重定向到管理页面
            setUser(result.user, storedToken)
            router.push('/home')
            return
          }
        }
      } catch (error) {
        // 验证失败，继续显示登录页面
        console.error('Auth check failed:', error)
      } finally {
        setCheckingAuth(false)
      }
    }

    checkAuthAndRedirect()
  }, [router, token, setUser])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.errors) {
          setErrors(data.errors)
        } else {
          setErrors({ general: data.error || '登录失败，请重试' })
        }
        return
      }

      // 保存token到localStorage
      localStorage.setItem('token', data.token)
      
      // 更新 store
      setUser(data.user, data.token)
      
      // 跳转到管理页面
      router.push('/home')
    } catch (error) {
      setErrors({ general: '网络错误，请检查网络连接' })
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // 清除该字段的错误
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  // 显示加载状态，避免页面闪烁
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-8">
        <Card className="w-full max-w-md bg-white border-gray-300 shadow-lg">
          <div className="flex justify-center pt-6 pb-2">
            <div className="w-16 h-16 border-2 border-black rounded-lg flex items-center justify-center animate-pulse">
              <span className="text-3xl font-bold text-black">S</span>
            </div>
          </div>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-gray-600">正在检查登录状态...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-8">
      <Card className="w-full max-w-sm bg-white border-gray-300 shadow-lg">
        <div className="flex justify-center pt-6 pb-2">
          <div className="w-16 h-16 border-2 border-black rounded-lg flex items-center justify-center">
            <span className="text-3xl font-bold text-black">S</span>
          </div>
        </div>
        <CardHeader className="text-black">
          <CardTitle className="text-black">登录到您的账户</CardTitle>
          <CardDescription className="text-gray-600">
            请输入您的邮箱和密码以登录
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form id="login-form" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              {errors.general && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <AlertDescription className="text-red-800">{errors.general}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-2">
                <Label htmlFor="email" className="text-black">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  aria-invalid={!!errors.email}
                  className="bg-white border-gray-300 text-black placeholder:text-gray-400"
                  required
                />
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password" className="text-black">密码</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入密码"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  aria-invalid={!!errors.password}
                  className="bg-white border-gray-300 text-black placeholder:text-gray-400"
                  required
                />
                {errors.password && (
                  <p className="text-sm text-red-600">{errors.password}</p>
                )}
              </div>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button
            type="submit"
            form="login-form"
            disabled={loading}
            className="w-full bg-black text-white hover:bg-gray-800 disabled:bg-gray-400 transition-all duration-150"
          >
            {loading ? '登录中...' : '登录'}
          </Button>
          <Button variant="link" asChild className="text-black hover:text-gray-700 transition-all duration-150">
            <Link href="/register">注册</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
