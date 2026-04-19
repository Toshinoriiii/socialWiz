import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/auth.service'
import {
  computeEngagementOverviewForUser,
  loadEngagementSeriesForUser,
  upsertTodayEngagementSnapshot
} from '@/lib/services/engagement-overview.service'

export const runtime = 'nodejs'

/**
 * GET /api/analytics/overview?days=7
 * 汇总当前用户已成功发布微博/知乎帖的互动（微信公众号暂未计入），并写入当日快照供趋势图使用。
 */
export async function GET (request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    const user = await AuthService.verifyToken(authHeader.substring(7))

    const daysRaw = request.nextUrl.searchParams.get('days')
    const days = Math.min(
      30,
      Math.max(1, Number.parseInt(daysRaw || '7', 10) || 7)
    )

    const overview = await computeEngagementOverviewForUser(user.id)
    await upsertTodayEngagementSnapshot(user.id, overview.totals)
    const series = await loadEngagementSeriesForUser(user.id, days)

    return NextResponse.json({
      totals: overview.totals,
      series,
      postsConsidered: overview.postsConsidered,
      postsSucceeded: overview.postsSucceeded,
      warnings: overview.warnings,
      wechatExcluded: overview.wechatExcluded,
      refreshedAt: new Date().toISOString()
    })
  } catch (e) {
    console.error('analytics overview:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '服务器错误' },
      { status: 500 }
    )
  }
}
