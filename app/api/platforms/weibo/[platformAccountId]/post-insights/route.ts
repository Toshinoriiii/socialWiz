import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { AuthService } from '@/lib/services/auth.service'
import { fetchWeiboPostInsightsForAccount } from '@/lib/platforms/weibo/weibo-post-insights'

/**
 * GET /api/platforms/weibo/[platformAccountId]/post-insights?postId=<微博id或idstr>
 * 可选：contentKind=image-text|article；图文时在 note 中说明阅读量与橙 V 等平台条件。
 * OAuth：开放平台 statuses/show；浏览器会话：m.weibo.cn Cookie 接口。
 */
export async function GET (
  request: NextRequest,
  context: { params: Promise<{ platformAccountId: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    const user = await AuthService.verifyToken(authHeader.substring(7))
    const { platformAccountId } = await context.params
    const postId = request.nextUrl.searchParams.get('postId')?.trim()
    if (!postId) {
      return NextResponse.json({ error: '缺少参数 postId' }, { status: 400 })
    }
    const ck = request.nextUrl.searchParams.get('contentKind')?.trim()
    const contentPublishKind =
      ck === 'image-text'
        ? ('image-text' as const)
        : ck === 'article'
          ? ('article' as const)
          : undefined

    const account = await prisma.platformAccount.findUnique({
      where: { id: platformAccountId },
      include: { weiboAppConfig: true }
    })
    if (!account) {
      return NextResponse.json({ error: '平台账号不存在' }, { status: 404 })
    }
    if (account.userId !== user.id) {
      return NextResponse.json({ error: '无权访问' }, { status: 403 })
    }
    const r = await fetchWeiboPostInsightsForAccount(account, user.id, postId, {
      contentPublishKind
    })
    if (!r.ok) {
      return NextResponse.json({ error: r.error }, { status: 400 })
    }
    return NextResponse.json({
      ok: true,
      transport: r.transport,
      data: r.data,
      note: r.note
    })
  } catch (error) {
    console.error('post-insights:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    )
  }
}
