import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/auth.service'
import { computeContentAnalysisRowsForUser } from '@/lib/services/engagement-overview.service'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * GET /api/analytics/content-analysis
 * 每条成功发布一条明细（微信/微博/知乎），互动数与数据概览同源实时拉取。
 */
export async function GET (request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    const user = await AuthService.verifyToken(authHeader.substring(7))
    const rows = await computeContentAnalysisRowsForUser(user.id)
    return NextResponse.json({ rows, refreshedAt: new Date().toISOString() })
  } catch (e) {
    console.error('content-analysis:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '服务器错误' },
      { status: 500 }
    )
  }
}
