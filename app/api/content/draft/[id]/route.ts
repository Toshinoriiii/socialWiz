import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/auth.service'
import { prisma } from '@/lib/db/prisma'

// GET - 获取单个草稿详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const { id } = params

    // 获取草稿详情
    const draft = await prisma.content.findFirst({
      where: {
        id,
        userId: user.id,
        status: 'DRAFT'
      },
      select: {
        id: true,
        title: true,
        content: true,
        status: true,
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
