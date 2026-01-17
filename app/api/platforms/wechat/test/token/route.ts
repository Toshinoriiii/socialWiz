/**
 * 微信 Access Token 测试接口
 * 
 * GET /api/platforms/wechat/test/token
 * 
 * 用于测试获取微信公众号后台接口调用凭据（Access Token）
 * 参考文档：https://developers.weixin.qq.com/doc/service/api/base/api_getaccesstoken.html
 */

import { NextRequest, NextResponse } from 'next/server'
import { WechatClient } from '@/lib/platforms/wechat/wechat-client'

export async function GET(req: NextRequest) {
  try {
    // 验证用户身份（检查 Authorization header）
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: '未授权：缺少 token' },
        { status: 401 }
      )
    }

    // 获取环境变量配置
    const appId = process.env.WECHAT_APP_ID
    const appSecret = process.env.WECHAT_APP_SECRET

    if (!appId || !appSecret) {
      return NextResponse.json(
        { 
          success: false, 
          error: '微信配置不完整：请检查环境变量 WECHAT_APP_ID 和 WECHAT_APP_SECRET' 
        },
        { status: 500 }
      )
    }

    // 创建微信客户端
    const wechatClient = new WechatClient({
      appId,
      appSecret,
      redirectUri: process.env.WECHAT_REDIRECT_URI || ''
    })

    // 调用获取 Access Token 接口
    console.log('[测试] 正在获取微信 Access Token...')
    const tokenInfo = await wechatClient.getApiAccessToken()

    console.log('[测试] 成功获取 Access Token:', {
      accessToken: tokenInfo.access_token.substring(0, 20) + '...',
      expiresIn: tokenInfo.expires_in
    })

    return NextResponse.json({
      success: true,
      accessToken: tokenInfo.access_token,
      expiresIn: tokenInfo.expires_in,
      message: '成功获取 Access Token'
    })

  } catch (error) {
    console.error('[测试] 获取 Access Token 失败:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '获取 Access Token 失败',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    )
  }
}
