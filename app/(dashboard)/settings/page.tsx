'use client'

import React from 'react'
import { Edit, MessageCircle, MessageSquare, Instagram } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

const platforms = [
  { id: 1, name: '微信', icon: <MessageCircle className="size-5" />, color: 'bg-green-500', connected: true },
  { id: 2, name: '微博', icon: <MessageSquare className="size-5" />, color: 'bg-red-500', connected: true },
  { id: 3, name: '抖音', icon: <Instagram className="size-5" />, color: 'bg-purple-500', connected: true },
  { id: 4, name: '小红书', icon: <Instagram className="size-5" />, color: 'bg-pink-500', connected: false }
]

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">账户设置</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <div className="bg-muted/50 rounded-lg p-5">
                <h3 className="text-lg font-medium mb-4">个人信息</h3>
                <div className="flex flex-col items-center">
                  <div className="relative mb-4">
                    <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                      <img
                        src="https://ai-public.mastergo.com/ai/img_res/ebd5dd28afd15227e18e6b7277380be5.jpg"
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button className="absolute bottom-0 right-0 bg-background rounded-full p-1 shadow-sm hover:bg-muted transition-colors border border-border">
                      <Edit className="size-4" />
                    </button>
                  </div>
                  <div className="w-full space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">姓名</Label>
                      <Input
                        id="name"
                        type="text"
                        defaultValue="张伟"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">邮箱</Label>
                      <Input
                        id="email"
                        type="email"
                        defaultValue="zhangwei@example.com"
                        disabled
                      />
                    </div>
                    <Button className="w-full">
                      保存更改
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="bg-muted/50 rounded-lg p-5">
                <h3 className="text-lg font-medium mb-4">第三方平台绑定</h3>
                <div className="flex flex-col gap-4">
                  {platforms.map(platform => (
                    <div key={platform.id} className="flex items-center justify-between p-4 bg-background rounded-lg border border-border">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 ${platform.color} rounded-lg flex items-center justify-center text-white`}>
                          {platform.icon}
                        </div>
                        <div>
                          <div className="font-medium">{platform.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {platform.connected ? '已绑定' : '未绑定'}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant={platform.connected ? 'outline' : 'default'}
                        size="sm"
                      >
                        {platform.connected ? '解绑' : '绑定'}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">安全设置</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center p-4 border border-border rounded-lg">
              <div>
                <h4 className="font-medium mb-1">修改密码</h4>
                <p className="text-sm text-muted-foreground">定期更换密码以保护账户安全</p>
              </div>
              <Button variant="outline" size="sm">
                修改
              </Button>
            </div>
            <div className="flex justify-between items-center p-4 border border-border rounded-lg">
              <div>
                <h4 className="font-medium mb-1">登录设备管理</h4>
                <p className="text-sm text-muted-foreground">查看和管理登录过的设备</p>
              </div>
              <Button variant="outline" size="sm">
                查看
              </Button>
            </div>
            <div className="flex justify-between items-center p-4 border border-border rounded-lg">
              <div>
                <h4 className="font-medium mb-1">双重验证</h4>
                <p className="text-sm text-muted-foreground">为账户增加额外的安全保护</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
