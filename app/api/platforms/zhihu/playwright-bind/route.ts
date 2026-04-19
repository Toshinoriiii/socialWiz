import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { spawn, type ChildProcess } from 'child_process'
import { AuthService } from '@/lib/services/auth.service'
import {
  ensureZhihuPlaywrightSessionsDir,
  getZhihuPlaywrightLockPath,
  consumeStaleZhihuPlaywrightBindLock,
  zhihuPlaywrightSessionExists
} from '@/lib/zhihu-playwright/session-files'
import { syncZhihuPlaywrightPlatformAccount } from '@/lib/zhihu-playwright/sync-playwright-account'

export const runtime = 'nodejs'

export async function GET (request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    const user = await AuthService.verifyToken(authHeader.substring(7))

    const lockPath = getZhihuPlaywrightLockPath(user.id)
    consumeStaleZhihuPlaywrightBindLock(lockPath)
    const inProgress = fs.existsSync(lockPath)

    if (zhihuPlaywrightSessionExists(user.id)) {
      await syncZhihuPlaywrightPlatformAccount(user.id)
      return NextResponse.json({ bound: true, inProgress: false })
    }

    return NextResponse.json({ bound: false, inProgress })
  } catch (error) {
    console.error('zhihu playwright-bind GET:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    )
  }
}

export async function POST (request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    const user = await AuthService.verifyToken(authHeader.substring(7))

    ensureZhihuPlaywrightSessionsDir()

    const lockPath = getZhihuPlaywrightLockPath(user.id)
    consumeStaleZhihuPlaywrightBindLock(lockPath)
    if (fs.existsSync(lockPath)) {
      console.warn('[zhihu-playwright-bind] skip spawn: active bind lock', lockPath)
      return NextResponse.json({
        started: false,
        message: '已有绑定窗口任务在运行，请在已弹出的浏览器中完成登录'
      })
    }

    const scriptPath = path.join(
      process.cwd(),
      'scripts',
      'zhihu-playwright',
      'save-session-for-user.mjs'
    )
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({ error: '未找到 Playwright 脚本' }, { status: 500 })
    }

    return await new Promise<NextResponse>((resolve) => {
      let settled = false
      let quickFailWindow = true
      const stderrChunks: string[] = []

      const envWithUser: NodeJS.ProcessEnv = {
        ...process.env,
        PLAYWRIGHT_USER_ID: user.id
      }

      console.log('[zhihu-playwright-bind] spawning child', {
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
        console.log('[zhihu-playwright]', s.trimEnd())
      })
      child.stderr?.on('data', (d: Buffer) => {
        const s = d.toString()
        stderrChunks.push(s)
        console.error('[zhihu-playwright]', s.trimEnd())
      })

      child.on('error', (err) => {
        console.error('[zhihu-playwright] spawn error:', err)
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
            console.error('[zhihu-playwright] 子进程退出', { code, signal })
          }
          return
        }
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
            message: '请在弹出的窗口中完成知乎登录。'
          })
        )
      }, 4500)
    })
  } catch (error) {
    console.error('zhihu playwright-bind POST:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '启动失败' },
      { status: 500 }
    )
  }
}
