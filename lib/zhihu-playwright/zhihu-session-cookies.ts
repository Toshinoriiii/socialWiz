import fs from 'fs'
import { getZhihuPlaywrightSessionPath } from '@/lib/zhihu-playwright/session-files'
import type { StorageStateCookie } from '@/lib/weibo-playwright/weibo-storage-cookies'

export function readZhihuPlaywrightStorageCookies (
  userId: string
): StorageStateCookie[] | null {
  try {
    const p = getZhihuPlaywrightSessionPath(userId)
    const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as {
      cookies?: StorageStateCookie[]
    }
    const list = raw.cookies ?? []
    return list.length > 0 ? list : null
  } catch {
    return null
  }
}
