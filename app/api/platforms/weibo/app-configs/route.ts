import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { AuthService } from '@/lib/services/auth.service'
import { weiboAppConfigService } from '@/lib/services/weibo-app-config.service'

const createSchema = z.object({
  appId: z.string().min(1),
  appSecret: z.string().min(1),
  appName: z.string().optional(),
  callbackUrl: z.string().url()
})

/**
 * GET /api/platforms/weibo/app-configs
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权，请先登录' }, { status: 401 })
    }
    const user = await AuthService.verifyToken(authHeader.substring(7))
    const items = await weiboAppConfigService.listByUserId(user.id)
    return NextResponse.json({ items })
  } catch (error) {
    console.error('list weibo app configs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取配置失败' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/platforms/weibo/app-configs
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权，请先登录' }, { status: 401 })
    }
    const user = await AuthService.verifyToken(authHeader.substring(7))
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: '参数无效', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const created = await weiboAppConfigService.create(user.id, parsed.data)
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('create weibo app config:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建失败' },
      { status: 400 }
    )
  }
}
