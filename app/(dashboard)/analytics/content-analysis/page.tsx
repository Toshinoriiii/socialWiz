'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  RefreshCw,
  Loader2,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  AlertCircle,
  Info
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { useUserStore } from '@/store/user.store'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type SortKey =
  | 'views'
  | 'likes'
  | 'comments'
  | 'collections'
  | 'shares'
  | 'publishedAt'

interface Row {
  id: string
  contentId: string
  title: string
  accountName: string
  platform: string
  contentType: string
  views: number
  likes: number
  comments: number
  collections: number
  shares: number
  publishedAt: string
  metricsOk: boolean
  metricsWarn?: string
}

function formatInt (n: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.max(0, Math.floor(n)))
}

function formatDate (iso: string): string {
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d)
  } catch {
    return '—'
  }
}

function platformBadgeClass (platform: string): string {
  if (platform.includes('微信'))
    return 'border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-100'
  if (platform.includes('微博'))
    return 'border-red-200/80 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-100'
  if (platform.includes('知乎'))
    return 'border-sky-200/80 bg-sky-50 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/50 dark:text-sky-100'
  return 'border-border bg-muted/60 text-foreground'
}

function SortButton ({
  label,
  active,
  direction,
  onClick
}: {
  label: string
  active: boolean
  direction: 'asc' | 'desc'
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        '-ml-2 h-8 gap-1 px-2 text-xs font-medium',
        active ? 'text-primary' : 'text-muted-foreground'
      )}
      onClick={onClick}
    >
      {label}
      {active ? (
        direction === 'desc' ? (
          <ArrowDown className="size-3.5 shrink-0 opacity-90" />
        ) : (
          <ArrowUp className="size-3.5 shrink-0 opacity-90" />
        )
      ) : (
        <ArrowUpDown className="size-3.5 shrink-0 opacity-45" />
      )}
    </Button>
  )
}

function TableSkeleton () {
  return (
    <div className="space-y-3 p-6">
      <Skeleton className="h-9 w-full max-w-md" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-3/4" />
    </div>
  )
}

export default function ContentAnalysisPage () {
  const { token } = useUserStore()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('views')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)

  const load = useCallback(
    async (isRefresh = false) => {
      if (!token) return
      try {
        if (isRefresh) setRefreshing(true)
        else setLoading(true)
        const res = await fetch('/api/analytics/content-analysis', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(data.error || '加载失败')
          return
        }
        setRows(Array.isArray(data.rows) ? data.rows : [])
        setRefreshedAt(
          typeof data.refreshedAt === 'string' ? data.refreshedAt : null
        )
      } catch (e) {
        console.error(e)
        toast.error('网络错误')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [token]
  )

  useEffect(() => {
    void load(false)
  }, [load])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'publishedAt' ? 'desc' : 'desc')
    }
  }

  const sorted = useMemo(() => {
    const copy = [...rows]
    const mul = sortDir === 'desc' ? -1 : 1
    copy.sort((a, b) => {
      let va: number | string = 0
      let vb: number | string = 0
      if (sortKey === 'publishedAt') {
        va = new Date(a.publishedAt).getTime()
        vb = new Date(b.publishedAt).getTime()
      } else {
        va = a[sortKey] as number
        vb = b[sortKey] as number
      }
      if (va < vb) return -1 * mul
      if (va > vb) return 1 * mul
      return 0
    })
    return copy
  }, [rows, sortKey, sortDir])

  const warnCount = rows.filter((r) => !r.metricsOk && r.metricsWarn).length

  return (
    <TooltipProvider delayDuration={300}>
      <div className="mx-auto max-w-[1600px] space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              内容分析
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
              本页<strong className="text-foreground">仅</strong>针对
              <strong className="font-medium text-foreground">文章</strong>类型作品，汇总
              <strong className="font-medium text-foreground">微信（公众号）、微博、知乎</strong>等平台的阅读、点赞、评论、收藏与转发（与数据概览同源；微信为绑定公众平台会话后从发表记录拉数）。图文、纯图等非文章类不在本功能统计范围内（是否出现在列表、数值是否准均不保证）。
            </p>
            <Alert className="mt-3 max-w-2xl border-sky-200/80 bg-sky-50/90 dark:border-sky-900/45 dark:bg-sky-950/35">
              <Info className="size-4 text-sky-700 dark:text-sky-400" />
              <AlertDescription className="text-sm text-sky-950 dark:text-sky-100/90">
                说明：微信、微博、知乎在本页
                <span className="font-medium">均按「文章类」</span>拉取/展示指标；
                非文章类请忽略本页或改用文章类作品。若某条未出数，多为未绑定平台会话/凭证或该条无公开统计。
              </AlertDescription>
            </Alert>
            {refreshedAt && (
              <p className="text-xs text-muted-foreground">
                上次刷新：{formatDate(refreshedAt)}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!token || refreshing}
            onClick={() => void load(true)}
            className="shrink-0"
          >
            {refreshing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            刷新数据
          </Button>
        </div>

        {warnCount > 0 && (
          <Alert className="border-amber-200/80 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/30">
            <AlertCircle className="size-4 text-amber-700 dark:text-amber-400" />
            <AlertDescription className="text-amber-900 dark:text-amber-100/90">
              有 {warnCount}{' '}
              条记录未能完整拉取互动数据，可将鼠标悬停在标题旁的警告图标上查看原因。
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">发布内容明细</CardTitle>
            <CardDescription>
              文章类、已成功发布至微信、微博、知乎等平台的记录（非文章类不保证出现在本表或指标准确）
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <TableSkeleton />
            ) : sorted.length === 0 ? (
              <div className="mx-6 mb-6 mt-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-16 text-center text-sm text-muted-foreground">
                暂无内容数据
              </div>
            ) : (
              <div className="relative w-full overflow-x-auto">
                <Table className="min-w-[1080px]">
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="min-w-[200px] pl-6 font-medium">
                        内容标题
                      </TableHead>
                      <TableHead className="whitespace-nowrap font-medium">
                        发布账号
                      </TableHead>
                      <TableHead className="whitespace-nowrap font-medium">
                        发布平台
                      </TableHead>
                      <TableHead className="whitespace-nowrap font-medium">
                        发布类型
                      </TableHead>
                      <TableHead className="whitespace-nowrap font-medium">
                        <SortButton
                          label="播放/阅读数"
                          active={sortKey === 'views'}
                          direction={sortDir}
                          onClick={() => toggleSort('views')}
                        />
                      </TableHead>
                      <TableHead className="whitespace-nowrap font-medium">
                        <SortButton
                          label="点赞数"
                          active={sortKey === 'likes'}
                          direction={sortDir}
                          onClick={() => toggleSort('likes')}
                        />
                      </TableHead>
                      <TableHead className="whitespace-nowrap font-medium">
                        <SortButton
                          label="评论数"
                          active={sortKey === 'comments'}
                          direction={sortDir}
                          onClick={() => toggleSort('comments')}
                        />
                      </TableHead>
                      <TableHead className="whitespace-nowrap font-medium">
                        <SortButton
                          label="收藏数"
                          active={sortKey === 'collections'}
                          direction={sortDir}
                          onClick={() => toggleSort('collections')}
                        />
                      </TableHead>
                      <TableHead className="whitespace-nowrap font-medium">
                        <SortButton
                          label="分享/转发数"
                          active={sortKey === 'shares'}
                          direction={sortDir}
                          onClick={() => toggleSort('shares')}
                        />
                      </TableHead>
                      <TableHead className="whitespace-nowrap pr-6 font-medium">
                        <SortButton
                          label="发布日期"
                          active={sortKey === 'publishedAt'}
                          direction={sortDir}
                          onClick={() => toggleSort('publishedAt')}
                        />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="max-w-[280px] pl-6 align-middle">
                          <div className="flex items-start gap-1.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="line-clamp-2 cursor-default text-left font-medium text-foreground">
                                  {r.title}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-sm rounded-md px-3 py-2 text-left normal-case"
                              >
                                {r.title}
                              </TooltipContent>
                            </Tooltip>
                            {!r.metricsOk && r.metricsWarn && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                                    aria-label="数据拉取异常"
                                  >
                                    <AlertCircle className="size-4" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="top"
                                  className="max-w-xs rounded-md px-3 py-2 text-left"
                                >
                                  {r.metricsWarn}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {r.accountName}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              'font-normal shadow-none',
                              platformBadgeClass(r.platform)
                            )}
                          >
                            {r.platform}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {r.contentType}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums text-foreground">
                          {formatInt(r.views)}
                        </TableCell>
                        <TableCell className="tabular-nums text-foreground">
                          {formatInt(r.likes)}
                        </TableCell>
                        <TableCell className="tabular-nums text-foreground">
                          {formatInt(r.comments)}
                        </TableCell>
                        <TableCell className="tabular-nums text-foreground">
                          {formatInt(r.collections)}
                        </TableCell>
                        <TableCell className="tabular-nums text-foreground">
                          {formatInt(r.shares)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap pr-6 text-xs text-muted-foreground tabular-nums">
                          {formatDate(r.publishedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
