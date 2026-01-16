'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Save, Eye, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useUserStore } from '@/store/user.store'
import '@uiw/react-md-editor/markdown-editor.css'

// 动态导入MDEditor以避免SSR问题
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default),
  { ssr: false }
)

export default function CreateArticlePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const draftId = searchParams.get('id')
  const { token } = useUserStore()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [previewMode, setPreviewMode] = useState<'edit' | 'live' | 'preview'>('edit')
  const loadedRef = useRef<string | null>(null)

  // 如果是编辑模式，加载草稿内容
  useEffect(() => {
    if (draftId && token && loadedRef.current !== draftId) {
      loadedRef.current = draftId
      loadDraft(draftId)
    }
  }, [draftId, token])

  const loadDraft = async (id: string) => {
    if (!token) return

    try {
      setLoading(true)
      const response = await fetch(`/api/content/draft/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.draft) {
          setTitle(data.draft.title || '')
          setContent(data.draft.content || '')
        }
      } else {
        const error = await response.json()
        toast.error(error.error || '加载草稿失败')
        router.push('/publish/create-article')
      }
    } catch (error) {
      console.error('加载草稿失败:', error)
      toast.error('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('请输入文章标题')
      return
    }
    if (!content.trim()) {
      toast.error('请输入文章内容')
      return
    }

    if (!token) {
      toast.error('未登录')
      return
    }

    try {
      setSaving(true)
      const response = await fetch('/api/content/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: draftId || undefined,
          title,
          content
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(draftId ? '草稿已更新' : '草稿已保存')
        // 如果是新创建的草稿，更新URL以支持继续编辑
        if (!draftId && data.draft?.id) {
          router.replace(`/publish/create-article?id=${data.draft.id}`)
        }
      } else {
        toast.error(data.error || '保存失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      toast.error('网络错误，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = () => {
    if (previewMode === 'preview') {
      setPreviewMode('edit')
    } else {
      setPreviewMode('preview')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-600">加载中...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-black mb-2">
          {draftId ? '编辑文章' : '创建文章'}
        </h1>
        <p className="text-gray-600">
          {draftId ? '继续编辑您的文章草稿' : '使用 Markdown 编辑器创建新的文章作品'}
        </p>
      </div>

      <Card className="border border-gray-300 bg-white">
        <CardHeader>
          <CardTitle className="text-black">文章信息</CardTitle>
          <CardDescription className="text-gray-600">
            填写文章标题和内容
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-black">文章标题</Label>
            <Input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-white border-gray-300 text-black"
              placeholder="请输入文章标题"
            />
          </div>

          <Separator className="bg-gray-300" />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-black">文章内容</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreview}
                className="border-gray-300 text-black hover:bg-gray-100 transition-all duration-150"
              >
                <Eye className="size-4 mr-2" />
                {previewMode === 'preview' ? '编辑' : '预览'}
              </Button>
            </div>
            <div data-color-mode="light" className="w-full">
              <MDEditor
                value={content}
                onChange={setContent}
                height={600}
                preview={previewMode}
                visibleDragBar={false}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-black text-white hover:bg-gray-800 transition-all duration-150"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  {draftId ? '更新中...' : '保存中...'}
                </>
              ) : (
                <>
                  <Save className="size-4 mr-2" />
                  {draftId ? '更新草稿' : '保存草稿'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
