'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'
    
export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    // 前端验证：确认密码
    if (formData.password !== formData.confirmPassword) {
      setErrors({ confirmPassword: '两次输入的密码不一致' })
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password
        })
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.errors) {
          setErrors(data.errors)
        } else {
          setErrors({ general: data.error || '注册失败，请重试' })
        }
        return
      }

      // 保存token到localStorage
      localStorage.setItem('token', data.token)
      
      // 跳转到首页
      router.push('/')
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-8">
      <Card className="w-full max-w-sm bg-white border-gray-300 shadow-lg">
        <div className="flex justify-center pt-6 pb-2">
          <div className="w-16 h-16 border-2 border-black rounded-lg flex items-center justify-center">
            <span className="text-3xl font-bold text-black">S</span>
          </div>
        </div>
        <CardHeader className="text-black">
          <CardTitle className="text-black">创建账户</CardTitle>
          <CardDescription className="text-gray-600">
            开始使用 SocialWiz
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form id="register-form" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              {errors.general && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <AlertDescription className="text-red-800">{errors.general}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-2">
                <Label htmlFor="name" className="text-black">用户名</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="请输入用户名"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  aria-invalid={!!errors.name}
                  className="bg-white border-gray-300 text-black placeholder:text-gray-400"
                  required
                />
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name}</p>
                )}
              </div>

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
                <Label htmlFor="password" className="text-black">密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入密码（至少8位，包含大小写字母和数字）"
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

              <div className="grid gap-2">
                <Label htmlFor="confirmPassword" className="text-black">确认密码</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="请再次输入密码"
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  aria-invalid={!!errors.confirmPassword}
                  className="bg-white border-gray-300 text-black placeholder:text-gray-400"
                  required
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-red-600">{errors.confirmPassword}</p>
                )}
              </div>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button
            type="submit"
            form="register-form"
            disabled={loading}
            className="w-full bg-black text-white hover:bg-gray-800 disabled:bg-gray-400 transition-all duration-150"
          >
            {loading ? '注册中...' : '注册'}
          </Button>
          <p className="text-sm text-gray-600 text-center">
            已有账号？{' '}
            <Button variant="link" asChild className="text-black hover:text-gray-700 p-0 h-auto font-normal underline transition-all duration-150">
              <Link href="/login">去登录</Link>
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
