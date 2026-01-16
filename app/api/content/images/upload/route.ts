import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/auth.service'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_IMAGES = 9 // 最多上传9张图片

// POST - 上传图片（支持多张）
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('token')?.value

    if (!token) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      )
    }

    let user
    try {
      user = await AuthService.verifyToken(token)
    } catch (error) {
      return NextResponse.json(
        { error: '无效的 token' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const files = formData.getAll('images') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: '请选择文件' },
        { status: 400 }
      )
    }

    if (files.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: `最多只能上传 ${MAX_IMAGES} 张图片` },
        { status: 400 }
      )
    }

    // 验证所有文件
    for (const file of files) {
      // 验证文件类型
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: '不支持的文件类型，仅支持 JPEG、PNG、GIF、WebP' },
          { status: 400 }
        )
      }

      // 验证文件大小
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: '文件大小不能超过 10MB' },
          { status: 400 }
        )
      }
    }

    // 创建上传目录
    const uploadDir = join(process.cwd(), 'public', 'content-images')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // 上传所有图片
    const uploadedUrls: string[] = []
    
    for (const file of files) {
      // 生成文件名
      const fileExtension = file.name.split('.').pop() || 'jpg'
      const fileName = `${user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExtension}`
      const filePath = join(uploadDir, fileName)

      // 保存文件
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(filePath, buffer)

      // 生成访问 URL
      const imageUrl = `/content-images/${fileName}`
      uploadedUrls.push(imageUrl)
    }

    return NextResponse.json({
      imageUrls: uploadedUrls,
      message: `成功上传 ${uploadedUrls.length} 张图片`
    })
  } catch (error) {
    console.error('上传图片失败:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}
