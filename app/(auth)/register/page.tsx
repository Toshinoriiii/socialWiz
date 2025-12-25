'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MailOutlined, LockOutlined, UserOutlined } from '@ant-design/icons'
import { Button, Input } from '@/components/ui'
import styles from './register.module.css'
    
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
          <h1 className={styles.title}>创建账户</h1>
          <p className={styles.subtitle}>开始使用 SocialWiz</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {errors.general && (
            <div className={styles.errorAlert}>{errors.general}</div>
          )}

          <Input
            label="用户名"
            type="text"
            placeholder="请输入用户名"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            error={errors.name}
            prefixIcon={<UserOutlined />}
            required
            fullWidth
          />

          <Input
            label="邮箱"
            type="email"
            placeholder="请输入邮箱"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            error={errors.email}
            prefixIcon={<MailOutlined />}
            required
            fullWidth
          />

          <Input
            label="密码"
            type="password"
            placeholder="请输入密码（至少8位，包含大小写字母和数字）"
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            error={errors.password}
            prefixIcon={<LockOutlined />}
            required
            fullWidth
          />

          <Input
            label="确认密码"
            type="password"
            placeholder="请再次输入密码"
            value={formData.confirmPassword}
            onChange={(e) => handleChange('confirmPassword', e.target.value)}
            error={errors.confirmPassword}
            prefixIcon={<LockOutlined />}
            required
            fullWidth
          />

          <Button
            type="submit"
            loading={loading}
            fullWidth
            size="lg"
          >
            注册
          </Button>
        </form>

        <div className={styles.footer}>
          <p>
            已有账户？{' '}
            <Link href="/login" className={styles.link}>
              立即登录
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
