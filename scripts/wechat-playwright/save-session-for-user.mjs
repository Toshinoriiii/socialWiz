/**
 * 由 Next API 启动：保存微信公众平台 mp.weixin.qq.com 的浏览器会话。
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
  console.error('[wechat-playwright] 无效 PLAYWRIGHT_USER_ID')
  process.exit(1)
}

const sessionsDir = path.join(__dirname, 'sessions')
const storagePath = path.join(sessionsDir, `${userId}.json`)
const lockPath = path.join(sessionsDir, `${userId}.binding.lock`)
const profilePath = path.join(sessionsDir, `${userId}.profile.json`)

fs.mkdirSync(sessionsDir, { recursive: true })
fs.writeFileSync(lockPath, `${Date.now()}\n${process.pid}`, 'utf8')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function isLikelyLoginOrGateUrl (url) {
  if (!url) return true
  const u = url.toLowerCase()
  return (
    u.includes('open.weixin.qq.com') ||
    u.includes('/bizlogin') ||
    u.includes('loginpage') ||
    u.includes('/acct/login') ||
    u.includes('passport.') ||
    u.includes('cgi-bin/loginpage')
  )
}

function cookiesLookLikeMpAdmin (cookies) {
  const byName = Object.fromEntries(cookies.map((c) => [c.name, c.value]))
  const sid = byName.slave_sid || ''
  return sid.length >= 16
}

async function collectMpCookies (context) {
  const origins = [
    'https://mp.weixin.qq.com',
    'https://wx2.qq.com',
    'https://weixin.qq.com'
  ]
  const map = new Map()
  for (const o of origins) {
    try {
      for (const c of await context.cookies(o)) {
        map.set(`${c.domain}|${c.path}|${c.name}`, c)
      }
    } catch {
      /* ignore */
    }
  }
  return [...map.values()]
}

function normalizeMpNick (raw) {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s || s.length > 80) return null
  if (s.startsWith('gh_')) return null
  return s
}

function nickFromHtml (html) {
  if (!html || html.length < 20) return null
  const patterns = [
    /nick_name\s*:\s*"([^"\\]+)"/,
    /["']nick_name["']\s*:\s*["']([^"']+)["']/,
    /["']nickname["']\s*:\s*["']([^"']+)["']/i,
    /nickname\s*:\s*"([^"\\]+)"/i,
    /cgiData\.nick_name\s*=\s*["']([^"']+)["']/,
    /wx\.cgiData\.nick_name\s*=\s*["']([^"']+)["']/
  ]
  for (const re of patterns) {
    const m = html.match(re)
    const n = normalizeMpNick(m?.[1])
    if (n) return n
  }
  return null
}

async function resolveNicknameFromHomeAjax (context, token) {
  const refererHome = `https://mp.weixin.qq.com/cgi-bin/home?t=home/index&lang=zh_CN&token=${token}`
  const attempts = [
    {
      url: `https://mp.weixin.qq.com/cgi-bin/home?t=home/index&token=${encodeURIComponent(token)}&lang=zh_CN`,
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: refererHome
      }
    },
    {
      url: `https://mp.weixin.qq.com/cgi-bin/home?t=home/index&lang=zh_CN&token=${encodeURIComponent(token)}`,
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        Referer: 'https://mp.weixin.qq.com/'
      }
    },
    {
      url: `https://mp.weixin.qq.com/cgi-bin/settingpage?t=setting/index&action=index&token=${encodeURIComponent(token)}&lang=zh_CN`,
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        Referer: refererHome
      }
    }
  ]
  for (const { url, headers } of attempts) {
    try {
      const res = await context.request.get(url, { timeout: 25000, headers })
      if (!res.ok()) continue
      const ct = (res.headers()['content-type'] || '').toLowerCase()
      const text = await res.text().catch(() => '')
      if (!text) continue
      if (ct.includes('json')) {
        try {
          const j = JSON.parse(text)
          const candidates = [
            j?.nick_name,
            j?.nickname,
            j?.nickName,
            j?.user_name,
            j?.data?.nick_name,
            j?.data?.nickname,
            j?.user_info?.nick_name,
            j?.user_info?.nickname,
            j?.mp_admin_info?.nick_name
          ]
          for (const c of candidates) {
            const n = normalizeMpNick(c)
            if (n) return { displayName: n }
          }
        } catch {
          /* 宣称 JSON 实为 HTML 时走下方 nickFromHtml */
        }
      }
      const fromHtml = nickFromHtml(text)
      if (fromHtml) return { displayName: fromHtml }
    } catch {
      /* next */
    }
  }
  return null
}

function extractTokenFromUrl (url) {
  const m = String(url).match(/[?&#]token=(\d+)/)
  return m ? m[1] : null
}

async function resolveTokenFromContext (context, page) {
  let t = extractTokenFromUrl(page.url())
  if (t) return t
  try {
    const html = await context.request.get('https://mp.weixin.qq.com/', {
      timeout: 20000,
      headers: { Referer: 'https://mp.weixin.qq.com/' }
    })
    const u2 = html.url()
    t = extractTokenFromUrl(u2)
    if (t) return t
    const body = await html.text().catch(() => '')
    const m2 = body.match(/token:\s*'?(\d+)'?/)
    if (m2) return m2[1]
    const m3 = body.match(/data\s*:\s*\{[^}]*token\s*:\s*'?(\d+)'?/s)
    if (m3) return m3[1]
  } catch {
    /* ignore */
  }
  return null
}

async function appearsLoggedInMp (context, page) {
  try {
    const url = page.url()
    if (isLikelyLoginOrGateUrl(url)) return false
    const merged = await collectMpCookies(context)
    if (!cookiesLookLikeMpAdmin(merged)) return false
    const token = await resolveTokenFromContext(context, page)
    return Boolean(token)
  } catch {
    return false
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

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const deadline = Date.now() + 15 * 60 * 1000
let browser
let bindExitCode = 0

try {
  browser = await launchChromiumVisible()
  const context = await browser.newContext({
    locale: 'zh-CN',
    userAgent: UA
  })
  const page = await context.newPage()
  await page.goto('https://mp.weixin.qq.com/', { waitUntil: 'domcontentloaded', timeout: 120000 })

  const POLL_MS = 1500
  let confirmStreak = 0
  const REQUIRED_STREAK = 1

  while (Date.now() < deadline) {
    const ok = await appearsLoggedInMp(context, page)
    if (ok) {
      confirmStreak++
      console.log(`[wechat-playwright] 登录检测通过 ${confirmStreak}/${REQUIRED_STREAK}`)
      if (confirmStreak >= REQUIRED_STREAK) {
        const token = await resolveTokenFromContext(context, page)
        let profile = {}
        if (token) {
          const nick = await resolveNicknameFromHomeAjax(context, token)
          if (nick?.displayName) profile.displayName = nick.displayName
        }
        fs.writeFileSync(
          profilePath,
          JSON.stringify({ ...profile, updatedAt: Date.now() }, null, 0),
          'utf8'
        )
        await context.storageState({ path: storagePath })
        console.log('[wechat-playwright] 已保存会话', storagePath)
        try {
          await browser.close()
        } catch {
          /* ignore */
        }
        browser = undefined
        break
      }
    } else {
      if (confirmStreak > 0) console.log('[wechat-playwright] 登录态不稳定，重置检测计数')
      confirmStreak = 0
    }
    await sleep(POLL_MS)
  }

  if (!fs.existsSync(storagePath)) {
    console.error('[wechat-playwright] 超时未完成登录或校验失败，不写入会话')
    try {
      if (fs.existsSync(profilePath)) fs.unlinkSync(profilePath)
    } catch {
      /* ignore */
    }
  }
} catch (e) {
  bindExitCode = 1
  console.error('[wechat-playwright]', e)
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
