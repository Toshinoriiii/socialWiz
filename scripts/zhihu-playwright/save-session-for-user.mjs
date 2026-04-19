/**
 * Next API 启动：为指定用户保存知乎浏览器会话。
 * 环境变量：PLAYWRIGHT_USER_ID = 用户 UUID
 */
import { chromium } from 'playwright'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const userId = process.env.PLAYWRIGHT_USER_ID || ''
const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

if (!uuidRe.test(userId)) {
  console.error('[zhihu-playwright] 无效 PLAYWRIGHT_USER_ID')
  process.exit(1)
}

const sessionsDir = path.join(__dirname, 'sessions')
const storagePath = path.join(sessionsDir, `${userId}.json`)
const lockPath = path.join(sessionsDir, `${userId}.binding.lock`)
const profilePath = path.join(sessionsDir, `${userId}.profile.json`)

fs.mkdirSync(sessionsDir, { recursive: true })
fs.writeFileSync(lockPath, `${Date.now()}\n${process.pid}`, 'utf8')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function isSigninUrl (url) {
  if (!url) return true
  const u = url.toLowerCase()
  return u.includes('/signin') || u.includes('passport.zhihu.com')
}

function cookiesLookLikeZhihuSession (cookies) {
  const byName = Object.fromEntries(cookies.map((c) => [c.name, c.value]))
  const zc0 = byName.z_c0 || ''
  const xsrf = byName._xsrf || ''
  return zc0.length >= 16 && xsrf.length >= 8
}

async function fetchMeProfile (context) {
  try {
    const cookies = await context.cookies('https://www.zhihu.com')
    const byName = Object.fromEntries(cookies.map((c) => [c.name, c.value]))
    const xsrf = byName._xsrf || ''
    const res = await context.request.get('https://www.zhihu.com/api/v4/me', {
      headers: {
        'x-requested-with': 'fetch',
        ...(xsrf ? { 'x-xsrftoken': xsrf } : {}),
        Referer: 'https://www.zhihu.com/',
        Accept: 'application/json, text/plain, */*'
      },
      timeout: 25000
    })
    if (!res.ok()) return null
    const text = await res.text()
    if (!text || text[0] !== '{') return null
    const j = JSON.parse(text)
    const name = j.name != null ? String(j.name).trim() : ''
    const urlToken = j.url_token != null ? String(j.url_token).trim() : ''
    if (!name && !urlToken) return null
    return {
      displayName: name.slice(0, 80),
      urlToken: urlToken.slice(0, 120)
    }
  } catch {
    return null
  }
}

async function launchChromiumVisible () {
  const base = { headless: false }
  if (process.platform === 'win32') {
    for (const channel of ['msedge', 'chrome']) {
      try {
        return await chromium.launch({ ...base, channel })
      } catch {
        /* next */
      }
    }
  }
  return await chromium.launch(base)
}

const deadline = Date.now() + 15 * 60 * 1000
let browser
let bindExitCode = 0
try {
  browser = await launchChromiumVisible()
  const context = await browser.newContext({
    locale: 'zh-CN',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  })
  const page = await context.newPage()
  const bindEntryUrl = 'https://www.zhihu.com/signin?next=%2F'
  await page.goto(bindEntryUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })

  let confirmStreak = 0
  const REQUIRED_STREAK = 1
  const POLL_MS = 1500

  while (Date.now() < deadline) {
    try {
      const url = page.url()
      const onSignin = isSigninUrl(url)
      const cookies = await context.cookies('https://www.zhihu.com')
      const cookieOk = cookiesLookLikeZhihuSession(cookies)
      const me = cookieOk && !onSignin ? await fetchMeProfile(context) : null
      const ok = Boolean(me) && cookieOk
      if (ok) {
        confirmStreak++
        console.log(`[zhihu-playwright] 登录检测通过 ${confirmStreak}/${REQUIRED_STREAK}`)
        if (confirmStreak >= REQUIRED_STREAK) {
          const profilePayload = {
            updatedAt: Date.now(),
            ...(me.displayName ? { displayName: me.displayName } : {}),
            ...(me.urlToken ? { urlToken: me.urlToken } : {})
          }
          fs.writeFileSync(profilePath, JSON.stringify(profilePayload, null, 0), 'utf8')
          console.log('[zhihu-playwright] 已写入资料', JSON.stringify(me))
          await context.storageState({ path: storagePath })
          console.log('[zhihu-playwright] 已保存会话', storagePath)
          try {
            await browser.close()
          } catch {
            /* ignore */
          }
          browser = undefined
          break
        }
      } else {
        if (confirmStreak > 0) {
          console.log('[zhihu-playwright] 登录态不稳定，重置检测计数')
        }
        confirmStreak = 0
      }
    } catch (e) {
      console.warn('[zhihu-playwright] poll', e)
      confirmStreak = 0
    }
    await sleep(POLL_MS)
  }

  if (!fs.existsSync(storagePath)) {
    console.error('[zhihu-playwright] 超时未完成登录，不写入会话文件')
    try {
      if (fs.existsSync(profilePath)) fs.unlinkSync(profilePath)
    } catch {
      /* ignore */
    }
  }
} catch (e) {
  bindExitCode = 1
  console.error('[zhihu-playwright]', e)
  try {
    const errLog = path.join(sessionsDir, 'last-bind-error.log')
    fs.appendFileSync(
      errLog,
      `${new Date().toISOString()} ${String(e)}\n${e?.stack || ''}\n\n`,
      'utf8'
    )
  } catch {
    /* ignore */
  }
} finally {
  try {
    await browser?.close()
  } catch {
    /* ignore */
  }
  try {
    fs.unlinkSync(lockPath)
  } catch {
    /* ignore */
  }
}
process.exit(bindExitCode)
