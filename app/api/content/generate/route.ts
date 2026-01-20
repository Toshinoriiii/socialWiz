// app/api/content/generate/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { contentGenerationService } from '@/lib/services/content-generation.service'
import { workflowExecutionService } from '@/lib/services/workflow-execution.service'
import { ContentGenerationInputSchema } from '@/types/content-generation.types'

/**
 * POST /api/content/generate
 * 创建内容生成请求
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 验证输入
    const validationResult = ContentGenerationInputSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: '输入参数验证失败',
          details: validationResult.error.errors,
        },
        { status: 400 }
      )
    }

    const input = validationResult.data

    // 创建请求记录
    const request = await contentGenerationService.createRequest(input)

    // 异步执行 Workflow (不等待完成)
    executeWorkflowAsync(request.id, input)

    return NextResponse.json(
      {
        requestId: request.id,
        status: request.status,
        message: '内容生成任务已创建,正在处理中',
      },
      { status: 202 }
    )
  } catch (error) {
    console.error('Create content generation request failed:', error)
    return NextResponse.json(
      {
        error: '创建内容生成请求失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}

/**
 * 异步执行 Workflow
 */
async function executeWorkflowAsync(
  requestId: string,
  input: {
    prompt: string
    platform?: 'weibo' | 'wechat' | 'generic'
    style?: string
    userId: string
  }
) {
  try {
    // 更新状态为搜索中
    await contentGenerationService.updateRequestStatus(requestId, 'SEARCHING')

    // 执行 Workflow
    const result = await workflowExecutionService.executeContentCreationWorkflow({
      prompt: input.prompt,
      platform: input.platform,
      style: input.style,
      requestId,
      userId: input.userId,
    })

    if (result.success) {
      // 保存生成的内容
      await contentGenerationService.saveGeneratedContent(requestId, {
        title: '生成的内容',
        body: result.content || '',
        imageUrl: result.imageUrl,
        platform: input.platform,
      })

      // 更新状态为完成
      await contentGenerationService.updateRequestStatus(requestId, 'COMPLETED')
    } else {
      // 更新状态为失败
      await contentGenerationService.updateRequestStatus(requestId, 'FAILED')
    }
  } catch (error) {
    console.error('Execute workflow failed:', error)
    await contentGenerationService.updateRequestStatus(requestId, 'FAILED')
  }
}
