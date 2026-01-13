import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/auth.service'
import type { VerifyTokenRequest, VerifyTokenSuccessResponse, VerifyTokenErrorResponse } from '@/types/auth.types'

/**
 * POST /api/auth/verify
 * 验证 JWT token 并返回用户信息
 */
export async function POST(request: NextRequest) {
  try {
    const body: VerifyTokenRequest = await request.json()

    if (!body.token) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Token不能为空'
        } satisfies VerifyTokenErrorResponse,
        { status: 400 }
      )
    }

    // 使用 AuthService 验证 token
    const user = await AuthService.verifyToken(body.token)

    return NextResponse.json(
      {
        valid: true,
        user
      } satisfies VerifyTokenSuccessResponse
    )
  } catch (error) {
    // Token 无效或已过期
    return NextResponse.json(
      {
        valid: false,
        error: error instanceof Error ? error.message : 'Token无效或已过期'
      } satisfies VerifyTokenErrorResponse,
      { status: 401 }
    )
  }
}
