import type { VerifyTokenRequest, VerifyTokenResponse } from '@/types/auth.types'

// 缓存最近的验证结果，避免重复 API 调用
let cachedResult: {
  token: string
  result: VerifyTokenResponse
  timestamp: number
} | null = null

const CACHE_DURATION = 5000 // 5秒缓存

/**
 * 验证认证 token
 * @param token JWT token
 * @returns 验证结果，包含用户信息（如果有效）或错误信息
 */
export async function verifyToken(
  token: string
): Promise<VerifyTokenResponse> {
  // 检查缓存
  if (cachedResult && cachedResult.token === token) {
    const age = Date.now() - cachedResult.timestamp
    if (age < CACHE_DURATION) {
      return cachedResult.result
    }
  }

  try {
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token } satisfies VerifyTokenRequest)
    })

    const data = await response.json()

    const result: VerifyTokenResponse = !response.ok
      ? {
          valid: false,
          error: data.error || 'Token验证失败'
        }
      : (data as VerifyTokenResponse)

    // 更新缓存（仅缓存成功的结果）
    if (result.valid) {
      cachedResult = {
        token,
        result,
        timestamp: Date.now()
      }
    } else {
      // 清除缓存（token 无效）
      cachedResult = null
    }

    return result
  } catch (error) {
    const errorResult: VerifyTokenResponse = {
      valid: false,
      error: error instanceof Error ? error.message : '网络错误，请检查网络连接'
    }
    
    // 清除缓存（发生错误）
    cachedResult = null
    
    return errorResult
  }
}

/**
 * 清除验证缓存
 */
export function clearVerifyCache(): void {
  cachedResult = null
}
