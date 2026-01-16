'use client'

import React, { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  Home,
  BarChart3,
  TrendingUp,
  FileText,
  Users,
  Globe,
  Settings,
  Image as ImageIcon,
  Video,
  List,
  History,
  ChevronDown,
  Sparkles
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenu,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from '@/components/ui/sidebar'
import { PanelLeft } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { NavItem } from '@/types/dashboard.types'

const navItems: NavItem[] = [
  {
    id: 'home',
    label: '主页',
    icon: <Home className="size-4" />,
    href: '/home'
  },
  {
    id: 'analytics',
    label: '数据分析',
    icon: <BarChart3 className="size-4" />,
    href: '/analytics',
    children: [
      {
        id: 'data-overview',
        label: '数据概览',
        icon: <TrendingUp className="size-4" />,
        href: '/data-overview'
      }
    ]
  },
  {
    id: 'ai-chat',
    label: '智能创作',
    icon: <Sparkles className="size-4" />,
    href: '/ai-chat'
  },
  {
    id: 'publish',
    label: '发布管理',
    icon: <FileText className="size-4" />,
    href: '/publish',
    children: [
      {
        id: 'create-image',
        label: '创建图文',
        icon: <ImageIcon className="size-4" />,
        href: '/publish/create-image'
      },
      {
        id: 'create-article-md',
        label: '创建文章',
        icon: <FileText className="size-4" />,
        href: '/publish/create-article'
      },
      {
        id: 'works-management',
        label: '作品管理',
        icon: <List className="size-4" />,
        href: '/publish/works'
      },
      {
        id: 'publish-history',
        label: '发布记录',
        icon: <History className="size-4" />,
        href: '/publish/history'
      }
    ]
  },
  {
    id: 'accounts',
    label: '账号管理',
    icon: <Users className="size-4" />,
    href: '/accounts'
  },
  {
    id: 'platforms',
    label: '平台管理',
    icon: <Globe className="size-4" />,
    href: '/platforms'
  },
  {
    id: 'settings',
    label: '设置',
    icon: <Settings className="size-4" />,
    href: '/settings'
  }
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const { toggleSidebar, state } = useSidebar()

  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(href + '/')
  }

  const isCollapsed = state === 'collapsed'
  const [activeFlyout, setActiveFlyout] = useState<string | null>(null)
  const [flyoutPosition, setFlyoutPosition] = useState<{ top: number; left: number } | null>(null)
  const flyoutRef = useRef<HTMLDivElement>(null)
  const menuItemRefs = useRef<Record<string, HTMLElement>>({})

  // 调试：监听状态变化
  useEffect(() => {
    console.log('Sidebar state changed:', { state, isCollapsed, activeFlyout })
  }, [state, isCollapsed, activeFlyout])

  const handleParentClick = (itemId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    console.log('handleParentClick called:', { itemId, isCollapsed, state, currentActiveFlyout: activeFlyout })
    if (!isCollapsed) {
      console.log('Sidebar is not collapsed, skipping flyout')
      return
    }
    
    const menuItem = menuItemRefs.current[itemId]
    if (menuItem && activeFlyout !== itemId) {
      const rect = menuItem.getBoundingClientRect()
      setFlyoutPosition({
        top: rect.top,
        left: rect.left + rect.width + 8 // sidebar icon width + margin
      })
    }
    
    const newFlyout = activeFlyout === itemId ? null : itemId
    console.log('Setting activeFlyout to:', newFlyout)
    setActiveFlyout(newFlyout)
    
    if (!newFlyout) {
      setFlyoutPosition(null)
    }
  }

  // 点击外部区域关闭悬浮菜单
  useEffect(() => {
    if (!activeFlyout) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      // 如果点击的是悬浮菜单内部，不关闭
      if (flyoutRef.current && flyoutRef.current.contains(target)) {
        return
      }
      // 如果点击的是触发按钮，也不关闭（由按钮的 onClick 处理）
      if (target.closest('[data-sidebar="menu-button"]')) {
        return
      }
      // 其他情况关闭悬浮菜单
      setActiveFlyout(null)
    }

    // 使用 setTimeout 确保事件处理顺序正确
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside, true)
    }
  }, [activeFlyout])

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link
                href="/home"
                className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center"
              >
                <div className="w-8 h-8 border-2 border-black rounded-lg flex items-center justify-center font-bold text-lg text-black shrink-0 group-data-[collapsible=icon]:w-7 group-data-[collapsible=icon]:h-7">
                  S
                </div>
                <span className="font-bold text-lg text-black group-data-[collapsible=icon]:hidden">
                  SocialWiz
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>导航</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems
                .filter(item => item.visible !== false)
                .map((item) => {
                  const active = isActive(item.href)
                  const hasChildren = item.children && item.children.length > 0

                  if (hasChildren) {
                    // 展开状态：使用 Collapsible 控制内联菜单
                    if (!isCollapsed) {
                      return (
                        <Collapsible key={item.id} defaultOpen={active} className="group/collapsible">
                          <SidebarMenuItem>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton isActive={active}>
                                {item.icon}
                                <span>{item.label}</span>
                                {item.badge && (
                                  <span className="ml-auto text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                                    {item.badge}
                                  </span>
                                )}
                                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <SidebarMenuSub>
                                {item.children!.map((child) => {
                                  const childActive = isActive(child.href)
                                  return (
                                    <SidebarMenuSubItem key={child.id}>
                                      <SidebarMenuSubButton asChild isActive={childActive}>
                                        <Link href={child.href}>
                                          {child.icon}
                                          <span>{child.label}</span>
                                        </Link>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  )
                                })}
                              </SidebarMenuSub>
                            </CollapsibleContent>
                          </SidebarMenuItem>
                        </Collapsible>
                      )
                    }

                    // 折叠状态：点击显示悬浮菜单
                    return (
                      <SidebarMenuItem key={item.id} className="relative">
                        <button
                          type="button"
                          ref={(el) => {
                            if (el) menuItemRefs.current[item.id] = el
                          }}
                          onClick={(e) => {
                            console.log('Button click:', item.id, 'isCollapsed:', isCollapsed)
                            handleParentClick(item.id, e)
                          }}
                          className="peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0"
                          data-active={active}
                        >
                          {item.icon}
                          <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                          {item.badge && (
                            <span className="ml-auto text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5 group-data-[collapsible=icon]:hidden">
                              {item.badge}
                            </span>
                          )}
                        </button>
                        {/* Tooltip for collapsed state */}
                        {isCollapsed && (
                          <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 z-50 ml-2 hidden peer-hover/menu-button:block">
                            <div className="rounded-full bg-sidebar text-sidebar-foreground px-3 py-1.5 text-xs shadow-md whitespace-nowrap">
                              {item.label}
                            </div>
                          </div>
                        )}

                        {/* 点击后显示的悬浮二级菜单 - 使用 Portal 渲染到 body */}
                        {activeFlyout === item.id && flyoutPosition && typeof window !== 'undefined' && createPortal(
                          <div 
                            ref={flyoutRef} 
                            className="fixed z-[99999] pointer-events-auto"
                            style={{
                              left: `${flyoutPosition.left}px`,
                              top: `${flyoutPosition.top}px`
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="min-w-[220px] rounded-lg border border-sidebar-border bg-sidebar text-sidebar-foreground p-2 shadow-2xl z-[99999]">
                              <div className="mb-2 px-1 text-xs font-semibold text-sidebar-foreground/80">
                                {item.label}
                              </div>
                              <ul className="flex flex-col gap-0.5">
                                {item.children!.map((child) => {
                                  const childActive = isActive(child.href)
                                  return (
                                    <li key={child.id}>
                                      <Link
                                        href={child.href}
                                        className={cn(
                                          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer',
                                          'text-sidebar-foreground',
                                          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                                          childActive && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                                        )}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          // 点击子项后关闭悬浮菜单
                                          setActiveFlyout(null)
                                          setFlyoutPosition(null)
                                        }}
                                      >
                                        <span className="text-sidebar-foreground/70">{child.icon}</span>
                                        <span>{child.label}</span>
                                      </Link>
                                    </li>
                                  )
                                })}
                              </ul>
                            </div>
                          </div>,
                          document.body
                        )}
                      </SidebarMenuItem>
                    )
                  }

                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <Link href={item.href}>
                          {item.icon}
                          <span>{item.label}</span>
                          {item.badge && (
                            <span className="ml-auto text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleSidebar} className="w-full justify-start group-data-[collapsible=icon]:justify-center">
              <PanelLeft className="size-4" />
              <span className="group-data-[collapsible=icon]:hidden">收起</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
