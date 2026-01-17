/**
 * 微信发布测试接口
 * 
 * POST /api/platforms/wechat/test/publish
 * 
 * 用于测试发布图文消息到微信公众号（新版发布接口）
 * 完整流程：创建草稿 → 发布草稿
 * 参考文档：https://developers.weixin.qq.com/doc/service/guide/product/publish.html
 */

import { NextRequest, NextResponse } from 'next/server'
import { WechatClient } from '@/lib/platforms/wechat/wechat-client'

export async function POST(req: NextRequest) {
  try {
    // 验证用户身份
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: '未授权：缺少 token' },
        { status: 401 }
      )
    }

    // 获取 FormData
    const formData = await req.formData()
    const text = formData.get('text') as string
    const coverFile = formData.get('cover') as File

    if (!text || !text.trim()) {
      return NextResponse.json(
        { success: false, error: '发布内容不能为空' },
        { status: 400 }
      )
    }

    if (!coverFile) {
      return NextResponse.json(
        { success: false, error: '请上传封面图片' },
        { status: 400 }
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

    console.log('[测试发布] 步骤 1/4: 获取 Access Token...')
    const tokenInfo = await wechatClient.getApiAccessToken()
    console.log('[测试发布] ✓ Access Token 获取成功')

    console.log('[测试发布] 步骤 2/4: 上传封面图片...')
    console.log('[测试发布] 图片:', coverFile.name, `(${Math.round(coverFile.size / 1024)}KB)`)
    
    // 将 File 转换为 Buffer
    const buffer = Buffer.from(await coverFile.arrayBuffer())
    
    // 上传封面图片到微信
    const mediaId = await wechatClient.uploadMaterial(tokenInfo.access_token, buffer, coverFile.name)
    console.log('[测试发布] ✓ 封面图上传成功, media_id:', mediaId)

    console.log('[测试发布] 步骤 3/4: 创建图文草稿...')
    console.log('[测试发布] 内容:', text.substring(0, 50) + (text.length > 50 ? '...' : ''))
    
    // 创建 HTML 内容
    const htmlContent = `
      <section style="padding: 20px; font-size: 16px; line-height: 1.8; color: #333;">
        <p>${text.replace(/\n/g, '<br>')}</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 14px; text-align: center;">本文由 SocialWiz 自动发布</p>
      </section>
    `.trim()

    const draftResult = await wechatClient.createDraft(tokenInfo.access_token, [
      {
        title: '测试发布 - ' + new Date().toLocaleString('zh-CN'),
        content: htmlContent,
        thumb_media_id: mediaId,
        author: 'SocialWiz测试',
        digest: text.substring(0, 120)
      }
    ])

    console.log('[测试发布] ✓ 草稿创建成功, media_id:', draftResult.media_id)

    console.log('[测试发布] 步骤 4/4: 发布草稿...')
    const publishResult = await wechatClient.publishDraft(tokenInfo.access_token, draftResult.media_id)

    console.log('[测试发布] ✓ 发布成功:', {
      publishId: publishResult.publish_id,
      msgDataId: publishResult.msg_data_id
    })

    return NextResponse.json({
      success: true,
      publishId: publishResult.publish_id,
      msgDataId: publishResult.msg_data_id,
      mediaId: draftResult.media_id,
      message: '发布成功！发布任务已提交，请稍后在公众号后台查看'
    })

  } catch (error) {
    console.error('[测试发布] 发布失败:', error)
    
    // 提取详细错误信息
    let errorMessage = '发布失败'
    let errorDetails = undefined
    
    if (error instanceof Error) {
      errorMessage = error.message
      
      // 检查是否是微信 API 错误
      if (errorMessage.includes('频率限制')) {
        errorMessage = '发布频率过高，请稍后再试（订阅号每天只能群发1条）'
      } else if (errorMessage.includes('token')) {
        errorMessage = 'Access Token 无效或已过期'
      } else if (errorMessage.includes('40001')) {
        errorMessage = 'AppSecret 错误或不存在，请检查配置'
      } else if (errorMessage.includes('40013')) {
        errorMessage = 'AppID 无效，请检查配置'
      } else if (errorMessage.includes('45009')) {
        errorMessage = '接口调用超过限制，请稍后再试'
      }
      
      if (process.env.NODE_ENV === 'development') {
        errorDetails = String(error)
      }
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: errorDetails
      },
      { status: 500 }
    )
  }
}
