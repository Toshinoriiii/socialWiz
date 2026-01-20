// app/api/content/generate/[requestId]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { contentGenerationService } from '@/lib/services/content-generation.service'

/**
 * GET /api/content/generate/:requestId
 * 查询内容生成请求状态
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const { requestId } = params

    const result = await contentGenerationService.getRequest(requestId)

    if (!result) {
      return NextResponse.json(
        {
          error: '请求不存在',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      requestId: result.id,
      status: result.status,
      prompt: result.prompt,
      platform: result.platform,
      content: result.content,
      workflowExecution: result.workflowExecution,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    })
  } catch (error) {
    console.error('Get content generation request failed:', error)
    return NextResponse.json(
      {
        error: '查询请求失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}
