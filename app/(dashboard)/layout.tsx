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
        <header className="sticky top-0 z-50 h-16 border-b border-gray-300 bg-white flex items-center px-6 shrink-0">
          <div className="flex items-center justify-end gap-4 w-full">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="relative hover:bg-gray-100 text-black">
                <Bell className="size-5 text-black" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              </Button>
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-auto p-1.5 hover:bg-gray-100 rounded-full text-black">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full object-cover border-2 border-gray-300" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center font-semibold text-white border-2 border-gray-300">
                          {user.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="ml-2 text-sm font-medium text-black hidden md:inline">{user.name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-white border border-gray-300">
                    <DropdownMenuItem asChild className="text-black hover:bg-gray-100">
                      <Link href="/settings" className="flex items-center gap-2">
                        <Settings className="size-4" />
                        <span>设置</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-gray-300" />
                    <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 text-black hover:bg-gray-100">
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
        <div className="flex-1 overflow-y-auto bg-white">
          <div className="p-6">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
