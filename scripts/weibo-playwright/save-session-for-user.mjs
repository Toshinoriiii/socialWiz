/**
 * 由 Next API 启动：为指定用户保存微博浏览器会话（无 stdin，自动检测登录态）。
 * 环境变量：PLAYWRIGHT_USER_ID = 用户 UUID
 *
 * 登录判定须严格，避免未登录时因访客 Cookie（如短 SUB）误判为已登录。
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
  console.error('[weibo-playwright] 无效 PLAYWRIGHT_USER_ID')
  process.exit(1)
}

const sessionsDir = path.join(__dirname, 'sessions')
const storagePath = path.join(sessionsDir, `${userId}.json`)
const lockPath = path.join(sessionsDir, `${userId}.binding.lock`)
const profilePath = path.join(sessionsDir, `${userId}.profile.json`)

fs.mkdirSync(sessionsDir, { recursive: true })
/** 第二行 PID 供 API 判断进程是否仍存活，避免僵尸锁挡住重新绑定 */
fs.writeFileSync(lockPath, `${Date.now()}\n${process.pid}`, 'utf8')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 明显处于登录页 / 授权页 */
function isLoginOrAuthUrl (url) {
  if (!url) return true
  const u = url.toLowerCase()
  return (
    u.includes('passport.weibo.com') ||
    u.includes('login.sina.com.cn') ||
    u.includes('weibo.com/login') ||
    u.includes('/signin') ||
    u.includes('security.weibo.com')
  )
}

/**
 * Cookie：访客也可能有短 SUB，真正登录态通常 SUB 较长，且常伴随 SUBP 等
 */
function cookiesLookLikeRealSession (cookies) {
  const byName = Object.fromEntries(cookies.map((c) => [c.name, c.value]))
  const sub = byName.SUB || ''
  const subp = byName.SUBP || ''
  // 经验阈值：未登录访客 SUB 往往较短；登录后 SUB 通常明显更长
  if (sub.length < 28) return false
  // 多数登录态同时有 SUBP；仅 SUB 极长时也接受（兼容少数环境）
  if (subp.length >= 8) return true
  if (sub.length >= 48) return true
  return false
}

/** 合并多域 Cookie，便于读 H5_INDEX_TITLE（常见于 .weibo.cn / m 站） */
async function collectMergedCookies (context) {
  const origins = [
    'https://weibo.com',
    'https://www.weibo.com',
    'https://m.weibo.cn',
    'https://weibo.cn'
  ]
  const map = new Map()
  for (const o of origins) {
    try {
      for (const c of await context.cookies(o)) {
        map.set(`${c.domain}|${c.name}`, c)
      }
    } catch {
      /* ignore */
    }
  }
  return [...map.values()]
}

/**
 * Cookie 中的展示信息（非 HttpOnly 的常见键，见微博登录相关分析）
 * H5_INDEX_TITLE 为昵称的 URL 编码（多出现在移动端域）
 */
function profileFromCookies (cookies) {
  const byName = Object.fromEntries(cookies.map((c) => [c.name, c.value]))
  const raw = byName.H5_INDEX_TITLE
  if (!raw) return null
  try {
    const n = decodeURIComponent(String(raw).replace(/\+/g, ' ')).trim()
    if (n.length >= 1 && n.length <= 80) return { displayName: n, weiboUid: '' }
  } catch {
    /* ignore */
  }
  return null
}

/**
 * 解析 PC 站 ajax JSON 中常见 user / login 字段（结构随微博改版可能变化）
 */
function parseAjaxLoginUser (json) {
  if (!json || typeof json !== 'object') return null
  if (json.ok === 0 && json.msg) return null
  const out = []
  const add = (uid, name) => {
    const id =
      uid != null ? String(uid).replace(/\D/g, '') : ''
    const sn = name != null ? String(name).trim() : ''
    if (/^\d{5,15}$/.test(id) && sn.length >= 1 && sn.length <= 80) {
      out.push({ weiboUid: id, displayName: sn })
    } else if (/^\d{5,15}$/.test(id)) {
      out.push({ weiboUid: id, displayName: sn })
    } else if (sn.length >= 1 && sn.length <= 80) {
      out.push({ weiboUid: '', displayName: sn })
    }
  }
  const du = json.data?.user
  if (du) add(du.idstr ?? du.id ?? du.uid, du.screen_name ?? du.name)
  const lu = json.data?.login_user ?? json.data?.loginUser
  if (lu) add(lu.idstr ?? lu.id, lu.screen_name ?? lu.name)
  if (json.data?.uid != null) {
    add(
      json.data.uid,
      json.data.screen_name ?? json.data.userName ?? json.data.name
    )
  }
  if (json.user?.idstr ?? json.user?.id) {
    add(json.user.idstr ?? json.user.id, json.user.screen_name)
  }
  const pick =
    out.find((x) => x.weiboUid && x.displayName) || out[0]
  return pick && (pick.weiboUid || pick.displayName) ? pick : null
}

/** 使用当前浏览器存储的 Cookie 请求接口（不读页面 DOM） */
async function fetchLoggedInUserViaAjax (context) {
  const pcHeaders = {
    Referer: 'https://weibo.com/',
    Accept: 'application/json, text/plain, */*',
    'X-Requested-With': 'XMLHttpRequest'
  }
  const pcUrls = [
    'https://weibo.com/ajax/statuses/config',
    'https://weibo.com/ajax/profile/info?custom=1'
  ]
  for (const url of pcUrls) {
    try {
      const res = await context.request.get(url, {
        headers: pcHeaders,
        timeout: 25000
      })
      if (!res.ok()) continue
      const text = await res.text()
      if (!text || text[0] !== '{') continue
      const json = JSON.parse(text)
      const u = parseAjaxLoginUser(json)
      if (u && (u.weiboUid || u.displayName)) return u
    } catch {
      continue
    }
  }
  try {
    const res = await context.request.get('https://m.weibo.cn/api/config', {
      headers: {
        Referer: 'https://m.weibo.cn/',
        Accept: 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 25000
    })
    if (res.ok()) {
      const text = await res.text()
      if (text && text[0] === '{') {
        const u = parseAjaxLoginUser(JSON.parse(text))
        if (u && (u.weiboUid || u.displayName)) return u
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

/** 轮询时降低 ajax 频率；成功后缓存 */
const ajaxPollState = { at: 0, user: null }
const AJAX_POLL_MIN_MS = 1500

async function pollAjaxLoginUser (context) {
  if (ajaxPollState.user) return ajaxPollState.user
  const now = Date.now()
  if (now - ajaxPollState.at < AJAX_POLL_MIN_MS) return null
  ajaxPollState.at = now
  const u = await fetchLoggedInUserViaAjax(context)
  if (u && (u.weiboUid || u.displayName)) ajaxPollState.user = u
  return u
}

/**
 * 页面上有「已登录用户」可见特征（仅作接口失败时的后备，不用于写入昵称）
 */
async function pageShowsLoggedInUser (page) {
  try {
    return await page.evaluate(() => {
      const txt = (s) => (s || '').replace(/\s+/g, ' ').trim()

      const nameEl = document.querySelector('.woo-user-bar-name, .woo-user-bar-main_name')
      if (nameEl) {
        const n = txt(nameEl.textContent)
        if (n && n !== '登录' && n !== '注册' && n.length >= 2 && n.length <= 40) {
          return true
        }
      }

      const profileLinks = [...document.querySelectorAll('a[href*="/u/"]')]
      for (const a of profileLinks) {
        const href = a.getAttribute('href') || ''
        if (/\/u\/\d{6,}/.test(href)) {
          const label = txt(a.textContent)
          if (label && !/^首页$|^消息$|^视频$/i.test(label)) return true
        }
      }

      return false
    })
  } catch {
    return false
  }
}

async function resolveProfileFromSession (context) {
  const merged = await collectMergedCookies(context)
  const fromCookie = profileFromCookies(merged)
  const fromAjax = await fetchLoggedInUserViaAjax(context)
  const weiboUid = (fromAjax?.weiboUid || '').slice(0, 20)
  const displayName = (
    (fromAjax?.displayName && String(fromAjax.displayName).trim()) ||
    (fromCookie?.displayName && String(fromCookie.displayName).trim()) ||
    ''
  ).slice(0, 80)
  return { displayName, weiboUid }
}

/** 登录刚通过时优先用已缓存的 Ajax 用户，避免再跑一轮多域 Cookie + 长超时请求，加快关窗 */
async function resolveProfileFast (context) {
  const cached = ajaxPollState.user
  if (cached && (cached.weiboUid || cached.displayName)) {
    const displayName = (
      cached.displayName != null ? String(cached.displayName).trim() : ''
    ).slice(0, 80)
    const weiboUid = (
      cached.weiboUid != null ? String(cached.weiboUid).replace(/\D/g, '') : ''
    ).slice(0, 20)
    return { displayName, weiboUid }
  }
  return resolveProfileFromSession(context)
}

/**
 * 非登录 URL + Cookie 像真实会话 +（接口确认登录 或 DOM 后备）
 */
async function appearsLoggedInStrict (context, page) {
  try {
    const url = page.url()
    if (isLoginOrAuthUrl(url)) return false

    const cookies = await context.cookies('https://weibo.com')
    if (!cookiesLookLikeRealSession(cookies)) return false

    const viaAjax = await pollAjaxLoginUser(context)
    if (viaAjax && (viaAjax.weiboUid || viaAjax.displayName)) return true

    return await pageShowsLoggedInUser(page)
  } catch {
    return false
  }
}

/**
 * 有界面浏览器：Windows 下优先用系统 Edge/Chrome（用户更易看到窗口），否则 Playwright Chromium。
 */
async function launchChromiumVisible () {
  const base = { headless: false }
  if (process.platform === 'win32') {
    for (const channel of ['msedge', 'chrome']) {
      try {
        return await chromium.launch({ ...base, channel })
      } catch {
        /* 下一通道 */
      }
    }
  }
  return await chromium.launch(base)
}

const deadline = Date.now() + 15 * 60 * 1000
let browser
/** 非零则通知 API：子进程异常结束（未装 Chromium、网络、page 异常等）；否则 Next 会误判为已启动 */
let bindExitCode = 0
try {
  browser = await launchChromiumVisible()
  const context = await browser.newContext({
    locale: 'zh-CN',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  })
  const page = await context.newPage()
  const bindEntryUrl =
    'https://passport.weibo.com/sso/signin?url=https://me.weibo.com/'
  await page.goto(bindEntryUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })

  /**
   * 单次严格通过即落盘：已含 Cookie 校验 + Ajax 或 DOM 确认。
   * 连续多次 + 长轮询只会拖慢关窗。
   */
  let confirmStreak = 0
  const REQUIRED_STREAK = 1
  const POLL_MS = 1500

  while (Date.now() < deadline) {
    const ok = await appearsLoggedInStrict(context, page)
    if (ok) {
      confirmStreak++
      console.log(`[weibo-playwright] 登录检测通过 ${confirmStreak}/${REQUIRED_STREAK}`)
      if (confirmStreak >= REQUIRED_STREAK) {
        const { displayName, weiboUid } = await resolveProfileFast(context)
        ajaxPollState.user = null
        ajaxPollState.at = 0
        const profilePayload = { updatedAt: Date.now() }
        if (displayName) profilePayload.displayName = displayName
        if (weiboUid) profilePayload.weiboUid = weiboUid
        if (displayName || weiboUid) {
          fs.writeFileSync(profilePath, JSON.stringify(profilePayload, null, 0), 'utf8')
          console.log(
            '[weibo-playwright] 已写入资料（Cookie/接口，非 DOM）',
            JSON.stringify({ displayName: displayName || null, weiboUid: weiboUid || null })
          )
        } else {
          console.log(
            '[weibo-playwright] 未能从 Cookie/接口解析昵称或 UID，将使用默认展示名'
          )
        }
        await context.storageState({ path: storagePath })
        console.log('[weibo-playwright] 已保存会话', storagePath)
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
        console.log('[weibo-playwright] 登录态不稳定，重置检测计数')
      }
      confirmStreak = 0
    }
    await sleep(POLL_MS)
  }

  if (!fs.existsSync(storagePath)) {
    console.error('[weibo-playwright] 超时未完成登录（或未通过严格校验），不写入会话文件')
    try {
      if (fs.existsSync(profilePath)) fs.unlinkSync(profilePath)
    } catch {
      /* ignore */
    }
  }
} catch (e) {
  bindExitCode = 1
  console.error('[weibo-playwright]', e)
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
