'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/badge'
import { useUserStore } from '@/store/user.store'
import { toast } from 'sonner'
import { History, ArrowLeft, ExternalLink, MessageCircle, Calendar, FileText, Loader2 } from 'lucide-react'

interface PublishRecord {
  id: string
  contentId: string
  platform: string
  platformName: string
  accountName: string
  title: string
  contentPreview: string
  coverImage?: string | null
  publishedUrl?: string | null
  platformContentId?: string | null
  publishStatus: string
  createdAt: string
  publishedAt?: string | null
}

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  WECHAT: MessageCircle,
  WEIBO: MessageCircle,
}

export default function PublishHistoryPage() {
  const router = useRouter()
  const { token } = useUserStore()
  const [records, setRecords] = useState<PublishRecord[]>([])
  const [loading, setLoading] = useState(true)

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
          返回作品管理
        </Button>
      </div>

      <Card className="border border-gray-300 bg-white">
        <CardHeader>
          <CardTitle className="text-black">全部发布记录</CardTitle>
          <CardDescription className="text-gray-600">
            按发布时间倒序，展示平台、内容、时间等信息
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
                前往作品管理
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {records.map((record) => {
                const PlatformIcon = PLATFORM_ICONS[record.platform] || FileText
                return (
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
                        <h3 className="font-medium text-black truncate">{record.title}</h3>
                        <Badge
                          variant="secondary"
                          className={record.platform === 'WECHAT' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}
                        >
                          <PlatformIcon className="size-3 mr-1" />
                          {record.platformName}
                        </Badge>
                        <span className="text-sm text-gray-500">· {record.accountName}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {formatDate(record.createdAt)}
                        </span>
                        {record.publishedUrl && (
                          <a
                            href={record.publishedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            <ExternalLink className="size-3" />
                            查看文章
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
