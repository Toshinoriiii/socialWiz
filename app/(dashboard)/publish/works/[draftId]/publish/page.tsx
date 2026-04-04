'use client'

/**
 * 作品发布流程页面
 * 步骤：选择平台账号 → 选择平台配置 → 发布中 → 发布完成
 * - 只显示用户已绑定的平台账号
 * - 只显示用户已创建的平台配置
 */

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useUserStore } from '@/store/user.store'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Send,
  Settings,
  Loader2,
  Check,
  CheckCircle2,
  User,
  RefreshCw,
  Search,
  History as HistoryIcon,
} from 'lucide-react'
import { PlatformBrandLogo } from '@/components/dashboard/PlatformBrandLogo'
import { Platform } from '@/types/platform.types'

interface PlatformAccount {
  id: string
  platform: string
  platformUsername: string
  isConnected: boolean
  canPublish?: boolean
  accountName?: string
  appId?: string
}

interface PlatformPublishConfig {
  id: string
  platform: string
  configName: string
  description?: string
  configData: Record<string, unknown>
  isDefault: boolean
}

interface Draft {
  id: string
  title: string
  content: string
  coverImage?: string | null
  images?: string[]
  contentType?: string | null
  status?: string
  publishedAt?: string | null
}

const STEPS = [
  { id: 1, key: 'accounts', label: '选择平台账号', desc: '选择要发布的平台账号', icon: User },
  { id: 2, key: 'config', label: '选择平台配置', desc: '为各平台选择发布配置', icon: Settings },
  { id: 3, key: 'publishing', label: '发布中', desc: '正在执行发布任务', icon: Send },
  { id: 4, key: 'complete', label: '发布完成', desc: '发布任务已完成', icon: CheckCircle2 },
]

const PLATFORM_INFO: Record<string, { name: string }> = {
  WECHAT: { name: '微信公众号' },
  WEIBO: { name: '微博' },
  DOUYIN: { name: '抖音' },
  XIAOHONGSHU: { name: '小红书' },
}

function isKnownPlatform (p: string): p is Platform {
  return (Object.values(Platform) as string[]).includes(p)
}

/** 与平台配置弹窗相同的品牌 SVG + 中性衬底 */
function AccountPlatformLogo ({ platformKey }: { platformKey: string }) {
  if (isKnownPlatform(platformKey)) {
    return (
      <PlatformBrandLogo
        platform={platformKey}
        size={28}
        tileClassName="shrink-0 bg-neutral-100 dark:bg-neutral-800"
      />
    )
  }
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
      <User className="size-5 text-muted-foreground" />
    </div>
  )
}

async function pollPublishJob(
  token: string,
  jobId: string,
  options?: { maxAttempts?: number; intervalMs?: number }
): Promise<{ ok: boolean; status: string; errorMessage?: string | null }> {
  const maxAttempts = options?.maxAttempts ?? 30
  const intervalMs = options?.intervalMs ?? 1000
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`/api/platforms/publish/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, status: 'FAILED', errorMessage: data.error || '查询任务失败' }
    }
    if (data.status === 'SUCCESS' || data.status === 'FAILED') {
      return {
        ok: data.status === 'SUCCESS',
        status: data.status,
        errorMessage: data.errorMessage,
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return { ok: false, status: 'FAILED', errorMessage: '等待任务结果超时' }
}

/** 各平台支持的内容类型：微信仅支持文章，微博支持文章和图文 */
const PLATFORM_CONTENT_SUPPORT: Record<string, ('article' | 'image-text')[]> = {
  WECHAT: ['article'],
  WEIBO: ['article', 'image-text'],
  DOUYIN: ['article', 'image-text'],
  XIAOHONGSHU: ['article', 'image-text'],
}

export default function PublishFlowPage() {
  const router = useRouter()
  const params = useParams()
  const draftId = params?.draftId as string
  const { token, user } = useUserStore()

  const [currentStep, setCurrentStep] = useState(1)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [accounts, setAccounts] = useState<PlatformAccount[]>([])
  const [configs, setConfigs] = useState<PlatformPublishConfig[]>([])
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set())
  const [accountConfigMap, setAccountConfigMap] = useState<Record<string, string>>({})
  const [publishResults, setPublishResults] = useState<Array<{ accountId: string; success: boolean; message?: string }>>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [publishing, setPublishing] = useState(false)

  // 加载草稿
  useEffect(() => {
    if (draftId && token) {
      loadDraft()
    }
  }, [draftId, token])

  // 加载已绑定账号
  useEffect(() => {
    if (token && currentStep <= 2) {
      loadAccounts()
    }
  }, [token, currentStep])

  // 草稿加载后清除不支持的平台选择（如图文草稿时清掉微信）
  useEffect(() => {
    if (!draft?.contentType || selectedAccountIds.size === 0) return
    const ct = draft.contentType === 'image-text' ? 'image-text' : 'article'
    const invalidIds = Array.from(selectedAccountIds).filter(id => {
      const acc = accounts.find(a => a.id === id)
      return acc && !(PLATFORM_CONTENT_SUPPORT[acc.platform]?.includes(ct))
    })
    if (invalidIds.length > 0) {
      setSelectedAccountIds(prev => {
        const next = new Set(prev)
        invalidIds.forEach(id => next.delete(id))
        return next
      })
    }
  }, [draft?.contentType, accounts, selectedAccountIds])

  // 加载平台配置（当选择了账号后进入步骤2时）
  useEffect(() => {
    if (!user?.id || selectedAccountIds.size === 0 || currentStep !== 2) return
    const platforms = [...new Set(Array.from(selectedAccountIds).map(id => {
      const acc = accounts.find(a => a.id === id)
      return acc?.platform
    }).filter(Boolean))] as string[]
    if (platforms.length === 0) return

    let cancelled = false
    const fetchConfigs = async () => {
      try {
        const allConfigs: PlatformPublishConfig[] = []
        for (const platform of platforms) {
          const res = await fetch(
            `/api/platforms/publish-configs?userId=${user.id}&platform=${platform}`
          )
          if (res.ok) {
            const data = await res.json()
            allConfigs.push(...(data.configs || []))
          }
        }
        if (!cancelled) setConfigs(allConfigs)
      } catch (e) {
        console.error('加载配置失败:', e)
        if (!cancelled) toast.error('加载配置失败')
      }
    }
    fetchConfigs()
    return () => { cancelled = true }
  }, [user?.id, selectedAccountIds, currentStep, accounts])

  const loadDraft = async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/content/draft/${draftId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setDraft(data.draft)
      } else {
        const err = await res.json()
        toast.error(err.error || '加载草稿失败')
        router.push('/publish/works')
      }
    } catch (e) {
      console.error('加载草稿失败:', e)
      toast.error('网络错误')
      router.push('/publish/works')
    } finally {
      setLoading(false)
    }
  }

  const loadAccounts = async () => {
    if (!token) return
    setRefreshing(true)
    try {
      const [platformsRes, wechatRes] = await Promise.all([
        fetch('/api/platforms', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/platforms/wechat/config', { headers: { Authorization: `Bearer ${token}` } }),
      ])

      const list: PlatformAccount[] = []

      if (platformsRes.ok) {
        const data = await platformsRes.json()
        data.forEach((a: any) => {
          if (a.isConnected) list.push({
            id: a.id,
            platform: a.platform,
            platformUsername: a.platformUsername,
            isConnected: a.isConnected,
          })
        })
      }

      if (wechatRes.ok) {
        const wechatConfigs = await wechatRes.json()
        wechatConfigs.forEach((c: any) => {
          if (c.isActive && c.canPublish) {
            list.push({
              id: c.id,
              platform: 'WECHAT',
              platformUsername: c.accountName || c.appId,
              isConnected: c.isActive,
              canPublish: c.canPublish,
              accountName: c.accountName,
              appId: c.appId,
            })
          }
        })
      }

      setAccounts(list)
    } catch (e) {
      console.error('加载账号失败:', e)
      toast.error('加载账号失败')
    } finally {
      setRefreshing(false)
    }
  }

  const toggleAccount = (id: string) => {
    const acc = accounts.find(a => a.id === id)
    if (!acc?.isConnected) return

    setSelectedAccountIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const effectiveContentType = (draft?.contentType === 'image-text' ? 'image-text' : 'article') as 'article' | 'image-text'

  const filteredAccounts = accounts.filter(acc => {
    const supportedTypes = PLATFORM_CONTENT_SUPPORT[acc.platform]
    const supportsContent = supportedTypes?.includes(effectiveContentType) ?? false
    if (!supportsContent) return false
    const matchSearch = !searchQuery ||
      acc.platformUsername?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (PLATFORM_INFO[acc.platform]?.name || acc.platform).toLowerCase().includes(searchQuery.toLowerCase())
    const matchPlatform = platformFilter === 'all' || acc.platform === platformFilter
    return matchSearch && matchPlatform
  })

  const selectedAccounts = accounts.filter(a => selectedAccountIds.has(a.id) && (PLATFORM_CONTENT_SUPPORT[a.platform]?.includes(effectiveContentType) ?? false))

  const canGoNextStep1 = selectedAccountIds.size > 0
  const canGoNextStep2 = selectedAccounts.every(acc => {
    if (acc.platform !== 'WECHAT') return true
    const platformConfigs = configs.filter(c => c.platform === acc.platform)
    if (platformConfigs.length === 0) return false
    const configId = accountConfigMap[acc.id]
    return !!(configId && platformConfigs.some(c => c.id === configId))
  })

  const handleNext = () => {
    if (currentStep === 1 && !canGoNextStep1) {
      toast.error('请至少选择一个平台账号')
      return
    }
    if (currentStep === 2 && !canGoNextStep2) {
      toast.error('请为每个已选账号选择平台配置（如该平台无配置则可跳过）')
      return
    }
    if (currentStep < 4) setCurrentStep(s => s + 1)
    if (currentStep === 2) startPublish()
  }

  const startPublish = async () => {
    if (!draft || !token) return
    setPublishing(true)
    const results: Array<{ accountId: string; success: boolean; message?: string }> = []

    for (const acc of selectedAccounts) {
      // 统一发布接口：将配置项与平台发布方法结合
      const publishConfigId = accountConfigMap[acc.id]

      if (acc.platform === 'WECHAT') {
        if (!publishConfigId) {
          results.push({ accountId: acc.id, success: false, message: '未选择平台配置' })
          continue
        }
        const coverUrl = draft.coverImage || (draft.images?.[0])
        let imageFile: File | null = null
        if (coverUrl) {
          try {
            const imgRes = await fetch(coverUrl)
            const blob = await imgRes.blob()
            const mime = blob.type || 'image/jpeg'
            imageFile = new File([blob], 'cover.jpg', { type: mime })
          } catch {
            results.push({ accountId: acc.id, success: false, message: '封面图获取失败' })
            continue
          }
        }
        // 微信发布不强制需要封面，无封面时服务端使用默认图

        const formData = new FormData()
        formData.append('contentId', draft.id)
        formData.append('platform', 'WECHAT')
        formData.append('accountId', acc.id)
        formData.append('publishConfigId', publishConfigId)
        formData.append('title', draft.title)
        formData.append('content', draft.content)
        if (imageFile) formData.append('image', imageFile)

        const res = await fetch('/api/platforms/publish', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })
        const data = await res.json().catch(() => ({}))
        results.push({
          accountId: acc.id,
          success: res.ok && data.success,
          message: data.details || data.error || (res.ok ? '成功' : '发布失败'),
        })
      } else if (acc.platform === 'WEIBO') {
        const formData = new FormData()
        formData.append('contentId', draft.id)
        formData.append('platform', 'WEIBO')
        formData.append('accountId', acc.id)
        if (publishConfigId) formData.append('publishConfigId', publishConfigId)
        formData.append('title', draft.title)
        formData.append('content', draft.content)

        const res = await fetch('/api/platforms/publish', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.success && data.requiresJobPolling && data.jobId && token) {
          const polled = await pollPublishJob(token, data.jobId)
          results.push({
            accountId: acc.id,
            success: polled.ok,
            message: polled.ok
              ? (data.message || '微博已在后台尝试发博，请到微博查看是否成功')
              : (polled.errorMessage || data.details || data.error || '发布失败'),
          })
        } else {
          results.push({
            accountId: acc.id,
            success: res.ok && data.success,
            message: data.details || data.error || (res.ok ? '成功' : '发布失败'),
          })
        }
      } else {
        results.push({ accountId: acc.id, success: false, message: '暂不支持该平台发布' })
      }
    }

    setPublishResults(results)
    setPublishing(false)
    setCurrentStep(4)
  }

  const handleBack = () => router.push('/publish/works')

  const handlePrevStep = () => {
    if (currentStep > 1) setCurrentStep(s => s - 1)
  }

  if (loading || !draft) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="flex size-12 items-center justify-center rounded-full bg-foreground text-background">
          <Loader2 className="size-6 animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground">加载中...</p>
      </div>
    )
  }

  if (draft.status === 'PUBLISHED') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleBack} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4 mr-2" />
            返回草稿管理
          </Button>
        </div>
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="size-14 text-green-600 mb-4" />
              <p className="text-lg font-medium">该作品已发布</p>
              <p className="text-sm text-muted-foreground mt-1">已发布的作品不可再次发布</p>
              <Button
                variant="default"
                className="mt-6 bg-black hover:bg-gray-800"
                onClick={() => router.push('/publish/history')}
              >
                查看发布记录
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={handleBack}
        >
          <ArrowLeft className="size-4 mr-2" />
          返回草稿管理
        </Button>
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm text-muted-foreground font-medium">
            {effectiveContentType === 'image-text' ? '发布图文' : '发布文章'}
          </span>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            {draft.title || '未命名作品'}
          </h1>
        </div>
        <div className="w-24" />
      </div>

      {/* 步骤条 - 单框占满宽度，步骤间黑色连接线 */}
      <div className="pb-6 w-full">
        <Card className="w-full">
          <CardContent className="p-4 md:p-6">
            <nav aria-label="发布进度">
              <ol className="flex w-full">
                {STEPS.map((step, i) => {
                  const StepIcon = step.icon
                  const isActive = currentStep === step.id
                  const isDone = currentStep > step.id
                  const leftConnectorFilled = i > 0 && currentStep > STEPS[i - 1].id

                  return (
                    <li key={step.id} className="flex flex-1 basis-0 items-start min-w-0">
                      {/* 连接线（左侧）- 与圆圈中心对齐 */}
                      {i > 0 && (
                        <div
                          className={cn(
                            'flex-1 min-w-[24px] h-[2px] rounded-full shrink-0 mt-6',
                            leftConnectorFilled ? 'bg-black' : 'bg-black/30'
                          )}
                        />
                      )}
                      {/* 步骤：logo + 文字同一区域 */}
                      <div className="flex flex-col items-center px-2 shrink-0">
                        <div
                          className={cn(
                            'flex size-12 items-center justify-center rounded-full [&_svg]:size-6 [&_svg]:shrink-0',
                            isActive && 'bg-black text-white shadow-sm',
                            isDone && 'bg-black text-white',
                            !isActive && !isDone && 'bg-muted text-muted-foreground'
                          )}
                        >
                          {isDone ? (
                            <Check className="size-6" />
                          ) : (
                            <StepIcon className="size-6" />
                          )}
                        </div>
                        <div className="mt-3 text-center">
                          <span
                            className={cn(
                              'text-sm font-medium block',
                              (isActive || isDone) && 'text-black',
                              !isActive && !isDone && 'text-muted-foreground'
                            )}
                          >
                            {step.label}
                          </span>
                          <p className="mt-0.5 text-xs text-muted-foreground">{step.desc}</p>
                        </div>
                      </div>
                      {/* 连接线（右侧）- 与圆圈中心对齐 */}
                      {i < STEPS.length - 1 && (
                        <div
                          className={cn(
                            'flex-1 min-w-[24px] h-[2px] rounded-full shrink-0 mt-6',
                            isDone ? 'bg-black' : 'bg-black/30'
                          )}
                        />
                      )}
                    </li>
                  )
                })}
              </ol>
            </nav>
          </CardContent>
        </Card>
      </div>

      {/* 当前步骤内容 */}
      <Card>
        {currentStep === 1 && (
          <>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>选择发布账号</CardTitle>
                  <CardDescription className="mt-1.5">
                    不同类型草稿仅支持发布到支持该类型的平台上
                    {selectedAccountIds.size > 0 && (
                      <span className="text-foreground font-medium"> · 已选 {selectedAccountIds.size} 个</span>
                    )}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadAccounts()}
                  disabled={refreshing}
                  className="shrink-0"
                >
                  <RefreshCw className={`size-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  刷新
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索账号或平台..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger className="w-[140px] shrink-0">
                    <SelectValue placeholder="平台筛选" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部平台</SelectItem>
                    {Object.entries(PLATFORM_INFO).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 max-h-[280px] overflow-y-auto rounded-lg border border-border">
                {filteredAccounts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <p className="text-sm text-muted-foreground mb-4">
                      {accounts.length === 0
                        ? '暂无已绑定的平台账号'
                        : '没有符合条件的账号'}
                    </p>
                    {accounts.length === 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push('/accounts')}
                      >
                        前往账号管理
                      </Button>
                    )}
                  </div>
                ) : (
                  filteredAccounts.map((acc) => {
                    const info = PLATFORM_INFO[acc.platform] || { name: acc.platform }
                    const selected = selectedAccountIds.has(acc.id)
                    const disabled = !acc.isConnected

                    return (
                      <div
                        key={acc.id}
                        onClick={() => !disabled && toggleAccount(acc.id)}
                        className={cn(
                          'flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors border-b border-border last:border-b-0 first:rounded-t-lg last:rounded-b-lg',
                          selected && 'bg-accent',
                          !selected && !disabled && 'hover:bg-muted/50',
                          disabled && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <div className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded border transition-colors',
                          selected ? 'border-foreground bg-background' : 'border-input'
                        )}>
                          {selected && <Check className="size-3.5 text-foreground stroke-[2.5]" />}
                        </div>
                        <AccountPlatformLogo platformKey={acc.platform} />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate text-foreground">{info.name}</div>
                          <div className="text-sm text-muted-foreground truncate">{acc.platformUsername}</div>
                        </div>
                        {acc.canPublish === false && (
                          <Badge variant="secondary" className="text-xs shrink-0">仅查看</Badge>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </>
        )}

        {currentStep === 2 && (
          <CardContent className="pt-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle>选择平台配置</CardTitle>
              <CardDescription className="mt-1.5">按平台为每个账号选择发布配置（作者、原文链接等）</CardDescription>
            </CardHeader>
            <div className="space-y-6 mt-4">
              {(() => {
                // 按平台分组
                const accountsByPlatform = selectedAccounts.reduce(
                  (acc, account) => {
                    const p = account.platform
                    if (!acc[p]) acc[p] = []
                    acc[p].push(account)
                    return acc
                  },
                  {} as Record<string, typeof selectedAccounts>
                )

                return Object.entries(accountsByPlatform).map(([platform, platformAccounts]) => {
                  const platformConfigs = configs.filter(c => c.platform === platform)
                  const info = PLATFORM_INFO[platform] || { name: platform }

                  return (
                    <div key={platform} className="rounded-lg border border-border overflow-visible">
                      {/* 平台标题 */}
                      <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border">
                        <AccountPlatformLogo platformKey={platform} />
                        <span className="font-semibold text-foreground">{info.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {platformConfigs.length > 0
                            ? `（${platformConfigs.length} 个可选配置）`
                            : `（${platformAccounts.length} 个已选账号）`
                          }
                        </span>
                      </div>
                      {/* 该平台下的账号及配置选择 */}
                      <div className="divide-y divide-border">
                        {platformConfigs.length === 0 ? (
                          <div className="px-4 py-4">
                            <p className="text-sm text-muted-foreground mb-3">该平台暂无发布配置，请先在平台配置中创建</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push('/platforms')}
                            >
                              前往平台配置
                            </Button>
                          </div>
                        ) : (
                          platformAccounts.map((acc) => (
                            <div key={acc.id} className="flex items-center justify-between gap-4 px-4 py-3">
                              <div className="min-w-0">
                                <span className="text-sm text-foreground">
                                  <span className="text-muted-foreground">账号：</span>
                                  <span className="font-medium">{acc.platformUsername}</span>
                                </span>
                              </div>
                              <Select
                                value={accountConfigMap[acc.id] || ''}
                                onValueChange={(v) => setAccountConfigMap(prev => ({ ...prev, [acc.id]: v }))}
                              >
                                <SelectTrigger className="w-[220px] shrink-0">
                                  <SelectValue placeholder="选择配置..." />
                                </SelectTrigger>
                                <SelectContent
                                  className="z-[9999]"
                                  side="top"
                                  position="popper"
                                  sideOffset={4}
                                >
                                  {platformConfigs.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.configName}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </CardContent>
        )}

        {currentStep === 3 && publishing && (
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              <div className="flex size-16 items-center justify-center rounded-full bg-foreground text-background">
                <Loader2 className="size-8 animate-spin" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-foreground font-medium">正在执行发布任务...</p>
                <p className="text-sm text-muted-foreground">正在将内容发布到各平台，请稍候</p>
              </div>
              <Skeleton className="h-1.5 w-full max-w-md rounded-full" />
              <div className="w-full space-y-3 max-w-md">
                {selectedAccounts.map((acc) => {
                  const info = PLATFORM_INFO[acc.platform] || { name: acc.platform }
                  const configId = accountConfigMap[acc.id]
                  const configName = configId
                    ? configs.find((c) => c.id === configId)?.configName || ''
                    : '-'
                  return (
                    <div
                      key={acc.id}
                      className="flex items-center gap-4 p-4 rounded-lg border border-border bg-muted/20"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                        <Loader2 className="size-5 animate-spin" />
                      </div>
                      <AccountPlatformLogo platformKey={acc.platform} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground truncate">
                          {acc.platformUsername || acc.accountName || acc.appId || '未知账号'}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {info.name} · {configName}
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground shrink-0">发布中...</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        )}

        {currentStep === 4 && (
          <CardContent className="pt-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle>发布完成</CardTitle>
              <CardDescription className="mt-1.5">
                请在发布记录中查看详细发布状态和文章链接
              </CardDescription>
            </CardHeader>
            <div className="space-y-3 mt-4">
              {selectedAccounts.map((acc) => {
                const result = publishResults.find(r => r.accountId === acc.id)
                const info = PLATFORM_INFO[acc.platform] || { name: acc.platform }
                const success = result?.success ?? false

                return (
                  <div
                    key={acc.id}
                    className={cn(
                      'flex items-center gap-4 p-4 rounded-lg border',
                      success ? 'border-border bg-muted/20' : 'border-destructive/50 bg-destructive/5'
                    )}
                  >
                    <div
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full border',
                        success
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-destructive/40 bg-destructive/10 text-destructive'
                      )}
                      aria-hidden
                    >
                      {success ? (
                        <Check className="size-3.5 stroke-[2.5]" />
                      ) : (
                        <span className="text-[11px] font-bold leading-none">!</span>
                      )}
                    </div>
                    <AccountPlatformLogo platformKey={acc.platform} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground">{acc.platformUsername}</div>
                      <div className="text-sm text-muted-foreground">{info.name}</div>
                    </div>
                    <span
                      className={cn(
                        'text-sm shrink-0',
                        success ? 'text-muted-foreground' : 'text-destructive'
                      )}
                    >
                      {success ? '已发布成功' : result?.message || '发布失败'}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {/* 底部按钮 - 保持较低层级，确保下拉框在上方显示 */}
      <div className="relative z-0 flex justify-between">
        {currentStep === 4 ? (
          <Button
            variant="default"
            onClick={() => router.push('/publish/history')}
            className="bg-black text-white hover:bg-gray-800"
          >
            <HistoryIcon className="size-4 mr-2" />
            前往发布记录
          </Button>
        ) : currentStep > 1 && !publishing ? (
          <Button variant="outline" onClick={handlePrevStep} className="flex items-center gap-2">
            <ArrowLeft className="size-4" />
            返回上一步
          </Button>
        ) : (
          <Button variant="outline" onClick={handleBack}>取消</Button>
        )}
        {currentStep < 4 && (
          <Button
            variant="default"
            onClick={handleNext}
            disabled={
              (currentStep === 1 && !canGoNextStep1) ||
              (currentStep === 2 && (!canGoNextStep2 || publishing))
            }
            className={
              (currentStep === 1 && canGoNextStep1) || (currentStep === 2 && canGoNextStep2 && !publishing)
                ? 'bg-black text-white hover:bg-gray-800' : ''
            }
          >
            {currentStep === 2 ? (
              publishing ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  发布中...
                </>
              ) : (
                <>
                  <Send className="size-4 mr-2" />
                  开始发布
                </>
              )
            ) : (
              '下一步'
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
