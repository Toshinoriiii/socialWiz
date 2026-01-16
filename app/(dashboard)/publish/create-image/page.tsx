'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Image as ImageIcon, Upload, X, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { useUserStore } from '@/store/user.store'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'

export default function CreateImagePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const draftId = searchParams.get('id')
  const { token } = useUserStore()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
      const response = await fetch(`/api/content/image-text-draft?id=${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.draft) {
          setTitle(data.draft.title || '')
          setDescription(data.draft.description || '')
          setImages(data.draft.images || [])
        }
      } else {
        const error = await response.json()
        toast.error(error.error || '加载草稿失败')
        router.push('/publish/create-image')
      }
    } catch (error) {
      console.error('加载草稿失败:', error)
      toast.error('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    // 验证文件数量（最多9张）
    if (images.length + files.length > 9) {
      toast.error('最多只能上传9张图片')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    // 验证文件类型和大小
    const validFiles: File[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} 不是有效的图片文件`)
        continue
      }

      // 验证文件大小（10MB）
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} 文件大小不能超过 10MB`)
        continue
      }

      validFiles.push(file)
    }

    if (validFiles.length === 0) {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    try {
      setUploading(true)

      if (!token) {
        toast.error('未登录，请先登录')
        return
      }

      // 创建 FormData
      const formData = new FormData()
      validFiles.forEach((file) => {
        formData.append('images', file)
      })

      // 上传图片
      const response = await fetch('/api/content/images/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      const data = await response.json()

      if (response.ok) {
        // 添加新上传的图片到列表
        setImages(prev => [...prev, ...data.imageUrls])
        toast.success(data.message || `成功上传 ${validFiles.length} 张图片`)
      } else {
        toast.error(data.error || '上传失败')
      }
    } catch (error) {
      console.error('上传失败:', error)
      toast.error('网络错误，请重试')
    } finally {
      setUploading(false)
      // 重置文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
    toast.success('已移除图片')
  }

  const handleSaveDraft = async () => {
    if (!title.trim()) {
      toast.error('请输入图文标题')
      return
    }
    if (images.length === 0) {
      toast.error('至少需要上传一张图片')
      return
    }

    if (!token) {
      toast.error('未登录，请先登录')
      return
    }

    try {
      setSaving(true)

      const response = await fetch('/api/content/image-text-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: draftId || undefined,
          title: title.trim(),
          description: description.trim(),
          images: images
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(draftId ? '草稿已更新' : '草稿已保存')
        // 如果是新创建的草稿，更新URL以包含id
        if (!draftId && data.draft?.id) {
          router.replace(`/publish/create-image?id=${data.draft.id}`)
        }
      } else {
        toast.error(data.error || '保存失败')
      }
    } catch (error) {
      console.error('保存草稿失败:', error)
      toast.error('网络错误，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    router.push('/publish/works')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="size-8 text-gray-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">加载草稿中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-black mb-2">
          {draftId ? '编辑图文' : '创建图文'}
        </h1>
        <p className="text-gray-600">创建包含图片和文字的内容作品</p>
      </div>

      <Card className="border border-gray-300 bg-white">
        <CardHeader>
          <CardTitle className="text-black">图文信息</CardTitle>
          <CardDescription className="text-gray-600">
            填写标题、描述并上传图片
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-black">标题</Label>
            <Input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-white border-gray-300 text-black"
              placeholder="请输入图文标题"
            />
          </div>

          <Separator className="bg-gray-300" />

          <div className="space-y-2">
            <Label htmlFor="description" className="text-black">描述</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full min-h-[120px] px-3 py-2 bg-white border border-gray-300 rounded-md text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-0 transition-all duration-150"
              placeholder="请输入图文描述..."
            />
          </div>

          <Separator className="bg-gray-300" />

          <div className="space-y-2">
            <Label className="text-black">图片</Label>
            <div className="space-y-4">
              {/* 图片预览区域 - 使用 Carousel */}
              {images.length > 0 && (
                <div className="w-full max-w-xl mx-auto">
                  <Carousel
                    opts={{
                      align: 'start',
                      loop: false,
                    }}
                    className="w-full relative"
                  >
                    <CarouselContent className="-ml-2 md:-ml-4">
                      {images.map((image, index) => (
                        <CarouselItem key={index} className="pl-2 md:pl-4 basis-full">
                          <div className="relative group">
                            <div className="rounded-lg border border-gray-300 overflow-hidden bg-gray-100 flex items-center justify-center">
                              <img
                                src={image}
                                alt={`图片 ${index + 1}`}
                                className="w-full h-auto max-h-[250px] md:max-h-[300px] object-contain"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(index)}
                              disabled={uploading}
                              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 hover:bg-red-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md z-10"
                            >
                              <X className="size-4" />
                            </button>
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    {images.length > 1 && (
                      <>
                        <CarouselPrevious className="left-2 md:left-4 h-8 w-8" />
                        <CarouselNext className="right-2 md:right-4 h-8 w-8" />
                      </>
                    )}
                  </Carousel>
                  <div className="text-center mt-3">
                    <p className="text-xs text-gray-500">
                      {images.length} / 9 张图片
                    </p>
                  </div>
                </div>
              )}

              {/* 上传按钮 */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors duration-150">
                <input
                  ref={fileInputRef}
                  type="file"
                  id="image-upload"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  onChange={handleImageUpload}
                  disabled={uploading || images.length >= 9}
                  className="hidden"
                />
                <label
                  htmlFor="image-upload"
                  className={`flex flex-col items-center gap-2 ${
                    uploading || images.length >= 9
                      ? 'cursor-not-allowed opacity-50'
                      : 'cursor-pointer'
                  }`}
                >
                  {uploading ? (
                    <>
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                        <Loader2 className="size-6 text-gray-600 animate-spin" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-black">上传中...</p>
                        <p className="text-xs text-gray-500 mt-1">请稍候</p>
                      </div>
                    </>
                  ) : images.length >= 9 ? (
                    <>
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                        <ImageIcon className="size-6 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-black">已达到最大数量</p>
                        <p className="text-xs text-gray-500 mt-1">最多上传 9 张图片</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                        <Upload className="size-6 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-black">点击上传图片</p>
                        <p className="text-xs text-gray-500 mt-1">
                          支持 JPG、PNG、GIF、WebP 格式，单张最大 10MB
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          已上传 {images.length}/9 张
                        </p>
                      </div>
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="border-gray-300 text-black hover:bg-gray-100 transition-all duration-150"
            >
              取消
            </Button>
            <Button
              onClick={handleSaveDraft}
              disabled={!title.trim() || images.length === 0 || saving}
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
