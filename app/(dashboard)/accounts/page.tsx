'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Link as LinkIcon, Unlink, Plus, AlertCircle, CheckCircle, Inbox } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useUserStore } from '@/store/user.store'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { PlatformBrandLogo } from '@/components/dashboard/PlatformBrandLogo'
import { isWeiboOauthUiEnabled } from '@/config/feature-flags'
import { Platform } from '@/types/platform.types'

interface PlatformAccount {
  id: string
  platform: string
  platformUsername: string
  isConnected: boolean
  tokenExpiry?: string
  needsReauth?: boolean
  /** 浏览器会话型：后台用 Cookie 探测；false 表示登录已失效 */
  playwrightSessionAlive?: boolean | null
  createdAt: string
  // 微信特有字段
  appId?: string
  accountName?: string
  subjectType?: 'personal' | 'enterprise'
  canPublish?: boolean
}

const platformConfig: Array<{
  id: string
  platform: Platform
  name: string
  authPath: string | null
}> = [
  {
    id: 'WECHAT',
    platform: Platform.WECHAT,
    name: '微信公众号',
    authPath: '/api/platforms/wechat/auth'
  },
  {
    id: 'WEIBO',
    platform: Platform.WEIBO,
    name: '微博',
    authPath: '/api/platforms/weibo/auth'
  },
  {
    id: 'ZHIHU',
    platform: Platform.ZHIHU,
    name: '知乎',
    authPath: null
  },
  {
    id: 'DOUYIN',
    platform: Platform.DOUYIN,
    name: '抖音',
    authPath: null
  },
  {
    id: 'XIAOHONGSHU',
    platform: Platform.XIAOHONGSHU,
    name: '小红书',
    authPath: null
  }
]

export default function AccountsPage() {
  const { token, user } = useUserStore()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<PlatformAccount[]>([])
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  
  const [platformSelectOpen, setPlatformSelectOpen] = useState(false)

  const [weiboBindOpen, setWeiboBindOpen] = useState(false)
  const [wechatBindOpen, setWechatBindOpen] = useState(false)
  const [zhihuBindOpen, setZhihuBindOpen] = useState(false)
  const [weiboPlaywrightPolling, setWeiboPlaywrightPolling] = useState(false)
  const [wechatPlaywrightPolling, setWechatPlaywrightPolling] = useState(false)
  const [zhihuPlaywrightPolling, setZhihuPlaywrightPolling] = useState(false)
  const weiboSawInProgressRef = useRef(false)
  const weiboBindStartedAtRef = useRef(0)
  const wechatSawInProgressRef = useRef(false)
  const wechatBindStartedAtRef = useRef(0)
  const zhihuSawInProgressRef = useRef(false)
  const zhihuBindStartedAtRef = useRef(0)

  const loadAccounts = async () => {
    if (!token) return

    try {
      setLoading(true)
      
      const platformsResponse = await fetch('/api/platforms', {
        headers: { Authorization: `Bearer ${token}` }
      })

      const allAccounts: PlatformAccount[] = []

      if (platformsResponse.ok) {
        const platformData = await platformsResponse.json()
        allAccounts.push(...platformData)
      }

      setAccounts(allAccounts)
    } catch (error) {
      console.error('加载账号列表失败:', error)
      toast.error('网络错误,请重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) {
      loadAccounts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const startWeiboBind = () => {
    setPlatformSelectOpen(false)
    setWeiboBindOpen(true)
  }

  const startWeiboOAuthFlow = async () => {
    if (!token) {
      toast.error('未登录')
      return
    }
    if (accounts.some((a) => a.platform === 'WEIBO')) {
      toast.error('已绑定微博，请先解绑后再使用开放平台授权')
      return
    }
    setWeiboBindOpen(false)
    try {
      setConnecting('WEIBO')
      const response = await fetch('/api/platforms/weibo/auth', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (response.ok && data.authUrl) {
        window.location.href = data.authUrl
      } else {
        toast.error(data.error || '获取授权链接失败')
      }
    } catch {
      toast.error('网络错误，请重试')
    } finally {
      setConnecting(null)
    }
  }

  const startWeiboPlaywrightBind = async () => {
    if (!token) {
      toast.error('未登录')
      return
    }
    try {
      setConnecting('WEIBO')
      const r = await fetch('/api/platforms/weibo/playwright-bind', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await r.json()
      if (!r.ok) {
        const extra = [data.detail, data.hint].filter(Boolean).join('\n')
        toast.error(
          extra ? `${data.error || '启动失败'}\n${extra}` : data.error || '启动失败'
        )
        return
      }
      if (data.started === false) {
        toast.warning(
          data.message ||
            '检测到已有进行中的绑定；若实际上没有登录窗口，请到项目 sessions 目录删除对应 .binding.lock 后重试。'
        )
        return
      }
      toast.message(data.message || '请在弹出的浏览器中登录微博')
      weiboBindStartedAtRef.current = Date.now()
      weiboSawInProgressRef.current = false
      setWeiboPlaywrightPolling(true)
    } catch (error) {
      console.error(error)
      toast.error('网络错误,请重试')
    } finally {
      setConnecting(null)
    }
  }

  useEffect(() => {
    if (!weiboPlaywrightPolling || !token) return

    const finishCancelled = () => {
      weiboSawInProgressRef.current = false
      setWeiboPlaywrightPolling(false)
      setWeiboBindOpen(false)
      toast.message('登录窗口已关闭，绑定已取消')
    }

    const tick = async () => {
      try {
        const r = await fetch('/api/platforms/weibo/playwright-bind', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await r.json()
        if (!r.ok) return

        if (data.bound) {
          weiboSawInProgressRef.current = false
          toast.success('微博绑定成功')
          setWeiboPlaywrightPolling(false)
          setWeiboBindOpen(false)
          void loadAccounts()
          return
        }

        if (data.inProgress) {
          weiboSawInProgressRef.current = true
          return
        }

        // 未绑定且服务端已不再标记进行中：脚本退出（含用户关掉 Playwright 窗口）
        const elapsed = Date.now() - weiboBindStartedAtRef.current
        const definitelyEnded =
          weiboSawInProgressRef.current || elapsed > 5000
        if (definitelyEnded) {
          finishCancelled()
        }
      } catch {
        /* ignore */
      }
    }

    void tick()
    const id = window.setInterval(() => void tick(), 2000)
    return () => window.clearInterval(id)
  }, [weiboPlaywrightPolling, token])

  const startWechatPlaywrightBind = async () => {
    if (!token) {
      toast.error('未登录')
      return
    }
    try {
      setConnecting('WECHAT')
      const r = await fetch('/api/platforms/wechat/playwright-bind', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await r.json()
      if (!r.ok) {
        const extra = [data.detail, data.hint].filter(Boolean).join('\n')
        toast.error(
          extra ? `${data.error || '启动失败'}\n${extra}` : data.error || '启动失败'
        )
        return
      }
      if (data.started === false) {
        toast.warning(
          data.message ||
            '检测到已有进行中的绑定；若实际上没有登录窗口，请到 scripts/wechat-playwright/sessions 删除对应 .binding.lock 后重试。'
        )
        return
      }
      toast.message(data.message || '请在弹出的浏览器中登录微信公众平台')
      wechatBindStartedAtRef.current = Date.now()
      wechatSawInProgressRef.current = false
      setWechatPlaywrightPolling(true)
    } catch (error) {
      console.error(error)
      toast.error('网络错误,请重试')
    } finally {
      setConnecting(null)
    }
  }

  useEffect(() => {
    if (!wechatPlaywrightPolling || !token) return

    const finishCancelled = () => {
      wechatSawInProgressRef.current = false
      setWechatPlaywrightPolling(false)
      setWechatBindOpen(false)
      toast.message('登录窗口已关闭，绑定已取消')
    }

    const tick = async () => {
      try {
        const r = await fetch('/api/platforms/wechat/playwright-bind', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await r.json()
        if (!r.ok) return

        if (data.bound) {
          wechatSawInProgressRef.current = false
          toast.success('微信公众号绑定成功')
          setWechatPlaywrightPolling(false)
          setWechatBindOpen(false)
          void loadAccounts()
          return
        }

        if (data.inProgress) {
          wechatSawInProgressRef.current = true
          return
        }

        const elapsed = Date.now() - wechatBindStartedAtRef.current
        const definitelyEnded =
          wechatSawInProgressRef.current || elapsed > 5000
        if (definitelyEnded) {
          finishCancelled()
        }
      } catch {
        /* ignore */
      }
    }

    void tick()
    const id = window.setInterval(() => void tick(), 2000)
    return () => window.clearInterval(id)
  }, [wechatPlaywrightPolling, token])

  const startZhihuPlaywrightBind = async () => {
    if (!token) {
      toast.error('未登录')
      return
    }
    try {
      setConnecting('ZHIHU')
      const r = await fetch('/api/platforms/zhihu/playwright-bind', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await r.json()
      if (!r.ok) {
        const extra = [data.detail, data.hint].filter(Boolean).join('\n')
        toast.error(
          extra ? `${data.error || '启动失败'}\n${extra}` : data.error || '启动失败'
        )
        return
      }
      if (data.started === false) {
        toast.warning(
          data.message ||
            '检测到已有进行中的绑定；若实际上没有登录窗口，请到 scripts/zhihu-playwright/sessions 删除对应 .binding.lock 后重试。'
        )
        return
      }
      toast.message(data.message || '请在弹出的浏览器中登录知乎')
      zhihuBindStartedAtRef.current = Date.now()
      zhihuSawInProgressRef.current = false
      setZhihuPlaywrightPolling(true)
    } catch (error) {
      console.error(error)
      toast.error('网络错误,请重试')
    } finally {
      setConnecting(null)
    }
  }

  useEffect(() => {
    if (!zhihuPlaywrightPolling || !token) return

    const finishCancelled = () => {
      zhihuSawInProgressRef.current = false
      setZhihuPlaywrightPolling(false)
      setZhihuBindOpen(false)
      toast.message('登录窗口已关闭，绑定已取消')
    }

    const tick = async () => {
      try {
        const r = await fetch('/api/platforms/zhihu/playwright-bind', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await r.json()
        if (!r.ok) return

        if (data.bound) {
          zhihuSawInProgressRef.current = false
          toast.success('知乎绑定成功')
          setZhihuPlaywrightPolling(false)
          setZhihuBindOpen(false)
          void loadAccounts()
          return
        }

        if (data.inProgress) {
          zhihuSawInProgressRef.current = true
          return
        }

        const elapsed = Date.now() - zhihuBindStartedAtRef.current
        const definitelyEnded =
          zhihuSawInProgressRef.current || elapsed > 5000
        if (definitelyEnded) {
          finishCancelled()
        }
      } catch {
        /* ignore */
      }
    }

    void tick()
    const id = window.setInterval(() => void tick(), 2000)
    return () => window.clearInterval(id)
  }, [zhihuPlaywrightPolling, token])

  // 连接平台账号
  const handleConnect = async (platformId: string) => {
    const platform = platformConfig.find(p => p.id === platformId)
    if (!platform) return

    if (platformId === 'WECHAT') {
      setWechatBindOpen(true)
      void startWechatPlaywrightBind()
      return
    }

    if (platformId === 'WEIBO') {
      startWeiboBind()
      return
    }

    if (platformId === 'ZHIHU') {
      setZhihuBindOpen(true)
      void startZhihuPlaywrightBind()
      return
    }

    if (!platform.authPath) {
      toast.error(`${platform.name}暂未开放,敬请期待`)
      return
    }

    if (!token) {
      toast.error('未登录')
      return
    }

    try {
      setConnecting(platformId)
      const response = await fetch(platform.authPath, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (response.ok && data.authUrl) {
        // 跳转到授权页面
        window.location.href = data.authUrl
      } else {
        toast.error(data.error || '获取授权链接失败')
      }
    } catch (error) {
      console.error('连接平台失败:', error)
      toast.error('网络错误,请重试')
    } finally {
      setConnecting(null)
    }
  }

  // 解绑平台账号
  const handleDisconnect = async (accountId: string, platformName: string, platform: string) => {
    if (!token) {
      toast.error('未登录')
      return
    }

    if (!confirm(`确定要解绑${platformName}账号吗?`)) {
      return
    }

    try {
      setDisconnecting(accountId)
      
      let apiPath: string
      if (platform === 'WECHAT') {
        apiPath = `/api/platforms/wechat/${accountId}/disconnect`
      } else if (platform === 'WEIBO') {
        apiPath = `/api/platforms/weibo/${accountId}/disconnect`
      } else if (platform === 'ZHIHU') {
        apiPath = `/api/platforms/zhihu/${accountId}/disconnect`
      } else {
        apiPath = `/api/platforms/${accountId}/disconnect`
      }

      const response = await fetch(apiPath, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (response.ok || data.success) {
        toast.success('解绑成功')
        await loadAccounts()
      } else {
        toast.error(data.error || '解绑失败')
      }
    } catch (error) {
      console.error('解绑失败:', error)
      toast.error('网络错误,请重试')
    } finally {
      setDisconnecting(null)
    }
  }

  // 获取平台配置
  const getPlatformConfig = (platformId: string) => {
    return platformConfig.find(p => p.id === platformId)
  }

  // 获取账号状态
  const getAccountByPlatform = (platformId: string) => {
    return accounts.find(acc => acc.platform === platformId)
  }

  const hasBoundPlatform = (platformId: string) =>
    accounts.some((a) => a.platform === platformId)

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-black mb-2">账号管理</h1>
        <p className="text-gray-600">
          管理您的社交媒体账号绑定。当前<strong>每个平台仅支持绑定一个账号</strong>；换绑请先解绑。
        </p>
      </div>

      {/* 空状态 - 没有绑定任何账号时显示 */}
      {!loading && accounts.length === 0 && (
        <Card className="border border-gray-300 bg-white">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Inbox className="size-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-black mb-2">暂无绑定账号</h3>
            <p className="text-sm text-gray-500 mb-6 text-center max-w-md">
              连接您的社交媒体账号,开始在多个平台发布内容
            </p>
            <Button
              onClick={() => setPlatformSelectOpen(true)}
              className="bg-black text-white hover:bg-gray-800 transition-all duration-150"
            >
              <Plus className="size-4 mr-2" />
              添加账号
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 账号列表 */}
      {(loading || accounts.length > 0) && (
      <Card className="border border-gray-300 bg-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-black">已绑定账号</CardTitle>
              <CardDescription className="text-gray-600">
                管理您已连接的社交媒体账号
              </CardDescription>
            </div>
            <Button
              onClick={() => setPlatformSelectOpen(true)}
              size="sm"
              className="bg-black text-white hover:bg-gray-800 transition-all duration-150"
            >
              <Plus className="size-4 mr-2" />
              添加账号
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-600">加载中...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accounts.map((account) => {
                const platform = getPlatformConfig(account.platform)
                if (!platform) return null
                
                const needsReauth = account.needsReauth || false
                const browserLoginExpired = account.playwrightSessionAlive === false

                return (
                  <Card key={account.id} className="border-2 border-gray-200 hover:border-gray-300 transition-all duration-150">
                    <CardContent className="pt-6">
                      {/* 平台图标和状态 */}
                      <div className="flex items-start justify-between mb-4">
                        <PlatformBrandLogo
                          platform={platform.platform}
                          size={36}
                          tileClassName="bg-neutral-100 dark:bg-neutral-800"
                        />
                        {account.isConnected && (
                          needsReauth ? (
                            <Badge variant="outline" className="text-xs border-yellow-300 text-yellow-700 bg-yellow-50">
                              <AlertCircle className="size-3 mr-1" />
                              {browserLoginExpired ? '需重新登录' : '需要重新授权'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs border-green-300 text-green-700 bg-green-50">
                              <CheckCircle className="size-3 mr-1" />
                              已连接
                            </Badge>
                          )
                        )}
                      </div>

                      {browserLoginExpired && (
                        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4">
                          该平台在本机保存的浏览器登录已失效，请重新连接并完成登录。
                        </p>
                      )}

                      {/* 平台名称 */}
                      <div className="font-semibold text-black mb-2">{platform.name}</div>

                      {/* 账号信息 */}
                      <div className="space-y-2 mb-4">
                        <div className="text-sm text-gray-600 truncate">
                          账号: {account.platformUsername}
                        </div>
                        
                        {/* 微信平台特有信息 */}
                        {platform.id === 'WECHAT' && account.appId && (
                          <div className="space-y-1">
                            <div className="text-xs text-gray-500">
                              AppID: {account.appId}
                            </div>
                            {account.subjectType && (
                              <div className="text-xs text-gray-500">
                                主体类型: {account.subjectType === 'personal' ? '个人主体' : '企业主体'}
                              </div>
                            )}
                            {account.canPublish !== undefined && (
                              <div className="text-xs">
                                <span className={account.canPublish ? 'text-green-600' : 'text-yellow-600'}>
                                  {account.canPublish ? '✓ 支持发布' : '⚠ 仅支持查看(个人主体)'}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* OAuth平台的token过期信息 */}
                        {account.tokenExpiry && platform.id !== 'WECHAT' && (
                          <div className="text-xs text-gray-500">
                            授权到期: {new Date(account.tokenExpiry).toLocaleDateString('zh-CN')}
                          </div>
                        )}
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex gap-2">
                        {needsReauth && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleConnect(platform.id)}
                            disabled={connecting === platform.id}
                            className="flex-1 border-yellow-300 text-yellow-700 hover:bg-yellow-50 transition-all duration-150"
                          >
                            <LinkIcon className="size-4 mr-1" />
                            {connecting === platform.id
                              ? '连接中...'
                              : browserLoginExpired
                                ? '重新连接'
                                : '重新授权'}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDisconnect(account.id, platform.name, platform.id)}
                          disabled={disconnecting === account.id}
                          className={`${needsReauth ? '' : 'flex-1'} border-gray-300 text-gray-700 hover:bg-gray-100 transition-all duration-150`}
                        >
                          <Unlink className="size-4 mr-1" />
                          {disconnecting === account.id ? '解绑中...' : '解绑'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* 提示信息 */}
      <Alert className="border-blue-200 bg-blue-50">
        <AlertCircle className="size-4 text-blue-600" />
        <AlertDescription className="text-blue-800 text-sm">
          每个平台支持绑定一个账号，绑定账号后请在平台管理中添加相关发布配置。
        </AlertDescription>
      </Alert>

      {/* 平台选择弹窗 */}
      <Dialog open={platformSelectOpen} onOpenChange={setPlatformSelectOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white border border-gray-300">
          <DialogHeader>
            <DialogTitle className="text-black">选择要连接的平台</DialogTitle>
            <DialogDescription className="text-gray-600">
              选择平台。已绑定的平台需先解绑才能换绑。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {platformConfig.map((platform) => {
              const isWeibo = platform.id === 'WEIBO'
              const isZhihu = platform.id === 'ZHIHU'
              const bound = hasBoundPlatform(platform.id)
              const comingSoon =
                platform.id !== 'WECHAT' &&
                platform.id !== 'WEIBO' &&
                platform.id !== 'ZHIHU' &&
                !platform.authPath
              const rowDisabled =
                connecting === platform.id || comingSoon || bound

              return (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => {
                    if (rowDisabled) return
                    if (isWeibo) {
                      setPlatformSelectOpen(false)
                      setWeiboBindOpen(true)
                      void startWeiboPlaywrightBind()
                      return
                    }
                    if (isZhihu) {
                      setPlatformSelectOpen(false)
                      setZhihuBindOpen(true)
                      void startZhihuPlaywrightBind()
                      return
                    }
                    if (platform.id === 'WECHAT') {
                      setPlatformSelectOpen(false)
                      setWechatBindOpen(true)
                      void startWechatPlaywrightBind()
                      return
                    }
                    handleConnect(platform.id)
                  }}
                  disabled={rowDisabled}
                  className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all duration-150 text-left ${
                    rowDisabled
                      ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                      : 'border-gray-300 hover:border-black hover:bg-gray-50 cursor-pointer active:scale-[0.98]'
                  }`}
                >
                  <PlatformBrandLogo
                    platform={platform.platform}
                    size={36}
                    tileClassName="bg-neutral-100 dark:bg-neutral-800"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-black mb-1">{platform.name}</div>
                    <div className="text-xs text-gray-500">
                      {bound
                        ? '已通过账号管理绑定，请先解绑再换绑'
                        : isWeibo
                          ? '本机浏览器登录（主路径）'
                          : isZhihu
                            ? '本机浏览器登录（主路径）'
                            : platform.id === 'WECHAT'
                            ? '本机浏览器登录公众平台（主路径）'
                            : platform.authPath
                              ? '点击连接'
                              : '即将开放'}
                    </div>
                  </div>
                  {bound && (
                    <Badge variant="outline" className="text-xs border-green-300 text-green-700 bg-green-50">
                      <CheckCircle className="size-3 mr-1" />
                      已绑定
                    </Badge>
                  )}
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* 微博绑定：本机 Playwright 浏览器登录 */}
      <Dialog
        open={weiboBindOpen}
        onOpenChange={(open) => {
          setWeiboBindOpen(open)
          if (!open) {
            weiboSawInProgressRef.current = false
            setWeiboPlaywrightPolling(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px] bg-white border border-gray-300">
          <DialogHeader>
            <DialogTitle className="text-black">绑定微博账号</DialogTitle>
            <DialogDescription className="text-gray-600">
              请在随后弹出的窗口中完成微博登录。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Button
              className="w-full bg-red-600 text-white hover:bg-red-700"
              onClick={() => void startWeiboPlaywrightBind()}
              disabled={connecting === 'WEIBO' || weiboPlaywrightPolling}
            >
              {weiboPlaywrightPolling
                ? '等待登录中…'
                : connecting === 'WEIBO'
                  ? '启动中…'
                  : '连接微博（本机浏览器）'}
            </Button>
            {isWeiboOauthUiEnabled() && (
              <Button
                type="button"
                variant="outline"
                className="w-full border-gray-300"
                onClick={() => void startWeiboOAuthFlow()}
                disabled={connecting === 'WEIBO'}
              >
                使用微博开放平台授权（高级）
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={zhihuBindOpen}
        onOpenChange={(open) => {
          setZhihuBindOpen(open)
          if (!open) {
            zhihuSawInProgressRef.current = false
            setZhihuPlaywrightPolling(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px] bg-white border border-gray-300">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <PlatformBrandLogo
                platform={Platform.ZHIHU}
                size={36}
                tileClassName="bg-neutral-100 dark:bg-neutral-800"
              />
              <DialogTitle className="text-black">绑定知乎账号</DialogTitle>
            </div>
            <DialogDescription className="text-gray-600">
              请在随后弹出的窗口中登录 <strong>www.zhihu.com</strong>。绑定后发布专栏文章将走 zhuanlan 写作接口（需 Cookie：<code className="text-xs">z_c0</code>、<code className="text-xs">_xsrf</code> 等）。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Button
              className="w-full bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => void startZhihuPlaywrightBind()}
              disabled={connecting === 'ZHIHU' || zhihuPlaywrightPolling}
            >
              {zhihuPlaywrightPolling
                ? '等待登录中…'
                : connecting === 'ZHIHU'
                  ? '启动中…'
                  : '连接知乎（本机浏览器）'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={wechatBindOpen}
        onOpenChange={(open) => {
          setWechatBindOpen(open)
          if (!open) {
            wechatSawInProgressRef.current = false
            setWechatPlaywrightPolling(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px] bg-white border border-gray-300">
          <DialogHeader>
            <DialogTitle className="text-black">绑定微信公众号</DialogTitle>
            <DialogDescription className="text-gray-600">
              请在随后弹出的窗口中登录 <strong>mp.weixin.qq.com</strong> 公众平台。绑定后发文将复现网页端素材/群发接口（非开放平台）。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Button
              className="w-full bg-green-600 text-white hover:bg-green-700"
              onClick={() => void startWechatPlaywrightBind()}
              disabled={connecting === 'WECHAT' || wechatPlaywrightPolling}
            >
              {wechatPlaywrightPolling
                ? '等待登录中…'
                : connecting === 'WECHAT'
                  ? '启动中…'
                  : '连接微信（本机浏览器）'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
