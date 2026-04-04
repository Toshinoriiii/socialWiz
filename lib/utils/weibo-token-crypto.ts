/**
 * 微博 access_token / refresh_token 存库加解密；兼容历史明文。
 */

import { decrypt, encrypt } from '@/lib/utils/encryption'

const ENC_PARTS = 4

function looksEncrypted(stored: string): boolean {
  return stored.split(':').length === ENC_PARTS
}

export function encryptWeiboToken(plain: string): string {
  if (!plain) return plain
  return encrypt(plain)
}

export function decryptWeiboToken(stored: string): string {
  if (!stored) return stored
  if (!looksEncrypted(stored)) {
    return stored
  }
  try {
    return decrypt(stored)
  } catch {
    return stored
  }
}
