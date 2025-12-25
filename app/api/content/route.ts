import { NextRequest, NextResponse } from 'next/server'
import { ContentService } from '@/lib/services/content.service'

// 获取内容列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const status = searchParams.get('status')
    const skip = parseInt(searchParams.get('skip') || '0')
    const take = parseInt(searchParams.get('take') || '20')

    if (!userId) {
      return NextResponse.json(
        { error: '缺少用户ID' },
        { status: 400 }
      )
    }

    const result = await ContentService.getContentList(userId, {
      status: status as any,
      skip,
      take
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('获取内容列表失败:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}

// 创建内容
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const content = await ContentService.createContent(body)

    return NextResponse.json(content, { status: 201 })
  } catch (error) {
    console.error('创建内容失败:', error)
    
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
