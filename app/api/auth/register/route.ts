import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/auth.service'
import type { RegisterInput } from '@/types/user.types'

export async function POST(request: NextRequest) {
  try {
    const body: RegisterInput = await request.json()

    const result = await AuthService.register(body)

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    )
  }
}

