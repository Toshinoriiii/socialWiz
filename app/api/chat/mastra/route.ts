import { NextRequest } from 'next/server'
import { mastra } from '@/mastra'
import { streamText, convertToCoreMessages } from 'ai'

// Allow streaming responses up to 30 seconds
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const {
      messages,
      agentName,
      workflowId,
      workflowInput,
    }: {
      messages?: Array<{ role: string; content: string }>
      agentName?: string
      workflowId?: string
      workflowInput?: Record<string, any>
    } = await req.json()

    // 如果指定了 workflow，执行 workflow
    if (workflowId) {
      const workflow = mastra.getWorkflow(workflowId as any)
      if (!workflow) {
        return new Response(
          JSON.stringify({ error: `工作流 ${workflowId} 不存在` }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        )
      }

      if (!workflowInput) {
        return new Response(
          JSON.stringify({ error: '工作流需要输入参数' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // 执行 workflow - 使用正确的 execute 方法
      const result = await workflow.execute({
        inputData: workflowInput,
        state: {},
        setState: () => {},
        getStepResult: () => undefined,
        mastra,
      } as any)

      // 提取文本内容
      let textContent = ''
      if (typeof result === 'string') {
        textContent = result
      } else if (result && typeof result === 'object') {
        textContent = (result as any).activities || JSON.stringify(result, null, 2)
      }

      // 使用 streamText 创建流式响应，使用简单的模型
      const result_stream = streamText({
        model: 'deepseek/deepseek-chat',
        messages: convertToModelMessages(messages || []),
        onFinish: async () => {
          // 这里可以添加完成后的处理
        },
      })

      // 手动修改流式输出
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const chunks = textContent.split('')
            for (const chunk of chunks) {
              controller.enqueue(
                encoder.encode(`0:"${chunk.replace(/"/g, '\\"')}"\n`)
              )
              await new Promise((resolve) => setTimeout(resolve, 10))
            }
            controller.close()
          } catch (error) {
            controller.error(error)
          }
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      })
    }

    // 如果指定了 agent，使用 agent
    if (agentName) {
      const agent = mastra.getAgent(agentName as any)
      if (!agent) {
        return new Response(
          JSON.stringify({ error: `Agent ${agentName} 不存在` }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // 转换消息格式 - 从 UIMessage 中提取文本内容
      const lastMessage = messages?.[messages.length - 1]
      const userMessage = lastMessage?.parts
        ?.find((part: any) => part.type === 'text')?.text || ''

      if (!userMessage) {
        return new Response(
          JSON.stringify({ error: '没有有效的消息内容' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // 使用 agent 流式生成响应
      const response = await agent.stream([
        {
          role: 'user',
          content: userMessage,
        },
      ])

      // 创建流式响应
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of response.textStream) {
              controller.enqueue(
                encoder.encode(`0:"${chunk.replace(/"/g, '\\"')}"\n`)
              )
            }
            controller.close()
          } catch (error) {
            controller.error(error)
          }
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      })
    }

    return new Response(
      JSON.stringify({ error: '请指定 agentName 或 workflowId' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Mastra API 错误:', error)
    return new Response(
      JSON.stringify({ error: error.message || '服务器错误' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
