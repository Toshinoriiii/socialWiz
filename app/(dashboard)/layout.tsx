'use client'

import React, { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  BellOutlined,
  UserOutlined,
  SettingOutlined,
  HomeOutlined,
  EditOutlined,
  BarChartOutlined,
  CalendarOutlined
} from '@ant-design/icons'
import { useUserStore } from '@/store/user.store'
import styles from './layout.module.css'

const navItems = [
  { key: '/home', label: '首页', icon: <HomeOutlined /> },
  { key: '/publish', label: '内容发布', icon: <EditOutlined /> },
  { key: '/analytics', label: '数据分析', icon: <BarChartOutlined /> },
  { key: '/schedule', label: '日程管理', icon: <CalendarOutlined /> },
  { key: '/settings', label: '账户设置', icon: <SettingOutlined /> }
]

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, clearUser } = useUserStore()
  const [showUserMenu, setShowUserMenu] = useState(false)

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
            <button className={styles.iconButton}>
              <BellOutlined />
            </button>
            {user && (
              <div className={styles.userMenu}>
                <button
                  className={styles.userButton}
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className={styles.avatar} />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      {user.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className={styles.userName}>{user.name}</span>
                </button>
                {showUserMenu && (
                  <div className={styles.dropdown}>
                    <Link href="/settings" className={styles.menuItem}>
                      <SettingOutlined />
                      <span>设置</span>
                    </Link>
                    <button className={styles.menuItem} onClick={handleLogout}>
                      <UserOutlined />
                      <span>登出</span>
                    </button>
                  </div>
                )}
              </div>
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
                <span className={styles.tabIcon}>{item.icon}</span>
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