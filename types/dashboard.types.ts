import { ReactNode } from 'react'

export interface NavItem {
  id: string
  label: string
  icon: ReactNode
  href: string
  children?: NavItem[]
  visible?: boolean
  badge?: string | number
}

export interface DashboardLayoutState {
  isCollapsed: boolean
  isMobile: boolean
  isDrawerOpen: boolean
}

export interface DashboardSectionCard {
  id: string
  title: string
  description?: string
  value?: string | number | ReactNode
  icon?: ReactNode
  href?: string
  onClick?: () => void
  badge?: string | number
  color?: 'blue' | 'green' | 'purple' | 'pink'
}
