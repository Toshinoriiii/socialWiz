/**
 * 微博开放平台应用配置（用户维度）
 */

import { prisma } from '@/lib/db/prisma'
import { encrypt, decrypt } from '@/lib/utils/encryption'
import type {
  WeiboAppConfigCreateInput,
  WeiboAppConfigPublic,
  WeiboAppConfigUpdateInput
} from '@/types/weibo-app-config.types'

function toPublic(row: {
  id: string
  userId: string
  appId: string
  appName: string | null
  callbackUrl: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): WeiboAppConfigPublic {
  return {
    id: row.id,
    userId: row.userId,
    appId: row.appId,
    appName: row.appName,
    callbackUrl: row.callbackUrl,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }
}

export class WeiboAppConfigService {
  async listByUserId(userId: string): Promise<WeiboAppConfigPublic[]> {
    const rows = await prisma.weiboAppConfig.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })
    return rows.map(toPublic)
  }

  async getByIdForUser(configId: string, userId: string): Promise<WeiboAppConfigPublic | null> {
    const row = await prisma.weiboAppConfig.findFirst({
      where: { id: configId, userId }
    })
    return row ? toPublic(row) : null
  }

  /**
   * OAuth 换票用：返回明文 App Secret 与回调 URL
   */
  async getSecretsForOAuth(
    configId: string,
    userId: string
  ): Promise<{ appId: string; appSecret: string; callbackUrl: string } | null> {
    const row = await prisma.weiboAppConfig.findFirst({
      where: { id: configId, userId, isActive: true }
    })
    if (!row) return null
    return {
      appId: row.appId,
      appSecret: decrypt(row.appSecret),
      callbackUrl: row.callbackUrl
    }
  }

  async create(userId: string, input: WeiboAppConfigCreateInput): Promise<WeiboAppConfigPublic> {
    const encrypted = encrypt(input.appSecret.trim())
    try {
      const row = await prisma.weiboAppConfig.create({
        data: {
          userId,
          appId: input.appId.trim(),
          appSecret: encrypted,
          appName: input.appName?.trim() || null,
          callbackUrl: input.callbackUrl.trim(),
          isActive: true
        }
      })
      return toPublic(row)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('Unique constraint') || msg.includes('unique')) {
        throw new Error('该 App Key 已存在')
      }
      throw e
    }
  }

  async update(
    configId: string,
    userId: string,
    input: WeiboAppConfigUpdateInput
  ): Promise<WeiboAppConfigPublic> {
    const existing = await prisma.weiboAppConfig.findFirst({
      where: { id: configId, userId }
    })
    if (!existing) {
      throw new Error('配置不存在或无权访问')
    }

    const data: {
      appId?: string
      appSecret?: string
      appName?: string | null
      callbackUrl?: string
      isActive?: boolean
    } = {}

    if (input.appId !== undefined) data.appId = input.appId.trim()
    if (input.appSecret !== undefined) data.appSecret = encrypt(input.appSecret.trim())
    if (input.appName !== undefined) data.appName = input.appName.trim() || null
    if (input.callbackUrl !== undefined) data.callbackUrl = input.callbackUrl.trim()
    if (input.isActive !== undefined) data.isActive = input.isActive

    try {
      const row = await prisma.weiboAppConfig.update({
        where: { id: configId },
        data
      })
      return toPublic(row)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('Unique constraint') || msg.includes('unique')) {
        throw new Error('该 App Key 已存在')
      }
      throw e
    }
  }

  async delete(configId: string, userId: string): Promise<void> {
    const existing = await prisma.weiboAppConfig.findFirst({
      where: { id: configId, userId }
    })
    if (!existing) {
      throw new Error('配置不存在或无权访问')
    }
    await prisma.weiboAppConfig.delete({ where: { id: configId } })
  }
}

export const weiboAppConfigService = new WeiboAppConfigService()
