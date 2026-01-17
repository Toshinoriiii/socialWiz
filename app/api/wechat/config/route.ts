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
 * GET /api/wechat/config
 * 获取用户的所有微信配置
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      )
    }

    const configs = await wechatConfigService.getConfigsByUserId(userId)
    return NextResponse.json(configs)
  } catch (error) {
    console.error('获取配置列表失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取配置列表失败' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/wechat/config
 * 创建新的微信配置
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { appId, appSecret, accountName, subjectType } = body

    if (!appId || !appSecret) {
      return NextResponse.json(
        { error: 'appId 和 appSecret 不能为空' },
        { status: 400 }
      )
    }

    // 验证subjectType
    if (subjectType && !['personal', 'enterprise'].includes(subjectType)) {
      return NextResponse.json(
        { error: 'subjectType 必须为 personal 或 enterprise' },
        { status: 400 }
      )
    }

    console.log('[Create Config] userId:', userId, 'appId:', appId, 'subjectType:', subjectType)

    const config = await wechatConfigService.createConfig({
      userId,
      appId,
      appSecret,
      accountName,
      subjectType
    })

    return NextResponse.json(config, { status: 201 })
  } catch (error) {
    console.error('[Create Config] 创建配置失败:', error)
    
    // 检查是否是外键约束错误
    if (error instanceof Error && error.message.includes('Foreign key constraint')) {
      return NextResponse.json(
        { error: '用户不存在，请重新登录' },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建配置失败' },
      { status: 500 }
    )
  }
}
