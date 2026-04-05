/**
 * 删除发布记录（仅删除本应用内的记录，不删除远程平台的文章）
 * DELETE /api/content/publish-records/[recordId]
 *
 * recordId 为 **作品 ID（contentId）** 时：删除该作品下全部 ContentPlatform 关联（多平台一次清掉）。
 * 兼容传入旧的 ContentPlatform 行 ID：解析出其作品 ID 后同样删除该作品下全部关联。
 */

import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/auth.service'
import { prisma } from '@/lib/db/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
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

    const { recordId } = await params

    const owned = await prisma.content.findFirst({
      where: { id: recordId, userId: user.id },
      select: { id: true },
    })

    let targetContentId: string | null = owned?.id ?? null
    if (!targetContentId) {
      const row = await prisma.contentPlatform.findFirst({
        where: {
          id: recordId,
          content: { userId: user.id },
        },
        select: { contentId: true },
      })
      targetContentId = row?.contentId ?? null
    }

    if (!targetContentId) {
      return NextResponse.json({ error: '发布记录不存在或无权限' }, { status: 404 })
    }

    await prisma.contentPlatform.deleteMany({
      where: {
        contentId: targetContentId,
        content: { userId: user.id },
      },
    })

    return NextResponse.json({ success: true, message: '已删除' })
  } catch (error) {
    console.error('[DELETE publish-records] 失败:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
