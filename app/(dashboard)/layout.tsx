'use client'

import React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Bell,
  User,
  Settings,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/Button'
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar'
import { DashboardSidebar } from '@/components/layout/DashboardSidebar'
import { useUserStore } from '@/store/user.store'

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, clearUser } = useUserStore()

  const handleLogout = () => {
    clearUser()
    localStorage.removeItem('token')
    router.push('/login')
  }

  return (
    <SidebarProvider>
      {/* 左侧导航栏 */}
      <DashboardSidebar />
      
      {/* 右侧工作区 - 使用 SidebarInset 自动处理间距 */}
      <SidebarInset>
        {/* 顶部用户信息区域 - 固定位置 */}
        <header className="sticky top-0 z-50 h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-6 shrink-0">
          <div className="flex items-center justify-end gap-4 w-full">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="relative hover:bg-accent">
                <Bell className="size-5 text-foreground/80" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border-2 border-background"></span>
              </Button>
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-auto p-1.5 hover:bg-accent rounded-full">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full object-cover border-2 border-border" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-semibold text-white border-2 border-border">
                          {user.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="ml-2 text-sm font-medium text-foreground hidden md:inline">{user.name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="flex items-center gap-2">
                        <Settings className="size-4" />
                        <span>设置</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2">
                      <User className="size-4" />
                      <span>登出</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </header>

        {/* 主内容区 */}
        <div className="flex-1 overflow-y-auto bg-background">
          <div className="p-6">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
