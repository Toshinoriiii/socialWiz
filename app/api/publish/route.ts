import { NextRequest, NextResponse } from 'next/server'
import { PublishService } from '@/lib/services/publish.service'

// 发布内容
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const results = await PublishService.publishContent(body)

    return NextResponse.json({ results })
  } catch (error) {
    console.error('发布内容失败:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}
