import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/auth.service'
import { prisma } from '@/lib/db/prisma'

// POST - 保存草稿
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
    const { id, title, content } = body

    // 验证输入
    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: '标题不能为空' },
        { status: 400 }
      )
    }

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: '内容不能为空' },
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
          content: content.trim(),
          updatedAt: new Date()
        }
      })
    } else {
      draft = await prisma.content.create({
        data: {
          userId: user.id,
          title: title.trim(),
          content: content.trim(),
          status: 'DRAFT'
        }
      })
    }

    return NextResponse.json({
      success: true,
      draft: {
        id: draft.id,
        title: draft.title,
        content: draft.content,
        status: draft.status,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt
      }
    })
  } catch (error) {
    console.error('保存草稿失败:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}

// GET - 获取草稿列表
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

    // 获取当前用户的所有草稿
    const drafts = await prisma.content.findMany({
      where: {
        userId: user.id,
        status: 'DRAFT'
      },
      select: {
        id: true,
        title: true,
        status: true,
        images: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    return NextResponse.json({
      drafts
    })
  } catch (error) {
    console.error('获取草稿列表失败:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}
