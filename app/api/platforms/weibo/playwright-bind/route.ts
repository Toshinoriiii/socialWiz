import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { spawn, type ChildProcess } from 'child_process'
import { AuthService } from '@/lib/services/auth.service'
import { prisma } from '@/lib/db/prisma'
import { Platform } from '@/types/platform.types'
import {
  ensureWeiboPlaywrightSessionsDir,
  getWeiboPlaywrightLockPath,
  consumeStaleWeiboPlaywrightBindLock,
  weiboPlaywrightSessionExists,
  WEIBO_PLAYWRIGHT_PLATFORM_USER_ID_PREFIX
} from '@/lib/weibo-playwright/session-files'
import { syncWeiboPlaywrightPlatformAccount } from '@/lib/weibo-playwright/sync-playwright-account'

/** 必须 Node 运行时才能 spawn Playwright */
export const runtime = 'nodejs'

/**
 * GET：是否已绑定 / 是否正在绑定；若会话已落盘则 upsert 账号行
 */
export async function GET (request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    const user = await AuthService.verifyToken(authHeader.substring(7))

    const lockPath = getWeiboPlaywrightLockPath(user.id)
    consumeStaleWeiboPlaywrightBindLock(lockPath)
    const inProgress = fs.existsSync(lockPath)

    if (weiboPlaywrightSessionExists(user.id)) {
      await syncWeiboPlaywrightPlatformAccount(user.id)
      return NextResponse.json({ bound: true, inProgress: false })
    }

    return NextResponse.json({ bound: false, inProgress })
  } catch (error) {
    console.error('playwright-bind GET:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    )
  }
}

/**
 * POST：在本机弹出 Chromium，由用户在网页内登录微博
 */
export async function POST (request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    const user = await AuthService.verifyToken(authHeader.substring(7))

    const oauthWeibo = await prisma.platformAccount.findFirst({
      where: {
        userId: user.id,
        platform: Platform.WEIBO,
        platformUserId: {
          not: { startsWith: WEIBO_PLAYWRIGHT_PLATFORM_USER_ID_PREFIX }
        }
      }
    })
    if (oauthWeibo) {
      return NextResponse.json(
        {
          error:
            '已绑定微博（开放平台授权）。请先解绑后再使用浏览器会话绑定。',
          hint: '当前产品每平台仅支持一个微博账号。'
        },
        { status: 400 }
      )
    }

    ensureWeiboPlaywrightSessionsDir()

    const lockPath = getWeiboPlaywrightLockPath(user.id)
    consumeStaleWeiboPlaywrightBindLock(lockPath)
    if (fs.existsSync(lockPath)) {
      console.warn('[weibo-playwright-bind] skip spawn: active bind lock', lockPath)
      return NextResponse.json({
        started: false,
        message: '已有绑定窗口任务在运行，请在已弹出的浏览器中完成登录'
      })
    }

    const scriptPath = path.join(
      process.cwd(),
      'scripts',
      'weibo-playwright',
      'save-session-for-user.mjs'
    )
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({ error: '未找到 Playwright 脚本' }, { status: 500 })
    }

    /**
     * 与手动执行一致：`node scripts/.../save-session-for-user.mjs`。
     * 曾用 `cmd /c start /wait`，在部分环境下 start 会立刻返回且未拉起 Node，表现为「点了绑定但脚本没跑」。
     */
    return await new Promise<NextResponse>((resolve) => {
      let settled = false
      let quickFailWindow = true
      const stderrChunks: string[] = []

      const envWithUser: NodeJS.ProcessEnv = {
        ...process.env,
        PLAYWRIGHT_USER_ID: user.id
      }

      console.log('[weibo-playwright-bind] spawning child', {
        platform: process.platform,
        execPath: process.execPath,
        scriptPath
      })

      const child: ChildProcess = spawn(process.execPath, [scriptPath], {
        env: envWithUser,
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: false
      })

      child.stdout?.on('data', (d: Buffer) => {
        const s = d.toString()
        console.log('[weibo-playwright]', s.trimEnd())
      })
      child.stderr?.on('data', (d: Buffer) => {
        const s = d.toString()
        stderrChunks.push(s)
        console.error('[weibo-playwright]', s.trimEnd())
      })

      child.on('error', (err) => {
        console.error('[weibo-playwright] spawn error:', err)
        if (!settled) {
          settled = true
          clearTimeout(okTimer)
          resolve(
            NextResponse.json(
              {
                error: `无法启动子进程: ${err.message}`,
                hint: '请确认使用 Node 运行 dev，并在项目根执行: pnpm exec playwright install chromium'
              },
              { status: 500 }
            )
          )
        }
      })

      child.on('exit', (code, signal) => {
        if (settled || !quickFailWindow) {
          if (code !== 0 && code !== null) {
            console.error('[weibo-playwright] 子进程退出', { code, signal })
          }
          return
        }
        const isFail =
          Boolean(signal) || (code !== 0 && code !== null)
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
                detail: detail || '(无 stderr 输出)',
                hint: '常见原因：未安装浏览器。请在项目根目录执行: pnpm exec playwright install chromium'
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
            message: '请在弹出的窗口中完成微博登录。'
          })
        )
      }, 4500)
    })
  } catch (error) {
    console.error('playwright-bind POST:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '启动失败' },
      { status: 500 }
    )
  }
}
