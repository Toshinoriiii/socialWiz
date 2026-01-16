'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { SidebarProvider, SidebarTrigger, SidebarInset, useSidebar } from '@/components/ui/sidebar'
import { DashboardSidebar } from '@/components/layout/DashboardSidebar'
import { useUserStore } from '@/store/user.store'

function HeaderContent() {
  const router = useRouter()
  const { user, clearUser } = useUserStore()

  const handleLogout = () => {
    clearUser()
    localStorage.removeItem('token')
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-gray-300 bg-white flex items-center px-4 md:px-6 shrink-0">
      <div className="flex items-center justify-between gap-4 w-full">
        <SidebarTrigger className="md:hidden" />
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="relative hover:bg-gray-100 text-black transition-all duration-150 active:scale-95">
            <Bell className="size-5 text-black" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </Button>
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-auto p-1.5 hover:bg-gray-100 rounded-full text-black transition-all duration-150 active:scale-95">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full object-cover border-2 border-gray-300 transition-all duration-150" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center font-semibold text-white border-2 border-gray-300 transition-all duration-150">
                      {user.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="ml-2 text-sm font-medium text-black hidden md:inline">{user.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-white border border-gray-300">
                <DropdownMenuItem asChild className="text-black hover:bg-gray-100 transition-all duration-150">
                  <Link href="/settings" className="flex items-center gap-2">
                    <Settings className="size-4" />
                    <span>设置</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-300" />
                <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 text-black hover:bg-gray-100 transition-all duration-150">
                  <User className="size-4" />
                  <span>登出</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  )
}

function AutoCollapseSidebar() {
  const { state, setOpen } = useSidebar()

  // 监听窗口大小变化，在小屏幕时自动折叠sidebar
  useEffect(() => {
    const checkScreenSize = () => {
      const small = window.innerWidth < 1024 // lg断点
      if (small && state === 'expanded') {
        setOpen(false)
      }
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [state, setOpen])

  return null
}

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      {/* 左侧导航栏 */}
      <DashboardSidebar />
      
      {/* 自动折叠逻辑 */}
      <AutoCollapseSidebar />
      
      {/* 右侧工作区 - 使用 SidebarInset 自动处理间距 */}
      <SidebarInset>
        <HeaderContent />
        
        {/* 主内容区 */}
        <div className="flex-1 overflow-y-auto bg-white">
          <div className="p-4 md:p-6">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
