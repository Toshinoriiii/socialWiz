'use client'

import React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Bell,
  User,
  Settings,
  Home,
  Edit,
  BarChart3,
  Calendar
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/Button'
import { useUserStore } from '@/store/user.store'
import { cn } from '@/lib/utils'

const navItems = [
  { key: '/home', label: '首页', icon: <Home className="size-4" /> },
  { key: '/publish', label: '内容发布', icon: <Edit className="size-4" /> },
  { key: '/analytics', label: '数据分析', icon: <BarChart3 className="size-4" /> },
  { key: '/schedule', label: '日程管理', icon: <Calendar className="size-4" /> },
  { key: '/settings', label: '账户设置', icon: <Settings className="size-4" /> }
]

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, clearUser } = useUserStore()

  const handleLogout = () => {
    clearUser()
    localStorage.removeItem('token')
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/50">
      {/* 顶部导航栏 */}
      <header className="bg-foreground text-foreground h-16 flex items-center px-6 shadow-sm z-10">
        <div className="w-full max-w-[1400px] mx-auto flex items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center font-bold text-lg text-white">
              S
            </div>
            <h1 className="text-xl font-bold text-white">SocialWiz</h1>
          </div>
          <div className="flex-1"></div>
          <div className="flex items-center gap-5">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <Bell className="size-5" />
            </Button>
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="text-white hover:bg-white/10 h-auto p-2">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-semibold text-white">
                        {user.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="ml-2 text-sm font-medium hidden md:inline">{user.name}</span>
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

      {/* 标签式导航 */}
      <nav className="bg-background border-b border-border px-6">
        <div className="max-w-[1400px] mx-auto flex gap-0">
          {navItems.map((item) => {
            const isActive = pathname === item.key || pathname?.startsWith(item.key + '/')
            return (
              <Link
                key={item.key}
                href={item.key}
                className={cn(
                  "flex items-center gap-2 px-5 py-4 text-sm font-medium text-muted-foreground border-b-2 border-transparent transition-colors hover:text-foreground whitespace-nowrap",
                  isActive && "text-primary border-primary"
                )}
              >
                {item.icon}
                <span className="hidden sm:inline font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="flex-1 w-full overflow-y-auto">
        {children}
      </main>
    </div>
  )
}