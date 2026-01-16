'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useUserStore } from '@/store/user.store'
import { toast } from 'sonner'
import { FileText, Edit, Calendar, Loader2, Image as ImageIcon } from 'lucide-react'

interface Draft {
  id: string
  title: string
  status: string
  images?: string[]
  createdAt: string
  updatedAt: string
}

export default function WorksManagementPage() {
  const router = useRouter()
  const { token } = useUserStore()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)

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
    // 根据是否有图片判断是图文还是文章
    const isImageText = draft.images && draft.images.length > 0
    if (isImageText) {
      router.push(`/publish/create-image?id=${draft.id}`)
    } else {
      router.push(`/publish/create-article?id=${draft.id}`)
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
        <h1 className="text-2xl md:text-3xl font-bold text-black mb-2">作品管理</h1>
        <p className="text-gray-600">管理您的所有作品和草稿</p>
      </div>

      <Card className="border border-gray-300 bg-white">
        <CardHeader>
          <CardTitle className="text-black">我的作品</CardTitle>
          <CardDescription className="text-gray-600">
            查看和管理您的所有作品，包括草稿和已发布的内容
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
              <p className="text-gray-600 mb-2">暂无作品</p>
              <p className="text-sm text-gray-500">创建您的第一篇作品吧</p>
            </div>
          ) : (
            <div className="space-y-4">
              {drafts.map((draft, index) => (
                <div key={draft.id}>
                  <div
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-all duration-150 cursor-pointer group"
                    onClick={() => handleEdit(draft)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        {draft.images && draft.images.length > 0 ? (
                          <ImageIcon className="size-5 text-gray-400 shrink-0" />
                        ) : (
                          <FileText className="size-5 text-gray-400 shrink-0" />
                        )}
                        <h3 className="font-medium text-black truncate group-hover:text-gray-700 transition-colors">
                          {draft.title || '未命名作品'}
                        </h3>
                        {getStatusBadge(draft.status)}
                        {draft.images && draft.images.length > 0 && (
                          <Badge variant="outline" className="text-xs border-gray-300 text-gray-600">
                            图文
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 ml-8">
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-4 border-gray-300 text-black hover:bg-gray-100 transition-all duration-150 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEdit(draft)
                      }}
                    >
                      <Edit className="size-4 mr-2" />
                      编辑
                    </Button>
                  </div>
                  {index < drafts.length - 1 && (
                    <Separator className="bg-gray-300 my-4" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
