import { NextRequest, NextResponse } from 'next/server'
import { wechatConfigService } from '@/lib/services/wechat-config.service'
import { verify } from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

/**
 * 从请求头获取用户ID
 */
function getUserIdFromRequest(request: NextRequest): string | null {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const decoded = verify(token, JWT_SECRET) as { userId: string }
    return decoded.userId
  } catch (error) {
    return null
  }
}

/**
 * GET /api/wechat/config/[configId]
 * 获取单个配置
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const userId = getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      )
    }

    const { configId } = await params

    const config = await wechatConfigService.getConfigById(configId, userId)
    if (!config) {
      return NextResponse.json(
        { error: '配置不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error('获取配置失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取配置失败' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/wechat/config/[configId]
 * 更新配置
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const userId = getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      )
    }

    const { configId } = await params

    const body = await request.json()
    const { appSecret, accountName, isActive } = body

    const config = await wechatConfigService.updateConfig(
      configId,
      userId,
      { appSecret, accountName, isActive }
    )

    return NextResponse.json(config)
  } catch (error) {
    console.error('更新配置失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新配置失败' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/wechat/config/[configId]
 * 删除配置
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const userId = getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      )
    }

    const { configId } = await params

    await wechatConfigService.deleteConfig(configId, userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除配置失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除配置失败' },
      { status: 500 }
    )
  }
}
