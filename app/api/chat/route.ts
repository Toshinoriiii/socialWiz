import { UIMessage, createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { mastra } from '@/mastra';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
  }: { 
    messages: UIMessage[]; 
  } = await req.json();

  // 默认使用 Mastra agent (weatherAgent)
  try {
    const agent = mastra.getAgent('weatherAgent' as any);
    if (!agent) {
      throw new Error('Weather Agent 不存在');
    }

    // 转换消息格式：从 UIMessage 转换为 agent 需要的格式
    const agentMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    
    for (const msg of messages) {
      const textParts = msg.parts?.filter((part: any) => part.type === 'text') || [];
      if (textParts.length > 0) {
        const content = textParts.map((part: any) => {
          // 处理不同类型的 part
          if (part.type === 'text' && 'text' in part) {
            return part.text;
          }
          return '';
        }).filter(Boolean).join('\n');
        if (content.trim()) {
          agentMessages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: content,
          });
        }
      }
    }

    if (agentMessages.length === 0) {
      throw new Error('没有有效的消息内容');
    }

    // 使用 agent 流式生成响应
    const agentResponse = await agent.stream(agentMessages);

    // 使用 AI SDK 的标准方法创建 UI Message Stream
    const textId = `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const stream = createUIMessageStream({
      originalMessages: messages,
      execute: async ({ writer }) => {
        try {
          // 开始文本块
          writer.write({
            type: 'text-start',
            id: textId,
          });
          
          // 直接从 agent 的流中读取并流式写入
          for await (const chunk of agentResponse.textStream) {
            // 写入文本增量
            writer.write({
              type: 'text-delta',
              id: textId,
              delta: chunk,
            });
          }

          // 结束文本块
          writer.write({
            type: 'text-end',
            id: textId,
          });
        } catch (error: any) {
          console.error('流式响应错误:', error);
          throw error;
        }
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error: any) {
    console.error('Agent 执行错误:', error);
    console.error('错误堆栈:', error.stack);
    // 返回错误响应
    return new Response(
      JSON.stringify({ 
        error: `Agent 执行失败: ${error.message}`,
        details: error.stack 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}