'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Header, Sidebar } from '@/components/layout'
import { useUserStore } from '@/store/user.store'
import styles from './layout.module.css'
    
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
    <div className={styles.layout}>
      <Header user={user || undefined} onLogout={handleLogout} />
      <div className={styles.container}>
        <Sidebar />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  )
}
'use client'

