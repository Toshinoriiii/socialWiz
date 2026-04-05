import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { spawn, type ChildProcess } from 'child_process'
import { AuthService } from '@/lib/services/auth.service'
import { prisma } from '@/lib/db/prisma'
import { Platform } from '@/types/platform.types'
import {
  ensureWechatPlaywrightSessionsDir,
  getWechatPlaywrightLockPath,
  consumeStaleWechatPlaywrightBindLock,
  wechatPlaywrightSessionExists
} from '@/lib/wechat-playwright/session-files'
import { syncWechatPlaywrightPlatformAccount } from '@/lib/wechat-playwright/sync-playwright-account'

export const runtime = 'nodejs'

/**
 * GET：是否已绑定 / 是否正在绑定
 */
export async function GET (request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    const user = await AuthService.verifyToken(authHeader.substring(7))

    const lockPath = getWechatPlaywrightLockPath(user.id)
    consumeStaleWechatPlaywrightBindLock(lockPath)
    const inProgress = fs.existsSync(lockPath)

    if (wechatPlaywrightSessionExists(user.id)) {
      await syncWechatPlaywrightPlatformAccount(user.id)
      return NextResponse.json({ bound: true, inProgress: false })
    }

    return NextResponse.json({ bound: false, inProgress })
  } catch (error) {
    console.error('[wechat-playwright-bind] GET:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    )
  }
}

/**
 * POST：弹出 Chromium，登录 mp.weixin.qq.com
 */
export async function POST (request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    const user = await AuthService.verifyToken(authHeader.substring(7))

    const cred = await prisma.wechatAccountConfig.findFirst({
      where: { userId: user.id }
    })
    if (cred) {
      return NextResponse.json(
        {
          error:
            '已绑定开发者凭证（AppID）。请先解绑后再使用浏览器会话绑定。',
          hint: '当前每平台仅支持一种主绑定方式。'
        },
        { status: 400 }
      )
    }

    const legacyOauth = await prisma.platformAccount.findFirst({
      where: {
        userId: user.id,
        platform: Platform.WECHAT,
        wechatAccountConfigId: null
      }
    })
    if (
      legacyOauth &&
      !legacyOauth.platformUserId.startsWith('wechat_playwright:')
    ) {
      return NextResponse.json(
        {
          error:
            '已绑定微信（网页授权等）。请先解绑后再使用本机浏览器绑定。',
          hint: '每用户仅允许一个微信公众号账号。'
        },
        { status: 400 }
      )
    }

    ensureWechatPlaywrightSessionsDir()

    const lockPath = getWechatPlaywrightLockPath(user.id)
    consumeStaleWechatPlaywrightBindLock(lockPath)
    if (fs.existsSync(lockPath)) {
      console.warn('[wechat-playwright-bind] skip spawn: active lock', lockPath)
      return NextResponse.json({
        started: false,
        message: '已有绑定任务在运行，请在已弹出的浏览器中完成登录'
      })
    }

    const scriptPath = path.join(
      process.cwd(),
      'scripts',
      'wechat-playwright',
      'save-session-for-user.mjs'
    )
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({ error: '未找到 Playwright 脚本' }, { status: 500 })
    }

    return await new Promise<NextResponse>((resolve) => {
      let settled = false
      let quickFailWindow = true
      const stderrChunks: string[] = []

      const child: ChildProcess = spawn(process.execPath, [scriptPath], {
        env: { ...process.env, PLAYWRIGHT_USER_ID: user.id },
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: false
      })

      child.stdout?.on('data', (d: Buffer) => {
        console.log('[wechat-playwright]', d.toString().trimEnd())
      })
      child.stderr?.on('data', (d: Buffer) => {
        const s = d.toString()
        stderrChunks.push(s)
        console.error('[wechat-playwright]', s.trimEnd())
      })

      child.on('error', (err) => {
        if (!settled) {
          settled = true
          clearTimeout(okTimer)
          resolve(
            NextResponse.json(
              {
                error: `无法启动子进程: ${err.message}`,
                hint: '请执行: pnpm exec playwright install chromium'
              },
              { status: 500 }
            )
          )
        }
      })

      child.on('exit', (code, signal) => {
        if (settled || !quickFailWindow) return
        const isFail = Boolean(signal) || (code !== 0 && code !== null)
        if (isFail) {
          settled = true
          clearTimeout(okTimer)
          const detail = stderrChunks.join('').trim().slice(0, 1200)
          resolve(
            NextResponse.json(
              {
                error: 'Playwright 启动失败（子进程已退出）',
                exitCode: code,
                signal: signal ?? undefined,
                detail: detail || '(无 stderr)',
                hint: '请安装浏览器: pnpm exec playwright install chromium'
              },
              { status: 500 }
            )
          )
        }
      })

      const okTimer = setTimeout(() => {
        quickFailWindow = false
        if (settled) return
        settled = true
        child.unref()
        resolve(
          NextResponse.json({
            started: true,
            message: '请在弹出的窗口中登录微信公众平台（mp.weixin.qq.com）。'
          })
        )
      }, 4500)
    })
  } catch (error) {
    console.error('[wechat-playwright-bind] POST:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '启动失败' },
      { status: 500 }
    )
  }
}
