import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/auth.service'
import { prisma } from '@/lib/db/prisma'

// GET - 获取单个草稿详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    // 获取作品详情（草稿或已发布，用于查看/发布流程）
    const draft = await prisma.content.findFirst({
      where: {
        id,
        userId: user.id,
        status: { in: ['DRAFT', 'PUBLISHED'] }
      },
      select: {
        id: true,
        title: true,
        content: true,
        images: true,
        coverImage: true,
        contentType: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!draft) {
      return NextResponse.json(
        { error: '草稿不存在或无权限' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      draft
    })
  } catch (error) {
    console.error('获取草稿详情失败:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}

/**
 * PATCH - 将作品标为已发布（用于多平台同批发布：各平台会话型成功时 defer 了 Content 更新，全部成功后再调此接口）
 * body: { "status": "PUBLISHED" }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token =
      request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.cookies.get('token')?.value

    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    let user: { id: string }
    try {
      user = await AuthService.verifyToken(token)
    } catch {
      return NextResponse.json({ error: '无效的 token' }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as
      | { status?: string }
      | null
    if (body?.status !== 'PUBLISHED') {
      return NextResponse.json(
        { error: '仅支持将 status 设为 PUBLISHED' },
        { status: 400 }
      )
    }

    const { id } = await params
    const row = await prisma.content.findFirst({
      where: { id, userId: user.id },
      select: { id: true, status: true }
    })

    if (!row) {
      return NextResponse.json({ error: '作品不存在或无权限' }, { status: 404 })
    }

    if (row.status === 'PUBLISHED') {
      return NextResponse.json({ success: true, alreadyPublished: true })
    }

    if (row.status !== 'DRAFT') {
      return NextResponse.json(
        { error: '当前状态不可标为已发布' },
        { status: 409 }
      )
    }

    await prisma.content.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('更新作品状态失败:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}

// DELETE - 删除草稿/作品（仅删除本应用内的记录，不删除远程平台的文章）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('token')?.value

    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const user = await AuthService.verifyToken(token).catch(() => null)
    if (!user) {
      return NextResponse.json({ error: '无效的 token' }, { status: 401 })
    }

    const { id } = await params

    const content = await prisma.content.findFirst({
      where: { id, userId: user.id },
    })

    if (!content) {
      return NextResponse.json({ error: '作品不存在或无权限' }, { status: 404 })
    }

    await prisma.content.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: '已删除' })
  } catch (error) {
    console.error('删除作品失败:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}
