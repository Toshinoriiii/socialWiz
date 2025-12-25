import { NextRequest, NextResponse } from 'next/server'
import { AIModelRouter } from '@/lib/ai/model-router'
import { ImageGenClient } from '@/lib/ai/image-gen'
import { prisma } from '@/lib/db/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, model, type = 'text', template, userId } = body

    if (!prompt) {
      return NextResponse.json(
        { error: '提示词不能为空' },
        { status: 400 }
      )
    }

    // 如果有模板，将模板和提示词结合
    let finalPrompt = prompt
    if (template) {
      finalPrompt = `${template}\n\n用户需求: ${prompt}`
    }

    let result

    if (type === 'text') {
      // 生成文本
      result = await AIModelRouter.generateText({
        prompt: finalPrompt,
        model
      })

      // 记录AI生成日志
      if (userId) {
        await prisma.aIGenerationLog.create({
          data: {
            userId,
            type: 'TEXT',
            prompt: finalPrompt,
            result: result.content,
            model: result.model,
            tokensUsed: result.usage?.totalTokens || 0
          }
        })
      }

      return NextResponse.json({
        content: result.content,
        model: result.model,
        usage: result.usage
      })
    } else if (type === 'image') {
      // 生成图片
      const images = await ImageGenClient.generate({
        prompt: finalPrompt,
        model: model === 'dalle3' ? 'dalle3' : 'sd'
      })

      // 记录AI生成日志
      if (userId && images.length > 0) {
        await prisma.aIGenerationLog.create({
          data: {
            userId,
            type: 'IMAGE',
            prompt: finalPrompt,
            result: images[0].url,
            model: model || 'dalle3',
            tokensUsed: 0
          }
        })
      }

      return NextResponse.json({
        images
      })
    } else {
      return NextResponse.json(
        { error: '不支持的生成类型' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('AI生成失败:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    )
  }
}

// 流式响应端点
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const prompt = searchParams.get('prompt')
  const model = searchParams.get('model') || undefined

  if (!prompt) {
    return NextResponse.json(
      { error: '提示词不能为空' },
      { status: 400 }
    )
  }

  // 创建流式响应
  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  // 异步生成内容并写入流
  ;(async () => {
    try {
      for await (const chunk of AIModelRouter.generateTextStream({
        prompt,
        model
      })) {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`))
      }
      
      await writer.write(encoder.encode('data: [DONE]\n\n'))
    } catch (error) {
      console.error('流式生成失败:', error)
      await writer.write(
        encoder.encode(`data: ${JSON.stringify({ error: '生成失败' })}\n\n`)
      )
    } finally {
      await writer.close()
    }
  })()

  return new NextResponse(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
