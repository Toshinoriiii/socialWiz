'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useUserStore } from '@/store/user.store'
import { toast } from 'sonner'
import { History, ArrowLeft, ExternalLink, MessageCircle, Calendar, FileText, Loader2, Info, Trash2, CheckCircle2 } from 'lucide-react'

interface PublishRecordPlatform {
  id: string
  platform: string
  platformName: string
  accountName: string
  publishedUrl?: string | null
  platformContentId?: string | null
  publishStatus: string
  createdAt: string
}

/** 一篇作品（草稿）一条记录，内含多个已成功发布的平台 */
interface PublishRecord {
  id: string
  contentId: string
  title: string
  contentPreview: string
  coverImage?: string | null
  publishedAt?: string | null
  latestPublishAt: string
  platforms: PublishRecordPlatform[]
}

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  WECHAT: MessageCircle,
  WEIBO: MessageCircle,
}

interface PublishStatusPlatformRow {
  recordId: string
  platform: string
  platformName: string
  accountName: string
  statusText: string
  publishedUrl?: string | null
  publishId?: string | null
  wechatPublishStatus?: number
}

interface PublishStatusPayload {
  title: string
  contentId: string
  platforms: PublishStatusPlatformRow[]
}

function platformBadgeClass (platform: string): string {
  if (platform === 'WECHAT') return 'bg-green-100 text-green-700 border-green-200'
  if (platform === 'WEIBO') return 'bg-orange-100 text-orange-700 border-orange-200'
  return 'bg-neutral-100 text-neutral-700 border-neutral-200'
}

export default function PublishHistoryPage() {
  const router = useRouter()
  const { token } = useUserStore()
  const [records, setRecords] = useState<PublishRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [statusDialog, setStatusDialog] = useState<{
    open: boolean
    record: PublishRecord | null
    status: PublishStatusPayload | null
    loading: boolean
  }>({ open: false, record: null, status: null, loading: false })
  const [deleteRecord, setDeleteRecord] = useState<PublishRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (token) loadRecords()
  }, [token])

  const loadRecords = async () => {
    if (!token) return
    try {
      setLoading(true)
      const res = await fetch('/api/content/publish-records', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setRecords(data.records || [])
      } else {
        const err = await res.json()
        toast.error(err.error || '加载失败')
      }
    } catch (e) {
      console.error('加载发布记录失败:', e)
      toast.error('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const fetchStatus = async (record: PublishRecord) => {
    if (!token) return
    setStatusDialog({ open: true, record, status: null, loading: true })
    try {
      const res = await fetch(`/api/content/publish-records/${record.id}/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setStatusDialog(prev => ({ ...prev, status: data, loading: false }))
      } else {
        toast.error(data.error || '查询失败')
        setStatusDialog(prev => ({ ...prev, loading: false }))
      }
    } catch (e) {
      toast.error('网络错误')
      setStatusDialog(prev => ({ ...prev, loading: false }))
    }
  }

  const handleDeleteRecord = async () => {
    if (!deleteRecord || !token) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/content/publish-records/${deleteRecord.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        toast.success('已删除')
        setDeleteRecord(null)
        loadRecords()
      } else {
        toast.error(data.error || '删除失败')
      }
    } catch {
      toast.error('网络错误')
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    try {
      const d = new Date(dateStr)
      return d.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-black mb-2">发布记录</h1>
          <p className="text-gray-600">查看您在各平台的发布历史</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/publish/works')}>
          <ArrowLeft className="size-4 mr-2" />
          返回草稿管理
        </Button>
      </div>

      <Card className="border border-gray-300 bg-white">
        <CardHeader>
          <CardTitle className="text-black">全部发布记录</CardTitle>
          <CardDescription className="text-gray-600">
            每条对应一篇作品；同一作品发布到多个平台时，链接汇总在同一条记录下
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-600">加载中...</span>
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12">
              <History className="size-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">暂无发布记录</p>
              <p className="text-sm text-gray-500 mb-4">发布作品后，记录将在此显示</p>
              <Button variant="outline" onClick={() => router.push('/publish/works')}>
                前往草稿管理
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 bg-white hover:bg-gray-50/50 transition-colors"
                >
                  {record.coverImage ? (
                    <img
                      src={record.coverImage}
                      alt=""
                      className="w-20 h-20 object-cover rounded-lg shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <FileText className="size-8 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-medium text-black truncate max-w-full">
                        {record.title}
                      </h3>
                      {record.platforms.map((p) => {
                        const PlatformIcon =
                          PLATFORM_ICONS[p.platform] || FileText
                        return (
                          <Badge
                            key={p.id}
                            variant="secondary"
                            className={
                              p.platform === 'WECHAT'
                                ? 'bg-green-100 text-green-700'
                                : p.platform === 'WEIBO'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-neutral-100 text-neutral-700'
                            }
                          >
                            <PlatformIcon className="size-3 mr-1" />
                            {p.platformName}
                          </Badge>
                        )
                      })}
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {record.platforms.map((p) => (
                        <div
                          key={p.id}
                          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600"
                        >
                          <span className="text-gray-500 shrink-0">
                            {p.platformName}（{p.accountName}）
                          </span>
                          {p.publishedUrl ? (
                            <a
                              href={p.publishedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <ExternalLink className="size-3.5 shrink-0" />
                              打开链接
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">暂无链接</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {formatDate(record.latestPublishAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-300"
                      onClick={() => fetchStatus(record)}
                    >
                      <Info className="size-4 mr-1" />
                      发布状态
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-300 text-gray-500 hover:text-red-600 hover:border-red-300"
                      onClick={() => setDeleteRecord(record)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={statusDialog.open} onOpenChange={(open) => setStatusDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden bg-white dark:bg-gray-950 sm:max-w-lg border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
          <DialogHeader className="shrink-0 space-y-1 pb-3 pr-8">
            <DialogTitle className="text-foreground text-lg leading-snug">
              {statusDialog.status?.title ||
                statusDialog.record?.title ||
                '发布状态'}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              按发布平台列出对应账号与文章链接（同一作品可发布到多个平台）
            </p>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden py-1">
            {statusDialog.loading ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 text-muted-foreground py-2">
                  <Loader2 className="size-5 animate-spin text-primary" />
                  <span className="text-sm">正在查询各平台状态…</span>
                </div>
                {(() => {
                  const firstUrl = statusDialog.record?.platforms?.find(
                    (p) => p.publishedUrl
                  )?.publishedUrl
                  return firstUrl ? (
                    <p className="text-xs text-muted-foreground">
                      查询完成后将列出各平台链接；也可先打开已有链接：{' '}
                      <a
                        href={firstUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        打开
                      </a>
                    </p>
                  ) : null
                })()}
              </div>
            ) : statusDialog.status &&
              statusDialog.status.platforms.length > 0 ? (
              <div className="flex max-h-[min(60vh,28rem)] gap-4 overflow-hidden">
                <div className="min-w-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  {statusDialog.status.platforms.map((row) => {
                    const Icon = PLATFORM_ICONS[row.platform] || FileText
                    const ok = row.statusText === '发布成功'
                    return (
                      <div
                        key={row.recordId}
                        className="rounded-lg border border-border bg-muted/20 px-3 py-3 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge
                            variant="outline"
                            className={`border font-normal gap-1 ${platformBadgeClass(row.platform)}`}
                          >
                            <Icon className="size-3" />
                            {row.platformName}
                          </Badge>
                          {ok ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                              <CheckCircle2 className="size-3.5 shrink-0" />
                              发布成功
                            </span>
                          ) : (
                            <span className="text-xs text-amber-700 dark:text-amber-400">
                              {row.statusText}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            账号
                          </p>
                          <p className="text-sm font-medium text-foreground break-all">
                            {row.accountName}
                          </p>
                        </div>
                        {row.publishedUrl ? (
                          <a
                            href={row.publishedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-primary transition-colors hover:bg-muted/60"
                          >
                            <ExternalLink className="size-4 shrink-0" />
                            查看该平台文章
                          </a>
                        ) : (
                          <p className="text-xs text-muted-foreground">暂无线上链接</p>
                        )}
                      </div>
                    )
                  })}
                </div>
                {statusDialog.record?.coverImage ? (
                  <div className="hidden shrink-0 sm:block">
                    <img
                      src={statusDialog.record.coverImage}
                      alt=""
                      className="size-24 object-cover rounded-lg border border-border shadow-sm"
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                暂无可展示的平台发布明细
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteRecord} onOpenChange={(open) => !open && setDeleteRecord(null)}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">删除发布记录</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            确定要删除这条发布记录吗？将移除本应用中该作品下所有平台的发布关联，不会删除各平台上已发布的文章。
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteRecord(null)} disabled={deleting}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRecord}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4 mr-1" />}
              {deleting ? '删除中...' : '删除'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
