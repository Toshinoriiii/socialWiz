'use client'

import React from 'react'
import Link from 'next/link'
import { BellOutlined, UserOutlined, SettingOutlined, LogoutOutlined } from '@ant-design/icons'
import styles from './Header.module.css'

export interface HeaderProps {
  /** 用户信息 */
  user?: {
    name: string
    avatar?: string
  }
  /** 登出回调 */
  onLogout?: () => void
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  const [showUserMenu, setShowUserMenu] = React.useState(false)

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          <div className={styles.logoIcon}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="url(#gradient)" />
              <path
                d="M16 8L20 12H18V20H14V12H12L16 8Z"
                fill="white"
              />
              <path
                d="M10 18L12 20V22H20V20L22 18V24H10V18Z"
                fill="white"
              />
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="32" y2="32">
                  <stop offset="0%" stopColor="#667eea" />
                  <stop offset="100%" stopColor="#764ba2" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className={styles.logoText}>SocialWiz</span>
        </Link>

        <div className={styles.actions}>
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
                    {user.name.charAt(0).toUpperCase()}
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
                  <button className={styles.menuItem} onClick={onLogout}>
                    <LogoutOutlined />
                    <span>登出</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
