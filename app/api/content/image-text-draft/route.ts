import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/auth.service'
import { prisma } from '@/lib/db/prisma'

// POST - 保存图文草稿
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

    const body = await request.json()
    const { id, title, description, images } = body

    // 验证输入
    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: '标题不能为空' },
        { status: 400 }
      )
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: '至少需要上传一张图片' },
        { status: 400 }
      )
    }

    // 如果提供了id，更新现有草稿；否则创建新草稿
    let draft
    if (id) {
      // 检查草稿是否存在且属于当前用户
      const existingDraft = await prisma.content.findFirst({
        where: {
          id,
          userId: user.id,
          status: 'DRAFT'
        }
      })

      if (!existingDraft) {
        return NextResponse.json(
          { error: '草稿不存在或无权限' },
          { status: 404 }
        )
      }

      draft = await prisma.content.update({
        where: { id },
        data: {
          title: title.trim(),
          content: description?.trim() || '',
          images: images,
          coverImage: images[0] || null, // 使用第一张图片作为封面
          updatedAt: new Date()
        }
      })
    } else {
      draft = await prisma.content.create({
        data: {
          userId: user.id,
          title: title.trim(),
          content: description?.trim() || '',
          images: images,
          coverImage: images[0] || null, // 使用第一张图片作为封面
          status: 'DRAFT'
        }
      })
    }

    return NextResponse.json({
      success: true,
      draft: {
        id: draft.id,
        title: draft.title,
        description: draft.content,
        images: draft.images,
        coverImage: draft.coverImage,
        status: draft.status,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt
      }
    })
  } catch (error) {
    console.error('保存图文草稿失败:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}

// GET - 获取单个图文草稿
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: '缺少草稿ID' },
        { status: 400 }
      )
    }

    // 获取草稿
    const draft = await prisma.content.findFirst({
      where: {
        id,
        userId: user.id,
        status: 'DRAFT'
      }
    })

    if (!draft) {
      return NextResponse.json(
        { error: '草稿不存在或无权限' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      draft: {
        id: draft.id,
        title: draft.title,
        description: draft.content,
        images: draft.images,
        coverImage: draft.coverImage,
        status: draft.status,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt
      }
    })
  } catch (error) {
    console.error('获取图文草稿失败:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}
