import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { AuthService } from '@/lib/services/auth.service'
import { weiboAppConfigService } from '@/lib/services/weibo-app-config.service'

const uuid = z.string().uuid()

const patchSchema = z.object({
  appId: z.string().min(1).optional(),
  appSecret: z.string().min(1).optional(),
  appName: z.string().optional(),
  callbackUrl: z.string().url().optional(),
  isActive: z.boolean().optional()
})

/**
 * PATCH /api/platforms/weibo/app-configs/[configId]
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ configId: string }> }
) {
  try {
    const { configId } = await context.params
    if (!uuid.safeParse(configId).success) {
      return NextResponse.json({ error: '无效的配置 ID' }, { status: 400 })
    }
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权，请先登录' }, { status: 401 })
    }
    const user = await AuthService.verifyToken(authHeader.substring(7))
    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: '参数无效', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const updated = await weiboAppConfigService.update(configId, user.id, parsed.data)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('patch weibo app config:', error)
    const status = error instanceof Error && error.message.includes('不存在') ? 404 : 400
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新失败' },
      { status }
    )
  }
}

/**
 * DELETE /api/platforms/weibo/app-configs/[configId]
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ configId: string }> }
) {
  try {
    const { configId } = await context.params
    if (!uuid.safeParse(configId).success) {
      return NextResponse.json({ error: '无效的配置 ID' }, { status: 400 })
    }
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权，请先登录' }, { status: 401 })
    }
    const user = await AuthService.verifyToken(authHeader.substring(7))
    await weiboAppConfigService.delete(configId, user.id)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('delete weibo app config:', error)
    const status = error instanceof Error && error.message.includes('不存在') ? 404 : 400
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除失败' },
      { status }
    )
  }
}
