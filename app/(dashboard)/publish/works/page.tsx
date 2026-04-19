'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useUserStore } from '@/store/user.store'
import { cn } from '@/lib/utils'
import { effectivePublishContentTypeFromRecord } from '@/lib/utils/content-publish-type'
import { toast } from 'sonner'
import { FileText, Edit, Send, Calendar, Loader2, Image as ImageIcon, History, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Draft {
  id: string
  title: string
  status: string
  images?: string[]
  coverImage?: string | null
  contentType?: string | null // 'image-text' | 'article'
  publishedAt?: string | null
  createdAt: string
  updatedAt: string
}

/** 列表缩略图：封面优先，图文无封面时用首图 */
function normalizeDraftThumbUrl (raw: string): string {
  const t = raw.trim()
  if (!t) return t
  if (t.startsWith('/')) return t
  try {
    const u = new URL(t)
    if (u.pathname.startsWith('/content-images/')) {
      return `${u.pathname}${u.search}${u.hash}`
    }
  } catch {
    /* 非绝对 URL */
  }
  return t
}

const DRAFT_LIST_PLACEHOLDER_IMG = '/placeholders/no-cover.svg'

function draftThumbSrc (draft: Draft): string | null {
  const cover = draft.coverImage?.trim()
  const first = draft.images
    ?.map((s) => (typeof s === 'string' ? s.trim() : ''))
    .find((s) => s.length > 0)
  const raw = cover || first || null
  return raw ? normalizeDraftThumbUrl(raw) : null
}

export default function WorksManagementPage() {
  const router = useRouter()
  const { token } = useUserStore()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDraft, setDeleteDraft] = useState<Draft | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadDrafts()
  }, [token])

  const loadDrafts = async () => {
    if (!token) return

    try {
      setLoading(true)
      const response = await fetch('/api/content/draft', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setDrafts(data.drafts || [])
      } else {
        const error = await response.json()
        toast.error(error.error || '加载失败')
      }
    } catch (error) {
      console.error('加载草稿列表失败:', error)
      toast.error('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (draft: Draft) => {
    if (draft.status === 'PUBLISHED') {
      toast.error('已发布的作品不可编辑')
      return
    }
    // 根据保存的 contentType 判断编辑器类型（根据原始 workflow 类型）
    // 如果 contentType 是 'image-text'，使用图文编辑器
    // 如果 contentType 是 'article'，使用文章编辑器
    // 如果没有 contentType，根据数据推断（向后兼容）
    if (draft.contentType === 'image-text') {
      router.push(`/publish/create-image?id=${draft.id}`)
    } else if (draft.contentType === 'article') {
      router.push(`/publish/create-article?id=${draft.id}`)
    } else {
      // 向后兼容：如果没有 contentType，根据数据推断
      const hasImages = draft.images && draft.images.length > 0
      const hasCoverImage = draft.coverImage && draft.coverImage.trim().length > 0
      
      if (hasImages && !hasCoverImage) {
        router.push(`/publish/create-image?id=${draft.id}`)
      } else {
        router.push(`/publish/create-article?id=${draft.id}`)
      }
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return (
          <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-300">
            草稿
          </Badge>
        )
      case 'SCHEDULED':
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-300">
            已预约
          </Badge>
        )
      case 'PUBLISHED':
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300">
            已发布
          </Badge>
        )
      case 'FAILED':
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-700 border-red-300">
            发布失败
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-300">
            {status}
          </Badge>
        )
    }
  }

  const handleDeleteDraft = async () => {
    if (!deleteDraft || !token) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/content/draft/${deleteDraft.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        toast.success('已删除')
        setDeleteDraft(null)
        loadDrafts()
      } else {
        toast.error(data.error || '删除失败')
      }
    } catch {
      toast.error('网络错误')
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${minutes}`
    } catch {
      return dateString
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-black mb-2">草稿管理</h1>
        <p className="text-gray-600">管理您的草稿，发布后将从本列表移除</p>
      </div>

      <Card className="border border-gray-300 bg-white">
        <CardHeader>
          <CardTitle className="text-black">我的草稿</CardTitle>
          <CardDescription className="text-gray-600">
            查看和管理草稿，发布完成后将移至发布记录
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-600">加载中...</span>
            </div>
          ) : drafts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="size-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">暂无草稿</p>
              <p className="text-sm text-gray-500">创建您的第一篇草稿吧</p>
            </div>
          ) : (
            <div className="space-y-4">
              {drafts.map((draft, index) => {
                const thumb = draftThumbSrc(draft) ?? DRAFT_LIST_PLACEHOLDER_IMG
                const kind = effectivePublishContentTypeFromRecord(draft)
                return (
                <div key={draft.id}>
                  <div
                    className={cn(
                      "flex items-center justify-between gap-4 p-4 rounded-lg border border-gray-300 bg-white transition-all duration-150 group",
                      draft.status !== 'PUBLISHED' && "hover:bg-gray-50 cursor-pointer"
                    )}
                    onClick={() => draft.status !== 'PUBLISHED' && handleEdit(draft)}
                  >
                    <img
                      src={thumb}
                      alt=""
                      className="size-20 shrink-0 rounded-lg border border-gray-200 bg-gray-100 object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h3 className="min-w-0 flex-1 font-medium text-black truncate group-hover:text-gray-700 transition-colors sm:flex-none sm:flex-initial">
                          {draft.title || '未命名作品'}
                        </h3>
                        {getStatusBadge(draft.status)}
                        <Badge
                          variant="outline"
                          className={
                            kind === 'image-text'
                              ? 'text-xs border-violet-200 bg-violet-50 text-violet-800'
                              : 'text-xs border-sky-200 bg-sky-50 text-sky-800'
                          }
                        >
                          {kind === 'image-text' ? '图文' : '文章'}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          <span>更新于 {formatDate(draft.updatedAt)}</span>
                        </div>
                        {draft.images && draft.images.length > 0 && (
                          <div className="flex items-center gap-1">
                            <ImageIcon className="size-3" />
                            <span>{draft.images.length} 张图片</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="ml-4 flex gap-2 shrink-0">
                      {draft.status === 'PUBLISHED' ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-300 text-gray-400 cursor-not-allowed"
                            disabled
                          >
                            <Edit className="size-4 mr-2" />
                            已发布不可编辑
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-300 text-black hover:bg-gray-100"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push('/publish/history')
                            }}
                          >
                            <History className="size-4 mr-2" />
                            查看发布记录
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-300 text-gray-500 hover:text-red-600 hover:border-red-300"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteDraft(draft)
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-300 text-black hover:bg-gray-100 transition-all duration-150"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEdit(draft)
                            }}
                          >
                            <Edit className="size-4 mr-2" />
                            编辑
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="bg-black text-white hover:bg-gray-800 transition-all duration-150"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/publish/works/${draft.id}/publish`)
                            }}
                          >
                            <Send className="size-4 mr-2" />
                            发布
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-300 text-gray-500 hover:text-red-600 hover:border-red-300"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteDraft(draft)
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {index < drafts.length - 1 && (
                    <Separator className="bg-gray-300 my-4" />
                  )}
                </div>
              )})}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!deleteDraft} onOpenChange={(open) => !open && setDeleteDraft(null)}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {deleteDraft?.status === 'PUBLISHED' ? '删除作品' : '删除草稿'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {deleteDraft?.status === 'PUBLISHED'
              ? '确定要删除此作品吗？仅删除本应用内的记录，不会删除远程平台（如微信公众号）上的文章。'
              : '确定要删除此草稿吗？'}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteDraft(null)} disabled={deleting}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteDraft}
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
