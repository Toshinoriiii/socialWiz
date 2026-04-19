import fs from 'fs'
import path from 'path'

const SESSIONS_DIR = path.join(process.cwd(), 'scripts', 'zhihu-playwright', 'sessions')

export function getZhihuPlaywrightSessionPath (userId: string): string {
  return path.join(SESSIONS_DIR, `${userId}.json`)
}

export function getZhihuPlaywrightLockPath (userId: string): string {
  return path.join(SESSIONS_DIR, `${userId}.binding.lock`)
}

/** 旧版锁仅一行时间戳；新版第二行为 Node PID */
function readBindLockMeta (lockPath: string): {
  startedAt: number | null
  pid: number | null
} {
  try {
    const lines = fs
      .readFileSync(lockPath, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    const startedAt = lines[0] != null ? Number(lines[0]) : NaN
    const pid = lines[1] != null ? Number(lines[1]) : NaN
    return {
      startedAt: Number.isFinite(startedAt) ? startedAt : null,
      pid: Number.isInteger(pid) && pid > 0 ? pid : null
    }
  } catch {
    return { startedAt: null, pid: null }
  }
}

function isPidRunning (pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function consumeStaleZhihuPlaywrightBindLock (lockPath: string): void {
  if (!fs.existsSync(lockPath)) return
  const { startedAt, pid } = readBindLockMeta(lockPath)
  const age = startedAt != null ? Date.now() - startedAt : null

  const LEGACY_NO_PID_ORPHAN_MS = 3 * 60 * 1000
  const MAX_BIND_LOCK_MS = 20 * 60 * 1000

  let remove = false
  if (age != null && age > MAX_BIND_LOCK_MS) remove = true
  else if (pid != null && !isPidRunning(pid)) remove = true
  else if (pid == null && age != null && age > LEGACY_NO_PID_ORPHAN_MS) {
    remove = true
  }

  if (remove) {
    try {
      fs.unlinkSync(lockPath)
    } catch {
      /* ignore */
    }
  }
}

export function getZhihuPlaywrightProfilePath (userId: string): string {
  return path.join(SESSIONS_DIR, `${userId}.profile.json`)
}

export interface ZhihuPlaywrightProfileFile {
  displayName?: string
  /** 主页路径 token，如 /people/foo 中的 foo */
  urlToken?: string
  updatedAt?: number
}

export function readZhihuPlaywrightProfile (
  userId: string
): ZhihuPlaywrightProfileFile | null {
  try {
    const p = getZhihuPlaywrightProfilePath(userId)
    if (!fs.existsSync(p)) return null
    const j = JSON.parse(fs.readFileSync(p, 'utf8')) as ZhihuPlaywrightProfileFile
    const dn = j.displayName != null ? String(j.displayName).trim() : ''
    const ut = j.urlToken != null ? String(j.urlToken).trim() : ''
    const displayName = dn.length > 0 ? dn.slice(0, 80) : undefined
    const urlToken = ut.length > 0 ? ut.slice(0, 120) : undefined
    if (!displayName && !urlToken) return null
    return { displayName, urlToken, updatedAt: j.updatedAt }
  } catch {
    return null
  }
}

export function readZhihuPlaywrightProfileDisplayName (userId: string): string | null {
  const p = readZhihuPlaywrightProfile(userId)
  if (!p) return null
  if (p.displayName && p.displayName.length > 0) return p.displayName
  if (p.urlToken && p.urlToken.length > 0) return `知乎 ${p.urlToken}`.slice(0, 80)
  return null
}

export function ensureZhihuPlaywrightSessionsDir (): void {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  }
}

export function zhihuPlaywrightSessionExists (userId: string): boolean {
  return fs.existsSync(getZhihuPlaywrightSessionPath(userId))
}

/** 入库的 `platformUserId` 前缀（与微博 Playwright 区分） */
export const ZHIHU_PLAYWRIGHT_PLATFORM_USER_ID_PREFIX = 'zhihu_playwright:' as const

export function isPlaywrightZhihuUserId (platformUserId: string): boolean {
  return platformUserId.startsWith(ZHIHU_PLAYWRIGHT_PLATFORM_USER_ID_PREFIX)
}

export const ZHIHU_PLAYWRIGHT_ACCESS_TOKEN_SENTINEL = 'ZHIHU_PLAYWRIGHT_SESSION'
