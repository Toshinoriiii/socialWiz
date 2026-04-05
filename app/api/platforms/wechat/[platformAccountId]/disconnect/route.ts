import fs from 'fs'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { AuthService } from '@/lib/services/auth.service'
import { Platform } from '@/types/platform.types'
import { wechatConfigService } from '@/lib/services/wechat-config.service'
import {
  getWechatPlaywrightProfilePath,
  getWechatPlaywrightSessionPath,
  isPlaywrightWeChatUserId
} from '@/lib/wechat-playwright/session-files'

/**
 * POST /api/platforms/wechat/[platformAccountId]/disconnect
 * Playwright：删会话文件 + 删账号行。
 * 开发者凭证：删 WechatAccountConfig（级联删 PlatformAccount）。
 * 其它 OAuth：清 token。
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ platformAccountId: string }> }
) {
  try {
    // 验证用户身份
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '未授权，请先登录' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const user = await AuthService.verifyToken(token)

    const { platformAccountId } = await context.params

    // 查找平台账号
    const platformAccount = await prisma.platformAccount.findUnique({
      where: { id: platformAccountId }
    })

    if (!platformAccount) {
      return NextResponse.json(
        { error: '平台账号不存在' },
        { status: 404 }
      )
    }

    // 验证账号属于当前用户
    if (platformAccount.userId !== user.id) {
      return NextResponse.json(
        { error: '无权访问此账号' },
        { status: 403 }
      )
    }

    if (platformAccount.platform !== Platform.WECHAT) {
      return NextResponse.json({ error: '非微信账号' }, { status: 400 })
    }

    if (isPlaywrightWeChatUserId(platformAccount.platformUserId)) {
      try {
        fs.unlinkSync(getWechatPlaywrightSessionPath(user.id))
      } catch {
        /* ignore */
      }
      try {
        fs.unlinkSync(getWechatPlaywrightProfilePath(user.id))
      } catch {
        /* ignore */
      }
      await prisma.platformAccount.delete({
        where: { id: platformAccountId }
      })
      return NextResponse.json({ success: true })
    }

    const wechatCfgId = (
      platformAccount as typeof platformAccount & {
        wechatAccountConfigId: string | null
      }
    ).wechatAccountConfigId

    if (wechatCfgId) {
      await wechatConfigService.deleteConfig(wechatCfgId, user.id)
      return NextResponse.json({ success: true })
    }

    await prisma.platformAccount.update({
      where: { id: platformAccountId },
      data: {
        accessToken: '',
        refreshToken: null,
        tokenExpiry: null,
        isConnected: false
      }
    })

    return NextResponse.json({
      success: true
    })
  } catch (error) {
    console.error('断开连接失败:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '断开连接失败'
      },
      { status: 500 }
    )
  }
}
