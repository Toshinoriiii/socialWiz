/**
 * 加密/解密工具模块
 * Feature: 005-wechat-integration
 * Algorithm: AES-256-GCM
 */

import crypto from 'crypto'

// 加密算法配置
const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 16 // 128 bits
const SALT_LENGTH = 32
const AUTH_TAG_LENGTH = 16

/**
 * 从环境变量获取加密主密钥
 */
function getMasterKey(): string {
  const masterKey = process.env.ENCRYPTION_KEY
  
  if (!masterKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }
  
  if (masterKey.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long')
  }
  
  return masterKey
}

/**
 * 从主密钥和盐值派生加密密钥
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    masterKey,
    salt,
    100000, // 迭代次数
    KEY_LENGTH,
    'sha512'
  )
}

/**
 * 加密文本
 * @param text 明文文本
 * @param masterKey 主密钥（可选，默认使用环境变量）
 * @returns 加密后的文本（格式：salt:iv:encrypted:authTag，所有部分都是hex编码）
 */
export function encrypt(text: string, masterKey?: string): string {
  try {
    const key = masterKey || getMasterKey()
    
    // 生成随机盐值和IV
    const salt = crypto.randomBytes(SALT_LENGTH)
    const iv = crypto.randomBytes(IV_LENGTH)
    
    // 派生加密密钥
    const derivedKey = deriveKey(key, salt)
    
    // 创建加密器
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv)
    
    // 加密
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    // 获取认证标签
    const authTag = cipher.getAuthTag()
    
    // 返回格式：salt:iv:encrypted:authTag
    return [
      salt.toString('hex'),
      iv.toString('hex'),
      encrypted,
      authTag.toString('hex')
    ].join(':')
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * 解密文本
 * @param encryptedText 加密的文本（格式：salt:iv:encrypted:authTag）
 * @param masterKey 主密钥（可选，默认使用环境变量）
 * @returns 解密后的明文文本
 */
export function decrypt(encryptedText: string, masterKey?: string): string {
  try {
    const key = masterKey || getMasterKey()
    
    // 解析加密文本
    const parts = encryptedText.split(':')
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted text format')
    }
    
    const [saltHex, ivHex, encrypted, authTagHex] = parts
    
    // 转换为Buffer
    const salt = Buffer.from(saltHex, 'hex')
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    
    // 派生解密密钥
    const derivedKey = deriveKey(key, salt)
    
    // 创建解密器
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv)
    decipher.setAuthTag(authTag)
    
    // 解密
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * 验证加密配置是否正确
 * @returns 是否配置正确
 */
export function validateEncryptionConfig(): boolean {
  try {
    getMasterKey()
    
    // 测试加密和解密
    const testText = 'test-encryption-' + Date.now()
    const encrypted = encrypt(testText)
    const decrypted = decrypt(encrypted)
    
    return testText === decrypted
  } catch {
    return false
  }
}

/**
 * 生成随机加密密钥（用于环境变量配置）
 * @returns 32字节的随机hex字符串
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex')
}
