'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Save, Eye, FileText, Loader2, Image as ImageIcon, X } from 'lucide-react'
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
  const [coverImage, setCoverImage] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [previewMode, setPreviewMode] = useState<'edit' | 'live' | 'preview'>('edit')
  const loadedRef = useRef<string | null>(null)

  // 如果是编辑模式，加载草稿内容
  // 或者从 AI 生成跳转过来，加载 sessionStorage 中的数据
  useEffect(() => {
    const fromAi = searchParams.get('from') === 'ai'
    
    if (fromAi) {
      // 从 AI 生成跳转过来，加载 sessionStorage 中的数据
      const aiContent = sessionStorage.getItem('ai-generated-content')
      if (aiContent) {
        try {
          const data = JSON.parse(aiContent)
          setTitle(data.title || '')
          setContent(data.content || '')
          setCoverImage(data.coverImage || '')
          // 清除 sessionStorage，避免重复加载
          sessionStorage.removeItem('ai-generated-content')
        } catch (error) {
          console.error('解析 AI 生成内容失败:', error)
        }
      }
    } else if (draftId && token && loadedRef.current !== draftId) {
      // 编辑已有草稿
      loadedRef.current = draftId
      loadDraft(draftId)
    }
  }, [draftId, token, searchParams])

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
          if (data.draft.status === 'PUBLISHED') {
            toast.error('已发布的作品不可编辑')
            router.push('/publish/works')
            return
          }
          setTitle(data.draft.title || '')
          setContent(data.draft.content || '')
          setCoverImage(data.draft.coverImage || '')
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

      // 确定 contentType
      const fromAi = searchParams.get('from') === 'ai'
      let contentType = 'article' // 默认文章
      
      if (fromAi) {
        // 从 AI 生成跳转过来的，contentType 已经在 sessionStorage 中
        // 但此时 sessionStorage 可能已经被清除，所以使用默认值
        // 实际上，contentType 应该在跳转时就已经确定了（文章编辑器就是 article）
        contentType = 'article'
      } else if (draftId) {
        // 编辑已有草稿时，从草稿中获取 contentType
        const response = await fetch(`/api/content/draft/${draftId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        if (response.ok) {
          const data = await response.json()
          contentType = data.draft?.contentType || 'article'
        }
      }

      const response = await fetch('/api/content/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: draftId || undefined,
          title,
          content,
          coverImage: coverImage || undefined,
          contentType: contentType,
          aiGenerated: fromAi // 如果是从 AI 生成跳转过来的，标记为 AI 生成
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(draftId ? '草稿已更新' : '草稿已保存')
        // 如果是新创建的草稿，更新URL以支持继续编辑，并移除 from=ai 参数
        if (!draftId && data.draft?.id) {
          router.replace(`/publish/create-article?id=${data.draft.id}`)
        } else if (fromAi) {
          // 如果是从 AI 生成跳转过来的，保存后移除 from=ai 参数
          router.replace(`/publish/create-article?id=${draftId || data.draft?.id}`)
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

  const handleSetCoverFromUrl = () => {
    if (coverImageUrl.trim()) {
      setCoverImage(coverImageUrl.trim())
      setCoverImageUrl('')
      toast.success('封面图已设置')
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

          {/* 封面图配置 */}
          <div className="space-y-2">
            <Label className="text-black">封面图 (可选)</Label>
            {coverImage ? (
              <div className="relative">
                <img 
                  src={coverImage} 
                  alt="封面" 
                  className="w-full h-48 object-cover rounded border border-gray-300" 
                />
                <Button
                  onClick={() => setCoverImage('')}
                  size="sm"
                  variant="destructive"
                  className="absolute top-2 right-2"
                >
                  <X className="size-4 mr-1" />
                  移除
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input 
                  placeholder="输入图片 URL" 
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  className="bg-white border-gray-300 text-black"
                />
                <Button 
                  onClick={handleSetCoverFromUrl}
                  variant="outline"
                  className="shrink-0 border-gray-300 text-black hover:bg-gray-100"
                >
                  <ImageIcon className="size-4 mr-1" />
                  设置
                </Button>
              </div>
            )}
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
                  {draftId && searchParams.get('from') !== 'ai' ? '更新草稿' : '保存草稿'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
