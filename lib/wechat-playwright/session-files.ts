import fs from 'fs'
import path from 'path'
import { WECHAT_PLAYWRIGHT_PLATFORM_USER_ID_PREFIX } from '@/types/platform.types'

export { WECHAT_PLAYWRIGHT_PLATFORM_USER_ID_PREFIX }

const SESSIONS_DIR = path.join(process.cwd(), 'scripts', 'wechat-playwright', 'sessions')

export function getWechatPlaywrightSessionPath (userId: string): string {
  return path.join(SESSIONS_DIR, `${userId}.json`)
}

export function getWechatPlaywrightLockPath (userId: string): string {
  return path.join(SESSIONS_DIR, `${userId}.binding.lock`)
}

export function getWechatPlaywrightProfilePath (userId: string): string {
  return path.join(SESSIONS_DIR, `${userId}.profile.json`)
}

/** 与 weibo `.binding.lock` 一致的 PID + 时间戳语义，复用微博 API 的过期清理逻辑可单独拷；此处仅写元数据 */
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

export function consumeStaleWechatPlaywrightBindLock (lockPath: string): void {
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

export interface WechatPlaywrightProfileFile {
  displayName?: string
  fakeid?: string
  updatedAt?: number
}

export function readWechatPlaywrightProfile (
  userId: string
): WechatPlaywrightProfileFile | null {
  try {
    const p = getWechatPlaywrightProfilePath(userId)
    if (!fs.existsSync(p)) return null
    const j = JSON.parse(fs.readFileSync(p, 'utf8')) as WechatPlaywrightProfileFile
    const dn = j.displayName != null ? String(j.displayName).trim() : ''
    const fid = j.fakeid != null ? String(j.fakeid).trim() : ''
    return {
      displayName: dn.length > 0 ? dn.slice(0, 80) : undefined,
      fakeid: fid.length > 0 ? fid : undefined,
      updatedAt: j.updatedAt
    }
  } catch {
    return null
  }
}

export function readWechatPlaywrightProfileDisplayName (userId: string): string | null {
  const p = readWechatPlaywrightProfile(userId)
  if (!p?.displayName) return null
  return p.displayName
}

/** 合并写入 profile（保留未覆盖字段），用于服务端补全昵称等 */
export function writeWechatPlaywrightProfileMerge (
  userId: string,
  patch: Partial<WechatPlaywrightProfileFile>
): void {
  let base: Record<string, unknown> = {}
  try {
    const p = getWechatPlaywrightProfilePath(userId)
    if (fs.existsSync(p)) {
      base = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>
    }
  } catch {
    base = {}
  }
  const next: WechatPlaywrightProfileFile = {
    ...(base as WechatPlaywrightProfileFile),
    ...patch,
    updatedAt: Date.now()
  }
  fs.writeFileSync(
    getWechatPlaywrightProfilePath(userId),
    JSON.stringify(next),
    'utf8'
  )
}

/** 与 sync-playwright-account 占位文案一致，用于判断是否需要向公众平台拉取昵称 */
export const WECHAT_PLAYWRIGHT_DISPLAY_NAME_FALLBACK =
  '微信公众号（本机浏览器会话）' as const

export function ensureWechatPlaywrightSessionsDir (): void {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  }
}

export function wechatPlaywrightSessionExists (userId: string): boolean {
  return fs.existsSync(getWechatPlaywrightSessionPath(userId))
}

export function isPlaywrightWeChatUserId (platformUserId: string): boolean {
  return platformUserId.startsWith(WECHAT_PLAYWRIGHT_PLATFORM_USER_ID_PREFIX)
}

export const WECHAT_PLAYWRIGHT_ACCESS_TOKEN_SENTINEL = 'WECHAT_PLAYWRIGHT_SESSION' as const
