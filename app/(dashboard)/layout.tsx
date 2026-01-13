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
import styles from './layout.module.css'

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
    <div className={styles.layout}>
      {/* 顶部导航栏 */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>S</div>
            <h1 className={styles.logoText}>SocialWiz</h1>
          </div>
          <div className={styles.spacer}></div>
          <div className={styles.headerActions}>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <Bell className="size-5" />
            </Button>
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="text-white hover:bg-white/10 h-auto p-2">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className={styles.avatar} />
                    ) : (
                      <div className={styles.avatarPlaceholder}>
                        {user.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className={styles.userName}>{user.name}</span>
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
      <nav className={styles.tabNav}>
        <div className={styles.tabNavContent}>
          {navItems.map((item) => {
            const isActive = pathname === item.key || pathname?.startsWith(item.key + '/')
            return (
              <Link
                key={item.key}
                href={item.key}
                className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              >
                {item.icon}
                <span className={styles.tabLabel}>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* 主内容区 */}
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}