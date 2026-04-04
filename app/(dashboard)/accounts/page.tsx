'use client'

import React, { useState, useEffect, useRef } from 'react'
import { MessageCircle, Link as LinkIcon, Unlink, Plus, AlertCircle, CheckCircle, Inbox } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUserStore } from '@/store/user.store'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import WechatConfigGuide from '@/components/dashboard/platforms/WechatConfigGuide'
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
  
  // 弹窗状态
  const [platformSelectOpen, setPlatformSelectOpen] = useState(false)
  const [wechatConfigOpen, setWechatConfigOpen] = useState(false)
  
  // 微信配置表单
  const [wechatForm, setWechatForm] = useState({
    appId: '',
    appSecret: '',
    accountName: '',
    subjectType: 'personal' as 'personal' | 'enterprise'
  })
  const [submitting, setSubmitting] = useState(false)

  const [weiboBindOpen, setWeiboBindOpen] = useState(false)
  const [weiboPlaywrightPolling, setWeiboPlaywrightPolling] = useState(false)
  /** 本轮绑定：是否曾出现 inProgress（锁存在）；用于区分「尚未开始」与「已结束未绑定」 */
  const weiboSawInProgressRef = useRef(false)
  /** 本轮开始轮询的时间戳；用于用户极快关掉窗口时尚未拉到 inProgress 的兜底 */
  const weiboBindStartedAtRef = useRef(0)

  const loadAccounts = async () => {
    if (!token) return

    try {
      setLoading(true)
      
      // 并行获取OAuth平台账号和微信配置
      const [platformsResponse, wechatResponse] = await Promise.all([
        fetch('/api/platforms', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/platforms/wechat/config', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ])

      const allAccounts: PlatformAccount[] = []

      // 处理OAuth平台账号
      if (platformsResponse.ok) {
        const platformData = await platformsResponse.json()
        allAccounts.push(...platformData)
      }

      // 处理微信配置
      if (wechatResponse.ok) {
        const wechatConfigs = await wechatResponse.json()
        // 将微信配置转换为PlatformAccount格式
        const wechatAccounts: PlatformAccount[] = wechatConfigs.map((config: any) => ({
          id: config.id,
          platform: 'WECHAT',
          platformUsername: config.accountName || config.appId,
          isConnected: config.isActive,
          tokenExpiry: undefined,
          needsReauth: false,
          createdAt: config.createdAt,
          // 微信特有字段
          appId: config.appId,
          accountName: config.accountName,
          subjectType: config.subjectType,
          canPublish: config.canPublish
        }))
        allAccounts.push(...wechatAccounts)
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

  // 连接平台账号
  const handleConnect = async (platformId: string) => {
    const platform = platformConfig.find(p => p.id === platformId)
    if (!platform) return

    // 微信平台使用配置表单
    if (platformId === 'WECHAT') {
      setPlatformSelectOpen(false)
      setWechatConfigOpen(true)
      return
    }

    if (platformId === 'WEIBO') {
      startWeiboBind()
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

  // 提交微信配置
  const handleWechatSubmit = async () => {
    if (!token) {
      toast.error('未登录')
      return
    }

    // 验证表单
    if (!wechatForm.appId.trim()) {
      toast.error('请输入AppID')
      return
    }
    if (!wechatForm.appSecret.trim()) {
      toast.error('请输入AppSecret')
      return
    }

    try {
      setSubmitting(true)
      const response = await fetch('/api/platforms/wechat/config', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(wechatForm)
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('微信公众号配置成功')
        setWechatConfigOpen(false)
        // 重置表单
        setWechatForm({
          appId: '',
          appSecret: '',
          accountName: '',
          subjectType: 'personal'
        })
        // 刷新账号列表
        await loadAccounts()
      } else {
        toast.error(data.error || '配置失败')
      }
    } catch (error) {
      console.error('配置微信失败:', error)
      toast.error('网络错误,请重试')
    } finally {
      setSubmitting(false)
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
      
      // 微信平台使用不同的API路径
      let apiPath: string
      if (platform === 'WECHAT') {
        apiPath = `/api/platforms/wechat/config/${accountId}`
      } else if (platform === 'WEIBO') {
        apiPath = `/api/platforms/weibo/${accountId}/disconnect`
      } else {
        apiPath = `/api/platforms/${accountId}/disconnect`
      }
      
      const response = await fetch(apiPath, {
        method: platform === 'WECHAT' ? 'DELETE' : 'POST',
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
                              需要重新授权
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs border-green-300 text-green-700 bg-green-50">
                              <CheckCircle className="size-3 mr-1" />
                              已连接
                            </Badge>
                          )
                        )}
                      </div>

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
                            {connecting === platform.id ? '连接中...' : '重新授权'}
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
          <strong>提示：</strong>每个平台仅一个绑定。连接后可在发布流程中选号发文。微博主路径为<strong>本机浏览器登录</strong>；OAuth 仅在开启「开放平台授权」时使用，且与浏览器绑定互斥。
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
              const bound = hasBoundPlatform(platform.id)
              const comingSoon =
                platform.id !== 'WECHAT' &&
                platform.id !== 'WEIBO' &&
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
                          : platform.authPath || platform.id === 'WECHAT'
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

      {/* 微信配置弹窗 */}
      <Dialog open={wechatConfigOpen} onOpenChange={setWechatConfigOpen}>
        <DialogContent className="sm:max-w-[800px] bg-white border border-gray-300 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-black flex items-center gap-2">
              <MessageCircle className="size-5 text-green-600" />
              绑定微信公众号
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              请按照以下步骤配置您的微信公众号，配置成功后即可发布内容。
            </DialogDescription>
          </DialogHeader>

          {/* 配置指引 */}
          <div className="py-4">
            <WechatConfigGuide 
              showPersonalWarning={wechatForm.subjectType === 'personal'}
            />
          </div>

          <Separator className="bg-gray-200" />

          {/* 配置表单 */}
          <div className="space-y-4 pt-4">
            <h4 className="font-semibold text-black">填写配置信息</h4>
            
            {/* AppID */}
            <div className="space-y-2">
              <Label htmlFor="appId" className="text-black">
                AppID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="appId"
                value={wechatForm.appId}
                onChange={(e) => setWechatForm({ ...wechatForm, appId: e.target.value })}
                placeholder="请输入微信公众号AppID"
                className="bg-white border-gray-300 text-black font-mono"
              />
            </div>

            {/* AppSecret */}
            <div className="space-y-2">
              <Label htmlFor="appSecret" className="text-black">
                AppSecret <span className="text-red-500">*</span>
              </Label>
              <Input
                id="appSecret"
                type="password"
                value={wechatForm.appSecret}
                onChange={(e) => setWechatForm({ ...wechatForm, appSecret: e.target.value })}
                placeholder="请输入微信公众号AppSecret"
                className="bg-white border-gray-300 text-black font-mono"
              />
              <p className="text-xs text-gray-500">
                加密存储，仅用于调用微信API
              </p>
            </div>

            {/* 账号名称 */}
            <div className="space-y-2">
              <Label htmlFor="accountName" className="text-black">
                账号名称(可选)
              </Label>
              <Input
                id="accountName"
                value={wechatForm.accountName}
                onChange={(e) => setWechatForm({ ...wechatForm, accountName: e.target.value })}
                placeholder="例如：我的公众号"
                className="bg-white border-gray-300 text-black"
              />
              <p className="text-xs text-gray-500">
                用于标识此公众号，留空将使用AppID
              </p>
            </div>

            {/* 主体类型 */}
            <div className="space-y-2">
              <Label htmlFor="subjectType" className="text-black">
                主体类型 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={wechatForm.subjectType}
                onValueChange={(value: 'personal' | 'enterprise') => 
                  setWechatForm({ ...wechatForm, subjectType: value })
                }
              >
                <SelectTrigger className="bg-white border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">个人主体</SelectItem>
                  <SelectItem value="enterprise">企业主体</SelectItem>
                </SelectContent>
              </Select>
              {wechatForm.subjectType === 'personal' && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="size-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800 text-xs">
                    <strong>重要提示：</strong>个人主体公众号不支持发布功能，仅能获取信息。如需发布功能，请使用企业主体公众号。
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
          
          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setWechatConfigOpen(false)
                setWechatForm({
                  appId: '',
                  appSecret: '',
                  accountName: '',
                  subjectType: 'personal'
                })
              }}
              className="border-gray-300 text-black hover:bg-gray-100 transition-all duration-150"
            >
              取消
            </Button>
            <Button
              onClick={handleWechatSubmit}
              disabled={submitting || !wechatForm.appId || !wechatForm.appSecret}
              className="bg-black text-white hover:bg-gray-800 transition-all duration-150"
            >
              {submitting ? '验证并保存中...' : '验证并保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
