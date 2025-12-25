'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  HomeOutlined,
  EditOutlined,
  BarChartOutlined,
  CalendarOutlined,
  SettingOutlined
} from '@ant-design/icons'
import styles from './Sidebar.module.css'

export interface SidebarProps {
  collapsed?: boolean
}

const menuItems = [
  { key: '/', label: '首页', icon: <HomeOutlined /> },
  { key: '/publish', label: '发布', icon: <EditOutlined /> },
  { key: '/analytics', label: '分析', icon: <BarChartOutlined /> },
  { key: '/schedule', label: '日程', icon: <CalendarOutlined /> },
  { key: '/settings', label: '设置', icon: <SettingOutlined /> }
]

export const Sidebar: React.FC<SidebarProps> = ({ collapsed = false }) => {
  const pathname = usePathname()

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <nav className={styles.nav}>
        {menuItems.map((item) => {
          const isActive = pathname === item.key || pathname?.startsWith(item.key + '/')
          
          return (
            <Link
              key={item.key}
              href={item.key}
              className={`${styles.menuItem} ${isActive ? styles.active : ''}`}
            >
              <span className={styles.icon}>{item.icon}</span>
              {!collapsed && <span className={styles.label}>{item.label}</span>}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
