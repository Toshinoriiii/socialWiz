/**
 * 查询单条发布记录的状态
 * GET /api/content/publish-records/[recordId]/status
 * 
 * 微信公众号：调用 freepublish/get 获取发布状态和文章链接
 * 微博等：返回已存储的信息
 */

import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/auth.service'
import { WechatTokenService } from '@/lib/services/wechat-token.service'
import { prisma } from '@/lib/db/prisma'

const WECHAT_STATUS_MAP: Record<number, string> = {
  0: '发布成功',
  1: '发布中',
  2: '原创声明失败',
  3: '常规失败',
  4: '平台审核不通过',
  5: '成功后用户删除所有文章',
  6: '成功后系统封禁所有文章',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('token')?.value

    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const user = await AuthService.verifyToken(token).catch(() => null)
    if (!user) {
      return NextResponse.json({ error: '无效的 token' }, { status: 401 })
    }

    const { recordId } = await params

    const record = await prisma.contentPlatform.findFirst({
      where: {
        id: recordId,
        content: { userId: user.id },
      },
      include: {
        content: { select: { title: true } },
        wechatConfig: true,
      },
    })

    if (!record) {
      return NextResponse.json({ error: '发布记录不存在' }, { status: 404 })
    }

    // 微信公众号：调用 freepublish/get 查询
    if (record.wechatConfigId && record.platformContentId) {
      const tokenService = new WechatTokenService()
      const accessToken = await tokenService.getOrRefreshToken(user.id, record.wechatConfigId)
      if (!accessToken) {
        return NextResponse.json({
          platform: 'WECHAT',
          statusText: '获取凭证失败',
          publishedUrl: record.publishedUrl,
        })
      }

      const getUrl = `https://api.weixin.qq.com/cgi-bin/freepublish/get?access_token=${accessToken}`
      const publishIdNum = parseInt(String(record.platformContentId), 10)
      const res = await fetch(getUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish_id: publishIdNum }),
      })
      const data = (await res.json()) as {
        errcode?: number
        errmsg?: string
        publish_status?: number
        article_detail?: { item?: Array<{ article_url?: string }> }
      }

      if (data.errcode && data.errcode !== 0) {
        return NextResponse.json({
          platform: 'WECHAT',
          statusText: data.errmsg || '查询失败',
          publishedUrl: record.publishedUrl,
        })
      }

      const status = data.publish_status ?? -1
      const articleUrl = data.article_detail?.item?.[0]?.article_url || record.publishedUrl
      const statusText = WECHAT_STATUS_MAP[status] || `状态 ${status}`

      // 若获取到新链接且数据库未存，可异步更新（此处仅返回）
      return NextResponse.json({
        platform: 'WECHAT',
        publishId: record.platformContentId,
        status,
        statusText,
        publishedUrl: articleUrl,
        title: record.content?.title,
      })
    }

    // 微博等：返回已存储信息
    return NextResponse.json({
      platform: record.platformAccountId ? 'WEIBO' : 'UNKNOWN',
      statusText: record.publishStatus === 'SUCCESS' ? '发布成功' : record.publishStatus,
      publishedUrl: record.publishedUrl,
      title: record.content?.title,
    })
  } catch (error) {
    console.error('查询发布状态失败:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}
