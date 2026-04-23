'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Eye,
  MessageCircle,
  Heart,
  Share2,
  RefreshCw,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useUserStore } from '@/store/user.store'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

interface Totals {
  views: number
  comments: number
  likes: number
  shares: number
}

interface SeriesRow {
  label: string
  dayIso: string
  views: number
  comments: number
  likes: number
  shares: number
}

const METRICS = [
  {
    key: 'views' as const,
    label: '总浏览量',
    icon: Eye,
    iconClass: 'text-[#0084ff] bg-[#e8f4ff]'
  },
  {
    key: 'comments' as const,
    label: '总评论',
    icon: MessageCircle,
    iconClass: 'text-green-600 bg-green-100'
  },
  {
    key: 'likes' as const,
    label: '总点赞',
    icon: Heart,
    iconClass: 'text-red-600 bg-red-100'
  },
  {
    key: 'shares' as const,
    label: '总转发',
    icon: Share2,
    iconClass: 'text-amber-600 bg-amber-100'
  }
]

const CHART_COLORS = {
  views: '#0084ff',
  shares: '#d97706',
  comments: '#16a34a',
  likes: '#dc2626'
} as const

const CARD_ACTIVE: Record<(typeof METRICS)[number]['key'], string> = {
  views: 'border-[#0084ff] ring-2 ring-[#0084ff]/20 shadow-sm',
  comments: 'border-green-500 ring-2 ring-green-500/20 shadow-sm',
  likes: 'border-red-500 ring-2 ring-red-500/20 shadow-sm',
  shares: 'border-amber-500 ring-2 ring-amber-500/20 shadow-sm'
}

function formatInt (n: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.max(0, Math.floor(n)))
}

export default function DataOverviewPage () {
  const { token } = useUserStore()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [totals, setTotals] = useState<Totals | null>(null)
  const [series, setSeries] = useState<SeriesRow[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [postsMeta, setPostsMeta] = useState<{
    considered: number
    succeeded: number
  } | null>(null)
  const [activeMetric, setActiveMetric] = useState<(typeof METRICS)[number]['key']>('views')

  const load = useCallback(
    async (isRefresh = false) => {
      if (!token) return
      try {
        if (isRefresh) setRefreshing(true)
        else setLoading(true)
        const res = await fetch('/api/analytics/overview?days=7', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(data.error || '加载失败')
          return
        }
        const t = data.totals as Record<string, number> | undefined
        setTotals(
          t
            ? {
                views: t.views ?? 0,
                comments: t.comments ?? 0,
                likes: t.likes ?? 0,
                shares: t.shares ?? 0
              }
            : null
        )
        const rawSeries = Array.isArray(data.series) ? data.series : []
        setSeries(
          rawSeries.map((s: Record<string, unknown>) => ({
            label: String(s.label ?? ''),
            dayIso: String(s.dayIso ?? ''),
            views: Number(s.views ?? 0),
            comments: Number(s.comments ?? 0),
            likes: Number(s.likes ?? 0),
            shares: Number(s.shares ?? 0)
          }))
        )
        setWarnings(Array.isArray(data.warnings) ? data.warnings : [])
        setPostsMeta({
          considered: data.postsConsidered ?? 0,
          succeeded: data.postsSucceeded ?? 0
        })
      } catch {
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

  const chartOption =
    series.length > 0
      ? {
          tooltip: { trigger: 'axis' as const },
          legend: {
            bottom: 0,
            data: ['总浏览量', '总转发', '总评论', '总点赞']
          },
          grid: {
            left: '3%',
            right: '4%',
            bottom: '12%',
            top: '8%',
            containLabel: true
          },
          xAxis: {
            type: 'category' as const,
            boundaryGap: false,
            data: series.map((s) => s.label),
            axisLine: { lineStyle: { color: '#d1d5db' } }
          },
          yAxis: {
            type: 'value' as const,
            minInterval: 1,
            splitLine: { lineStyle: { type: 'dashed' as const, color: '#e5e7eb' } }
          },
          series: [
            {
              name: '总浏览量',
              type: 'line' as const,
              smooth: true,
              symbolSize: 6,
              lineStyle: { width: 2, color: CHART_COLORS.views },
              itemStyle: { color: CHART_COLORS.views },
              data: series.map((s) => s.views)
            },
            {
              name: '总转发',
              type: 'line' as const,
              smooth: true,
              symbolSize: 6,
              lineStyle: { width: 2, color: CHART_COLORS.shares },
              itemStyle: { color: CHART_COLORS.shares },
              data: series.map((s) => s.shares)
            },
            {
              name: '总评论',
              type: 'line' as const,
              smooth: true,
              symbolSize: 6,
              lineStyle: { width: 2, color: CHART_COLORS.comments },
              itemStyle: { color: CHART_COLORS.comments },
              data: series.map((s) => s.comments)
            },
            {
              name: '总点赞',
              type: 'line' as const,
              smooth: true,
              symbolSize: 6,
              lineStyle: { width: 2, color: CHART_COLORS.likes },
              itemStyle: { color: CHART_COLORS.likes },
              data: series.map((s) => s.likes)
            }
          ]
        }
      : null

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-black">互动数据</h1>
          <p className="text-gray-600 mt-1">
            汇总已成功发布内容在微信、微博、知乎的互动表现
          </p>
          {postsMeta && (
            <p className="text-xs text-gray-500 mt-2">
              本次统计帖子：已拉取 {postsMeta.succeeded} / {postsMeta.considered} 条有效数据
            </p>
          )}
        </div>
        <Button
          variant="outline"
          className="border-gray-300 shrink-0"
          disabled={loading || refreshing || !token}
          onClick={() => void load(true)}
        >
          {refreshing ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="size-4 mr-2" />
          )}
          刷新
        </Button>
      </div>

      {warnings.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="size-4 text-amber-700" />
          <AlertDescription className="text-amber-900 text-sm space-y-1">
            {warnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-600">
          <Loader2 className="size-6 animate-spin mr-2" />
          加载中…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {METRICS.map((m) => {
              const Icon = m.icon
              const v = totals?.[m.key] ?? 0
              const active = activeMetric === m.key
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setActiveMetric(m.key)}
                  className={cn(
                    'text-left rounded-xl border bg-white p-4 transition-all hover:border-gray-400',
                    active ? CARD_ACTIVE[m.key] : 'border-gray-200'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-600 leading-snug">
                      {m.label}
                    </p>
                    <span
                      className={cn(
                        'shrink-0 rounded-lg p-1.5',
                        m.iconClass
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-black mt-3 tabular-nums">
                    {formatInt(v)}
                  </p>
                </button>
              )
            })}
          </div>

          <Card className="border border-gray-300 bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-black">数据图表</CardTitle>
              <CardDescription className="text-gray-600">
                最近 7 天每日快照（自首次刷新概览起累积；未刷新的日期为 0）
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartOption ? (
                <div className="h-[340px] w-full">
                  <ReactECharts
                    option={chartOption}
                    style={{ height: '100%', width: '100%' }}
                    opts={{ renderer: 'svg' }}
                  />
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-gray-500 text-sm border border-dashed border-gray-200 rounded-lg">
                  暂无趋势数据，点击刷新后将写入当日快照
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
