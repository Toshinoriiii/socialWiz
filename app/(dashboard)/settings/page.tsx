'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Edit, User, Key } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useUserStore } from '@/store/user.store'
import { toast } from 'sonner'
import type { UserProfile } from '@/types/user.types'

export default function SettingsPage() {
  const { user, token, updateProfile } = useUserStore()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    avatar: ''
  })
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 加载用户数据
  useEffect(() => {
    const loadUserData = async () => {
      if (!token) return

      try {
        setLoading(true)
        const response = await fetch('/api/auth/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const data = await response.json()
          if (data.user) {
            setFormData({
              name: data.user.name || '',
              email: data.user.email || '',
              avatar: data.user.avatar || ''
            })
            // 更新 store
            updateProfile(data.user)
          }
        }
      } catch (error) {
        console.error('加载用户数据失败:', error)
      } finally {
        setLoading(false)
      }
    }

    // 如果 store 中有用户数据，先使用它
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        avatar: user.avatar || ''
      })
    } else {
      loadUserData()
    }
  }, [token, user, updateProfile])

  // 处理头像上传（仅预览，不保存到数据库）
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件')
      return
    }

    // 验证文件大小 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('文件大小不能超过 5MB')
      return
    }

    try {
      setUploading(true)

      // 先上传文件获取 URL（但不更新数据库）
      if (!token) {
        toast.error('未登录')
        return
      }

      const uploadFormData = new FormData()
      uploadFormData.append('avatar', file)

      const response = await fetch('/api/auth/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: uploadFormData
      })

      const data = await response.json()

      if (response.ok) {
        // 只更新本地预览，不更新 store 和数据库
        setFormData(prev => ({ 
          ...prev, 
          avatar: data.avatarUrl || '' 
        }))
        toast.success(data.message || '头像已选择，请点击"保存更改"以应用')
      } else {
        toast.error(data.error || '上传失败')
      }
    } catch (error) {
      console.error('上传失败:', error)
      toast.error('网络错误，请重试')
    } finally {
      setUploading(false)
      // 重置文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // 触发文件选择
  const handleEditAvatarClick = () => {
    fileInputRef.current?.click()
  }

  // 保存用户信息（包括头像）
  const handleSave = async () => {
    if (!token) {
      toast.error('未登录')
      return
    }

    try {
      setSaving(true)

      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          avatar: formData.avatar || undefined
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || '保存成功')
        // 保存成功后才更新 store，这样右上角才会更新
        if (data.user) {
          updateProfile(data.user)
        }
      } else {
        toast.error(data.error || '保存失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      toast.error('网络错误，请重试')
    } finally {
      setSaving(false)
    }
  }

  // 处理修改密码
  const handleChangePassword = async () => {
    // 验证输入
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error('请填写所有字段')
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('新密码和确认密码不一致')
      return
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('新密码长度至少为6位')
      return
    }

    if (!token) {
      toast.error('未登录')
      return
    }

    try {
      setChangingPassword(true)

      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || '密码修改成功')
        setPasswordDialogOpen(false)
        // 重置表单
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        })
      } else {
        toast.error(data.error || '密码修改失败')
      }
    } catch (error) {
      console.error('修改密码失败:', error)
      toast.error('网络错误，请重试')
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-black mb-2">设置</h1>
        <p className="text-gray-600">管理您的账户设置和偏好</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="bg-white border border-gray-300">
          <TabsTrigger value="profile" className="data-[state=active]:bg-black data-[state=active]:text-white text-black">
            <User className="size-4 mr-2" />
            个人信息
          </TabsTrigger>
          <TabsTrigger value="password" className="data-[state=active]:bg-black data-[state=active]:text-white text-black">
            <Key className="size-4 mr-2" />
            修改密码
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <Card className="border border-gray-300 bg-white">
            <CardHeader>
              <CardTitle className="text-black">个人信息</CardTitle>
              <CardDescription className="text-gray-600">
                更新您的个人信息和头像
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="text-center py-8 text-gray-600">加载中...</div>
              ) : (
                <>
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center overflow-hidden">
                        {formData.avatar ? (
                          <img
                            src={formData.avatar}
                            alt="Profile"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // 如果图片加载失败，显示占位符
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                              const parent = target.parentElement
                              if (parent) {
                                parent.innerHTML = `<div class="w-full h-full bg-black flex items-center justify-center text-white text-2xl font-bold">${formData.name?.charAt(0)?.toUpperCase() || 'U'}</div>`
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-black flex items-center justify-center text-white text-2xl font-bold">
                            {formData.name?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={handleEditAvatarClick}
                        disabled={uploading}
                        className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-sm hover:bg-gray-100 hover:shadow-md transition-all duration-150 border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                      >
                        {uploading ? (
                          <div className="size-4 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
                        ) : (
                          <Edit className="size-4 text-black" />
                        )}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                    </div>
                  </div>

                  <Separator className="bg-gray-300" />

                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-black">姓名</Label>
                      <Input
                        id="name"
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="bg-white border-gray-300 text-black"
                        placeholder="请输入姓名"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-black">邮箱</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        disabled
                        className="bg-gray-50 border-gray-300 text-gray-600"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                  <Button 
                    className="bg-black text-white hover:bg-gray-800 transition-all duration-150"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? '保存中...' : '保存更改'}
                  </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password" className="mt-6">
          <Card className="border border-gray-300 bg-white">
            <CardHeader>
              <CardTitle className="text-black">修改密码</CardTitle>
              <CardDescription className="text-gray-600">
                定期更换密码以保护账户安全
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center py-4">
                <div className="flex items-center gap-3">
                  <Key className="size-5 text-black" />
                  <div>
                    <h4 className="font-medium text-black">修改密码</h4>
                    <p className="text-sm text-gray-600">定期更换密码以保护账户安全</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-gray-300 text-black hover:bg-gray-100 transition-all duration-150"
                  onClick={() => setPasswordDialogOpen(true)}
                >
                  修改
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 修改密码对话框 */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white border border-gray-300">
          <DialogHeader>
            <DialogTitle className="text-black">修改密码</DialogTitle>
            <DialogDescription className="text-gray-600">
              请输入当前密码和新密码以修改您的账户密码
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-black">当前密码</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                className="bg-white border-gray-300 text-black"
                placeholder="请输入当前密码"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-black">新密码</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="bg-white border-gray-300 text-black"
                placeholder="请输入新密码（至少6位）"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-black">确认新密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="bg-white border-gray-300 text-black"
                placeholder="请再次输入新密码"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPasswordDialogOpen(false)
                setPasswordData({
                  currentPassword: '',
                  newPassword: '',
                  confirmPassword: ''
                })
              }}
              className="border-gray-300 text-black hover:bg-gray-100 transition-all duration-150"
            >
              取消
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={changingPassword}
              className="bg-black text-white hover:bg-gray-800 transition-all duration-150"
            >
              {changingPassword ? '修改中...' : '确认修改'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
