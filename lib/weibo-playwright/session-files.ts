import fs from 'fs'
import path from 'path'

const SESSIONS_DIR = path.join(process.cwd(), 'scripts', 'weibo-playwright', 'sessions')

export function getWeiboPlaywrightSessionPath (userId: string): string {
  return path.join(SESSIONS_DIR, `${userId}.json`)
}

export function getWeiboPlaywrightLockPath (userId: string): string {
  return path.join(SESSIONS_DIR, `${userId}.binding.lock`)
}

/** 旧版锁仅一行时间戳；新版第二行为 Node PID，便于识别僵尸锁 */
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

/**
 * 绑定进程已死或锁过期时删除 `.binding.lock`，避免永久挡住 POST/GET。
 * - 有 PID：进程不存在 → 删
 * - 无 PID（旧文件仅时间戳）：超过 ~3 分钟 → 删
 * - 任意：超过 20 分钟 → 删
 */
export function consumeStaleWeiboPlaywrightBindLock (lockPath: string): void {
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

/** 绑定脚本写入的展示昵称（与 storage 同目录，不入库 git） */
export function getWeiboPlaywrightProfilePath (userId: string): string {
  return path.join(SESSIONS_DIR, `${userId}.profile.json`)
}

export interface WeiboPlaywrightProfileFile {
  displayName?: string
  weiboUid?: string
  updatedAt?: number
}

export function readWeiboPlaywrightProfile (
  userId: string
): WeiboPlaywrightProfileFile | null {
  try {
    const p = getWeiboPlaywrightProfilePath(userId)
    if (!fs.existsSync(p)) return null
    const j = JSON.parse(fs.readFileSync(p, 'utf8')) as WeiboPlaywrightProfileFile
    const dn = j.displayName != null ? String(j.displayName).trim() : ''
    const uid = j.weiboUid != null ? String(j.weiboUid).trim() : ''
    const displayName = dn.length > 0 ? dn.slice(0, 80) : undefined
    const weiboUid = uid.length > 0 ? uid : undefined
    if (!displayName && !weiboUid) return null
    return { displayName, weiboUid, updatedAt: j.updatedAt }
  } catch {
    return null
  }
}

export function readWeiboPlaywrightProfileDisplayName (userId: string): string | null {
  const p = readWeiboPlaywrightProfile(userId)
  if (!p) return null
  if (p.displayName && p.displayName.length > 0) return p.displayName
  if (p.weiboUid && p.weiboUid.length > 0) return `微博用户 ${p.weiboUid}`.slice(0, 80)
  return null
}

/** 合并写入 profile（保留已有 weiboUid 等字段） */
export function writeWeiboPlaywrightProfileMerge (
  userId: string,
  partial: Partial<Pick<WeiboPlaywrightProfileFile, 'displayName' | 'weiboUid'>>
): void {
  const p = getWeiboPlaywrightProfilePath(userId)
  let existing: WeiboPlaywrightProfileFile = {}
  if (fs.existsSync(p)) {
    try {
      existing = JSON.parse(fs.readFileSync(p, 'utf8')) as WeiboPlaywrightProfileFile
    } catch {
      /* ignore */
    }
  }
  const next: WeiboPlaywrightProfileFile = {
    ...existing,
    ...partial,
    updatedAt: Date.now()
  }
  fs.writeFileSync(p, JSON.stringify(next, null, 0), 'utf8')
}

export function ensureWeiboPlaywrightSessionsDir (): void {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  }
}

export function weiboPlaywrightSessionExists (userId: string): boolean {
  return fs.existsSync(getWeiboPlaywrightSessionPath(userId))
}

/** 入库的 `platformUserId` 形如 `playwright:<socialwizUserId>` */
export const WEIBO_PLAYWRIGHT_PLATFORM_USER_ID_PREFIX = 'playwright:' as const

export function isPlaywrightWeiboUserId (platformUserId: string): boolean {
  return platformUserId.startsWith(WEIBO_PLAYWRIGHT_PLATFORM_USER_ID_PREFIX)
}

export const WEIBO_PLAYWRIGHT_ACCESS_TOKEN_SENTINEL = 'PLAYWRIGHT_SESSION'
