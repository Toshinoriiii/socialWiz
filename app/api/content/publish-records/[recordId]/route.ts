/**
 * 删除发布记录（仅删除本应用内的记录，不删除远程平台的文章）
 * DELETE /api/content/publish-records/[recordId]
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

    const record = await prisma.contentPlatform.findFirst({
      where: {
        id: recordId,
        content: { userId: user.id },
      },
    })

    if (!record) {
      return NextResponse.json({ error: '发布记录不存在或无权限' }, { status: 404 })
    }

    await prisma.contentPlatform.delete({
      where: { id: recordId },
    })

    return NextResponse.json({ success: true, message: '已删除' })
  } catch (error) {
    console.error('[DELETE publish-records] 失败:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
