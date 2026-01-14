'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mail, Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
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
            router.push('/dashboard')
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
      router.push('/dashboard')
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
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <Card className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-16 h-16 border-2 border-foreground rounded-lg flex items-center justify-center mx-auto mb-4 animate-pulse">
                <span className="text-2xl font-bold text-foreground">S</span>
              </div>
              <p className="text-muted-foreground">正在检查登录状态...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <Card className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 border-2 border-foreground rounded-lg flex items-center justify-center">
              <span className="text-2xl font-bold text-foreground">S</span>
            </div>
          </div>
          <CardTitle className="text-3xl font-bold mb-2">欢迎回来</CardTitle>
          <CardDescription>登录到 SocialWiz</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {errors.general && (
              <Alert variant="destructive">
                <AlertDescription>{errors.general}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <InputGroup>
                <InputGroupAddon>
                  <Mail className="size-4" />
                </InputGroupAddon>
                <InputGroupInput
                  id="email"
                  type="email"
                  placeholder="请输入邮箱"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  aria-invalid={!!errors.email}
                  required
                />
              </InputGroup>
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <InputGroup>
                <InputGroupAddon>
                  <Lock className="size-4" />
                </InputGroupAddon>
                <InputGroupInput
                  id="password"
                  type="password"
                  placeholder="请输入密码"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  aria-invalid={!!errors.password}
                  required
                />
              </InputGroup>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              loading={loading}
              size="lg"
              className="w-full"
            >
              登录
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            还没有账户？{' '}
            <Link href="/register" className="text-primary font-semibold hover:text-primary/80 transition-colors">
              立即注册
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
