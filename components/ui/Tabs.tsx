'use client'

import React from 'react'
import styles from './Tabs.module.css'

export interface Tab {
  id: string
  label: string
  icon?: string
}

export interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (tabId: string) => void
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange }) => {
  return (
    <div className={styles.tabs}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
        >
          {tab.icon && <span className={styles.tabIcon}>{tab.icon}</span>}
          <span className={styles.tabLabel}>{tab.label}</span>
        </button>
      ))}
    </div>
  )
}
