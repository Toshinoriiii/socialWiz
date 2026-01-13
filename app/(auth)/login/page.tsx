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
import { useUserStore } from '@/store/user.store'
import { verifyToken } from '@/lib/utils/auth'
import styles from './login.module.css'

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
      <div className={styles.container}>
        <div className={styles.card}>
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg animate-pulse">
              <span className="text-2xl font-bold text-white">S</span>
            </div>
            <p className="text-gray-600">正在检查登录状态...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="url(#gradient)" />
              <path d="M16 8L20 12H18V20H14V12H12L16 8Z" fill="white" />
              <path d="M10 18L12 20V22H20V20L22 18V24H10V18Z" fill="white" />
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="32" y2="32">
                  <stop offset="0%" stopColor="#667eea" />
                  <stop offset="100%" stopColor="#764ba2" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className={styles.title}>欢迎回来</h1>
          <p className={styles.subtitle}>登录到 SocialWiz</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
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

        <div className={styles.footer}>
          <p>
            还没有账户？{' '}
            <Link href="/register" className={styles.link}>
              立即注册
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
