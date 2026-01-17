import { NextRequest, NextResponse } from 'next/server'
import { verify } from 'jsonwebtoken'
import { WechatAdapter } from '@/lib/platforms/wechat/wechat-adapter'
import { WechatTokenService } from '@/lib/services/wechat-token.service'
import { WechatConfigService } from '@/lib/services/wechat-config.service'

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
 * POST /api/platforms/wechat/publish
 * 
 * 发布内容到微信公众号
 * 
 * 请求格式: FormData
 * - configId: string (微信配置ID)
 * - title: string (标题，最多64字符)
 * - author?: string (作者)
 * - digest?: string (摘要，最多120字符)
 * - content: string (内容，支持HTML，最多20000字符)
 * - contentSourceUrl?: string (原文链接)
 * - image: File (封面图片，JPG/PNG，最大2MB)
 * 
 * 响应:
 * {
 *   success: true,
 *   platformPostId: string,  // 微信返回的media_id
 *   publishedUrl?: string,   // 文章链接
 *   message: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const userId = getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', details: '请先登录' },
        { status: 401 }
      )
    }

    // 2. 解析FormData
    const formData = await request.formData()
    const configId = formData.get('configId') as string
    const title = formData.get('title') as string
    const author = formData.get('author') as string | null
    const digest = formData.get('digest') as string | null
    const content = formData.get('content') as string
    const contentSourceUrl = formData.get('contentSourceUrl') as string | null
    const imageFile = formData.get('image') as File | null

    // 3. 验证必需字段
    if (!configId) {
      return NextResponse.json(
        { error: 'Invalid request', details: '配置ID不能为空' },
        { status: 400 }
      )
    }

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: 'Invalid request', details: '标题不能为空' },
        { status: 400 }
      )
    }

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Invalid request', details: '内容不能为空' },
        { status: 400 }
      )
    }

    if (!imageFile) {
      return NextResponse.json(
        { error: 'Missing image', details: '封面图片不能为空' },
        { status: 400 }
      )
    }

    // 验证图片类型
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (!allowedTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { error: 'Invalid file type', details: '只支持JPG/PNG格式的图片' },
        { status: 400 }
      )
    }

    // 验证图片大小
    const maxSize = 2 * 1024 * 1024 // 2MB
    if (imageFile.size > maxSize) {
      return NextResponse.json(
        { 
          error: 'File too large', 
          details: `图片大小不能超过2MB，当前${(imageFile.size / 1024 / 1024).toFixed(2)}MB` 
        },
        { status: 400 }
      )
    }

    // 4. 验证配置
    const configService = new WechatConfigService()
    const config = await configService.getConfigById(configId, userId)
    
    if (!config) {
      return NextResponse.json(
        { error: 'Config not found', details: '配置不存在或无权访问' },
        { status: 404 }
      )
    }

    if (!config.isActive) {
      return NextResponse.json(
        { error: 'Config inactive', details: '配置已禁用，请先激活配置' },
        { status: 400 }
      )
    }

    // 检查是否为个人主体
    if (config.subjectType === 'personal' || !config.canPublish) {
      return NextResponse.json(
        { 
          error: 'Forbidden', 
          details: '个人主体公众号不支持发布功能，请使用企业主体公众号或测试账号' 
        },
        { status: 403 }
      )
    }

    // 5. 获取access_token
    const tokenService = new WechatTokenService()
    const accessToken = await tokenService.getOrRefreshToken(userId, configId)
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Token error', details: '获取access_token失败' },
        { status: 500 }
      )
    }

    // 6. 转换图片为Buffer
    const imageBuffer = Buffer.from(await imageFile.arrayBuffer())

    // 7. 调用WechatAdapter发布
    const adapter = new WechatAdapter({
      appId: config.appId,
      appSecret: '', // adapter不需要secret，只需要access_token
      redirectUri: ''
    })

    const publishResult = await adapter.publish(accessToken, {
      text: content.trim(),
      title: title.trim(),
      author: author?.trim(),
      digest: digest?.trim(),
      contentSourceUrl: contentSourceUrl?.trim(),
      thumbImage: {
        buffer: imageBuffer,
        filename: imageFile.name,
        contentType: imageFile.type
      }
    })

    // 8. 处理结果
    if (!publishResult.success) {
      const errorDetails = publishResult.error || '发布失败'

      // IP白名单错误
      if (errorDetails.includes('40164') || errorDetails.includes('IP')) {
        return NextResponse.json(
          {
            error: 'Wechat API Error',
            wechatErrorCode: 40164,
            wechatErrorMsg: errorDetails,
            suggestion: '请检查服务器IP是否已添加到微信公众平台的IP白名单中'
          },
          { status: 502 }
        )
      }

      // 个人主体错误
      if (errorDetails.includes('48001') || errorDetails.includes('个人主体')) {
        return NextResponse.json(
          {
            error: 'Forbidden',
            details: '个人主体公众号不支持发布功能，请使用企业主体公众号或测试账号'
          },
          { status: 403 }
        )
      }

      // Token错误
      if (errorDetails.includes('40001') || errorDetails.includes('access_token')) {
        return NextResponse.json(
          {
            error: 'Wechat API Error',
            wechatErrorCode: 40001,
            wechatErrorMsg: errorDetails,
            suggestion: '请检查AppID和AppSecret是否正确'
          },
          { status: 502 }
        )
      }

      // 内容违规
      if (errorDetails.includes('87014')) {
        return NextResponse.json(
          {
            error: 'Content Error',
            details: '内容含有违法违规内容，请修改后重试'
          },
          { status: 400 }
        )
      }

      // 其他错误
      return NextResponse.json(
        {
          error: 'Publish failed',
          details: errorDetails
        },
        { status: 500 }
      )
    }

    // 9. 发布成功
    console.log(`[Wechat Publish API] Publish success platformPostId=${publishResult.platformPostId}`)
    return NextResponse.json(
      {
        success: true,
        platformPostId: publishResult.platformPostId,
        publishedUrl: publishResult.publishedUrl,
        message: '内容已成功发布到微信公众号'
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Wechat Publish API] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : '服务器处理请求时发生错误'
      },
      { status: 500 }
    )
  }
}
