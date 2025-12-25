'use client'

import React from 'react'
import styles from './TabNav.module.css'

export interface TabNavProps {
  tabs: Array<{
    key: string
    label: string
    icon?: React.ReactNode
  }>
  activeKey: string
  onChange: (key: string) => void
}

export const TabNav: React.FC<TabNavProps> = ({ tabs, activeKey, onChange }) => {
  return (
    <div className={styles.tabNav}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`${styles.tab} ${activeKey === tab.key ? styles.active : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.icon && <span className={styles.icon}>{tab.icon}</span>}
          <span className={styles.label}>{tab.label}</span>
        </button>
      ))}
    </div>
  )
}
