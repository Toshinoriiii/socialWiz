import { UIMessage, createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { mastra } from '@/mastra';
import { getMCPClient } from '@/mastra/mcp';

// Allow streaming responses up to 5 minutes for workflow execution
export const maxDuration = 300;

export async function POST(req: Request) {
  console.log('===== API /api/chat 被调用 =====');
  
  const body = await req.json();
  console.log('Request body:', JSON.stringify(body, null, 2));
  
  const {
    messages,
  }: { 
    messages: UIMessage[];
  } = body;

  console.log('messages count:', messages?.length);

  // 获取最后一条用户消息
  const lastUserMessage = messages.filter(m => m.role === 'user').pop();
  if (!lastUserMessage) {
    return new Response(
      JSON.stringify({ error: '没有找到用户消息' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const textParts = lastUserMessage.parts?.filter((part: any) => part.type === 'text') || [];
  const userPrompt = textParts.map((part: any) => part.text).join(' ').trim();

  if (!userPrompt) {
    return new Response(
      JSON.stringify({ error: '消息内容为空' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  console.log('User prompt:', userPrompt);

  try {
    // 步骤 1: 使用意图识别 Agent 判断用户意图(并流式返回进度)
    console.log('>>> 开始意图识别');
    
    // 创建一个流,先显示意图识别中
    const textId = `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const stream = createUIMessageStream({
      originalMessages: messages,
      execute: async ({ writer }) => {
        try {
          // 开始文本块
          writer.write({ type: 'text-start', id: textId });
          
          // 显示意图识别开始标记
          writer.write({
            type: 'text-delta',
            id: textId,
            delta: '<!--INTENT_RECOGNIZING_START-->**意图识别中...**\n\n',
          });

          const intentRouterAgent = mastra.getAgent('intentRouterAgent' as any);
          if (!intentRouterAgent) {
            throw new Error('intentRouterAgent 未找到');
          }

          // 使用流式输出,展示AI的推理过程
          console.log('>>> 开始流式意图识别');
          const intentStream = await intentRouterAgent.stream([{
            role: 'user',
            content: userPrompt,
          }]);

          let intentResponseText = '';
          
          // 实时流式输出意图识别的推理过程
          for await (const chunk of intentStream.textStream) {
            intentResponseText += chunk;
            writer.write({
              type: 'text-delta',
              id: textId,
              delta: chunk,
            });
          }
          
          writer.write({
            type: 'text-delta',
            id: textId,
            delta: '\n\n<!--INTENT_RECOGNIZING_END-->',
          });

          console.log('>>> 意图识别流式输出完成');

          // 解析意图识别结果
          let intentData: {
            intent: 'article-creation-workflow' | 'social-media-post' | 'image-generation' | 'web-search' | 'general-chat';
            confidence: number;
            reasoning: string;
          };

          try {
            // 尝试从 Markdown 代码块中提取 JSON
            const jsonMatch = intentResponseText.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
              intentData = JSON.parse(jsonMatch[1]);
            } else {
              intentData = JSON.parse(intentResponseText);
            }
          } catch (error) {
            console.error('Failed to parse intent response:', intentResponseText);
            // 默认使用 general-chat
            intentData = {
              intent: 'general-chat',
              confidence: 0.5,
              reasoning: 'Failed to parse intent, defaulting to general chat',
            };
          }

          console.log('>>> 意图识别结果:', intentData);

          // 显示结构化的意图识别结果(紧凑格式,无分割线)
          writer.write({
            type: 'text-delta',
            id: textId,
            delta: '<!--INTENT_RECOGNITION_START-->**意图**: `' + intentData.intent + '`  \n**置信度**: ' + (intentData.confidence * 100).toFixed(0) + '%  \n**原因**: ' + intentData.reasoning + '<!--INTENT_RECOGNITION_END-->',
          });

          writer.write({
            type: 'text-delta',
            id: textId,
            delta: '\n\n',
          });

          // 步骤 2: 根据意图执行对应的处理流程
          await executeWorkflowInStream(writer, textId, intentData, messages, userPrompt);

        } catch (error: any) {
          console.error('流程执行错误:', error);
          writer.write({
            type: 'text-delta',
            id: textId,
            delta: `

❌ **错误**: ${error.message}

`,
          });
          writer.write({ type: 'text-end', id: textId });
        }
      },
    });
    
    return createUIMessageStreamResponse({ stream });
  } catch (error: any) {
    console.error('API 执行错误:', error);
    return new Response(
      JSON.stringify({ 
        error: `执行失败: ${error.message}`,
        details: error.stack 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

/**
 * 在已开始的 stream 中执行工作流
 */
async function executeWorkflowInStream(
  writer: any,
  textId: string,
  intentData: {
    intent: string;
    confidence: number;
    reasoning: string;
  },
  messages: UIMessage[],
  userPrompt: string
) {
  console.log('[executeWorkflowInStream] 开始执行, intent:', intentData.intent);
  
  // 根据意图路由到不同的处理流程
  try {
    switch (intentData.intent) {
      case 'article-creation-workflow':
        console.log('>>> 路由到: 文章创作工作流');
        await executeContentCreationWorkflowInStream(writer, textId, userPrompt);
        break;
      
      case 'social-media-post':
        console.log('>>> 路由到: 社交媒体图文创作');
        await executeSocialMediaPostInStream(writer, textId, userPrompt);
        break;
      
      case 'image-generation':
        console.log('>>> 路由到: 图片生成工作流');
        await executeImageGenerationInStream(writer, textId, userPrompt);
        break;
      
      case 'web-search':
        console.log('>>> 路由到: 联网搜索');
        await executeWebSearchInStream(writer, textId, userPrompt);
        break;
      
      case 'general-chat':
      default:
        console.log('>>> 路由到: 一般对话');
        await executeGeneralChatInStream(writer, textId);
        break;
    }
    
    console.log('[executeWorkflowInStream] 工作流执行完成');
    
    // 所有工作流完成后,结束文本块
    writer.write({ type: 'text-end', id: textId });
    console.log('[executeWorkflowInStream] 已发送 text-end');
  } catch (error) {
    console.error('[executeWorkflowInStream] 执行错误:', error);
    throw error; // 向上抛出错误,由外层处理
  }
}

/**
 * 在 stream 中执行一般对话(不创建text-start)
 */
async function executeGeneralChatInStream(writer: any, textId: string) {
  // 简单回复
  const response = `你好！我是 SocialWiz 智能助手。

我可以帮你：

1. **创作自媒体内容** - 输入主题，我会帮你搜索资料、生成文案、配图
2. **生成图片** - 描述你想要的图片，我会生成精美的AI图片
3. **联网搜索** - 查询最新信息和热点资讯
4. **日常对话** - 回答你的问题

请告诉我你需要什么帮助？`;
  
  // 模拟流式输出
  for (const char of response) {
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: char,
    });
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

/**
 * 在 stream 中执行联网搜索
 */
async function executeWebSearchInStream(writer: any, textId: string, userPrompt: string) {
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: '**开始联网搜索**\n\n',
  });

  const webSearchAgent = mastra.getAgent('webSearchAgent' as any);
  if (!webSearchAgent) {
    throw new Error('webSearchAgent 未找到');
  }
  
  // Agent的instructions已包含所有业务逻辑，只需传递数据
  const searchStream = await webSearchAgent.stream([{
    role: 'user',
    content: `搜索主题: ${userPrompt}\n\n用途: 获取最新信息`,
  }]);
  
  for await (const chunk of searchStream.textStream) {
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: chunk,
    });
  }
}

/**
 * 在 stream 中执行图片生成(不创建text-start)
 */
async function executeImageGenerationInStream(writer: any, textId: string, prompt: string) {
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: '**开始执行图片生成工作流**\n\n',
  });

  writer.write({
    type: 'text-delta',
    id: textId,
    delta: '工作流包含 2 个步骤: 生成提示词 → 生成图片\n\n',
  });

  writer.write({
    type: 'text-delta',
    id: textId,
    delta: '---\n\n',
  });

  // 步骤 1: 生成图片提示词
  const step1Id = 'image-prompt';
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step1Id}:START:running-->步骤 1/2: 生成图片提示词
正在生成...
<!--STEP:${step1Id}:INPUT-->
\`\`\`json
${JSON.stringify({ userRequest: prompt, aspectRatio: '1:1' }, null, 2)}
\`\`\`
<!--STEP:${step1Id}:INPUT:END-->

`,
  });

  const imagePromptAgent = mastra.getAgent('imagePromptAgent' as any);
  if (!imagePromptAgent) {
    throw new Error('imagePromptAgent 未找到');
  }

  // 使用流式输出，让用户看到生成过程
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step1Id}:OUTPUT:STREAMING-->`,
  });

  const promptStream = await imagePromptAgent.stream([{
    role: 'user',
    content: `用户请求：${prompt}\n\n宽高比：1:1`,
  }]);

  let fullPromptResponse = '';
  for await (const chunk of promptStream.textStream) {
    fullPromptResponse += chunk;
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: chunk,
    });
  }

  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step1Id}:OUTPUT:STREAMING:END-->\n<!--STEP:${step1Id}:END:completed-->\n\n`,
  });

  let imagePromptData;
  try {
    const jsonMatch = fullPromptResponse.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      imagePromptData = JSON.parse(jsonMatch[1]);
    } else {
      imagePromptData = JSON.parse(fullPromptResponse || '{}');
    }
  } catch {
    imagePromptData = { prompt: fullPromptResponse || 'A beautiful image', aspectRatio: '1:1' };
  }

  // 步骤 2: 生成图片
  const step2Id = 'image-generation';
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step2Id}:START:running-->步骤 2/2: 生成图片
正在调用图片生成服务...
<!--STEP:${step2Id}:INPUT-->
\`\`\`json
${JSON.stringify({ prompt: imagePromptData.prompt, aspect_ratio: imagePromptData.aspectRatio }, null, 2)}
\`\`\`
<!--STEP:${step2Id}:INPUT:END-->

`,
  });

  try {
    const mcpClient = getMCPClient();
    const allTools = await mcpClient.getTools();
    const imageToolEntry = Object.entries(allTools).find(
      ([name]) => name.toLowerCase().includes('image')
    );

    if (imageToolEntry) {
      const [toolName, imageTool] = imageToolEntry;
      const toolArgs = {
        prompt: imagePromptData.prompt,
        aspect_ratio: imagePromptData.aspectRatio || '1:1',
      };
      const imageResult = await imageTool.execute({ context: toolArgs });
      
      // 提取图片 URL
      let imageUrl = '';
      
      if (typeof imageResult === 'string') {
        imageUrl = imageResult;
      } else if (typeof imageResult === 'object' && imageResult !== null) {
        const result = imageResult as any;
        
        if (Array.isArray(result.content) && result.content.length > 0) {
          const firstContent = result.content[0];
          if (firstContent.type === 'text' && typeof firstContent.text === 'string') {
            try {
              const parsedText = JSON.parse(firstContent.text);
              if (Array.isArray(parsedText.results) && parsedText.results.length > 0) {
                imageUrl = parsedText.results[0];
              }
            } catch (e) {
              console.error('[Image Generation] Failed to parse:', e);
            }
          }
        }
        
        if (!imageUrl && result.text && typeof result.text === 'string') {
          try {
            const parsedText = JSON.parse(result.text);
            if (Array.isArray(parsedText.results) && parsedText.results.length > 0) {
              imageUrl = parsedText.results[0];
            }
          } catch (e) {
            console.error('[Image Generation] Failed to parse text:', e);
          }
        }
        
        if (!imageUrl) {
          imageUrl = result.url || result.imageUrl || result.image_url || 
                    result.data?.url || result.output?.url || '';
          
          if (Array.isArray(result.images) && result.images.length > 0) {
            imageUrl = result.images[0].url || result.images[0];
          }
          
          if (Array.isArray(result.results) && result.results.length > 0) {
            imageUrl = result.results[0];
          }
        }
      }
      
      const proxyUrl = imageUrl ? `/api/image-proxy?url=${encodeURIComponent(imageUrl)}` : '';
      
      writer.write({
        type: 'text-delta',
        id: textId,
        delta: `<!--STEP:${step2Id}:OUTPUT-->
**图片生成结果**：
\`\`\`json
${JSON.stringify({ 
  success: true,
  originalUrl: imageUrl,
  proxyUrl: proxyUrl
}, null, 2)}
\`\`\`

**生成的图片**：

${proxyUrl ? `![生成的图片](${proxyUrl})` : '未能提取图片 URL'}

<!--STEP:${step2Id}:OUTPUT:END-->
<!--STEP:${step2Id}:END:completed-->

`,
      });

      // 输出最终结果
      writer.write({
        type: 'text-delta',
        id: textId,
        delta: '<!--FINAL_RESULT_START-->\n## 最终图片\n\n',
      });

      writer.write({
        type: 'text-delta',
        id: textId,
        delta: `**提示词**: ${imagePromptData.prompt}\n\n`,
      });

      writer.write({
        type: 'text-delta',
        id: textId,
        delta: proxyUrl ? `![生成的图片](${proxyUrl})` : '图片生成失败',
      });
      
      writer.write({
        type: 'text-delta',
        id: textId,
        delta: '\n<!--FINAL_RESULT_END-->',
      });
    } else {
      writer.write({
        type: 'text-delta',
        id: textId,
        delta: `<!--STEP:${step2Id}:OUTPUT-->未找到图片生成工具<!--STEP:${step2Id}:OUTPUT:END-->\n<!--STEP:${step2Id}:END:error-->\n\n`,
      });
    }
  } catch (error) {
    console.error('Image generation error:', error);
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--STEP:${step2Id}:OUTPUT-->图片生成失败: ${error instanceof Error ? error.message : '未知错误'}<!--STEP:${step2Id}:OUTPUT:END-->\n<!--STEP:${step2Id}:END:error-->\n\n`,
    });
  }
}

/**
 * 在 stream 中执行社交媒体图文创作(简化版,可后续完善)
 */
async function executeSocialMediaPostInStream(writer: any, textId: string, prompt: string) {
  console.log('[executeSocialMediaPostInStream] 开始执行');
  
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: '**开始执行社交媒体图文创作工作流**\n\n',
  });

  writer.write({
    type: 'text-delta',
    id: textId,
    delta: '工作流包含 4 个步骤: 联网搜索 → 文案生成 → 配图规划 → 图片生成\n\n',
  });

  writer.write({
    type: 'text-delta',
    id: textId,
    delta: '---\n\n',
  });

  // 步骤 1: 联网搜索
  const step1Id = 'web-search';
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step1Id}:START:running-->步骤 1/4: 联网搜索
正在搜索相关信息...
<!--STEP:${step1Id}:INPUT-->
\`\`\`json
${JSON.stringify({ query: prompt, purpose: '社交媒体内容创作' }, null, 2)}
\`\`\`
<!--STEP:${step1Id}:INPUT:END-->

`,
  });

  const webSearchAgent = mastra.getAgent('webSearchAgent' as any);
  if (!webSearchAgent) {
    throw new Error('webSearchAgent 未找到');
  }
  
  // Agent的instructions已包含所有业务逻辑，只需传递数据
  const searchStream = await webSearchAgent.stream([{
    role: 'user',
    content: `搜索主题: ${prompt}\n\n用途: 社交媒体内容创作`,
  }]);
  
  let searchResults = '';
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step1Id}:OUTPUT:STREAMING-->`,
  });
  
  for await (const chunk of searchStream.textStream) {
    searchResults += chunk;
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: chunk,
    });
  }

  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step1Id}:OUTPUT:STREAMING:END-->
<!--STEP:${step1Id}:END:completed-->

`,
  });

  // 步骤 2: 生成社交媒体文案
  const step2Id = 'social-media-content';
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step2Id}:START:running-->步骤 2/4: 生成社交媒体文案
正在创作简洁有趣的短文案...
<!--STEP:${step2Id}:INPUT-->
\`\`\`json
${JSON.stringify({ topic: prompt, platform: '社交媒体', targetLength: '300-600字', hasBackgroundInfo: searchResults.length > 0 }, null, 2)}
\`\`\`
<!--STEP:${step2Id}:INPUT:END-->

`,
  });

  const socialMediaAgent = mastra.getAgent('socialMediaAgent' as any);
  if (!socialMediaAgent) {
    throw new Error('socialMediaAgent 未找到');
  }
  
  // 只传递数据参数，让Agent的instructions发挥作用
  const contentStream = await socialMediaAgent.stream([{
    role: 'user',
    content: `主题：${prompt}\n\n背景信息：\n${searchResults || '暂无'}`,
  }]);

  let fullContent = '';
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step2Id}:OUTPUT:STREAMING-->`,
  });

  for await (const chunk of contentStream.textStream) {
    fullContent += chunk;
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: chunk,
    });
  }

  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step2Id}:OUTPUT:STREAMING:END-->\n<!--STEP:${step2Id}:END:completed-->\n\n`,
  });

  // 步骤 3: 规划配图方案
  const step3Id = 'image-planning';
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step3Id}:START:running-->步骤 3/4: 规划配图方案
正在分析文案，规划 2-4 张配图...
<!--STEP:${step3Id}:INPUT-->
\`\`\`json
{
  "contentLength": ${fullContent.length},
  "targetImages": "2-4张"
}
\`\`\`
<!--STEP:${step3Id}:INPUT:END-->

`,
  });

  const imagePromptAgent = mastra.getAgent('imagePromptAgent' as any);
  if (!imagePromptAgent) {
    throw new Error('imagePromptAgent 未找到');
  }

  // 使用流式输出，让用户看到生成过程
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step3Id}:OUTPUT:STREAMING-->`,
  });

  const promptStream = await imagePromptAgent.stream([{
    role: 'user',
    content: `文案内容：
${fullContent}

任务：为社交媒体规划2-4张配图（作为图集展示）`,
  }]);

  let fullPromptResponse = '';
  for await (const chunk of promptStream.textStream) {
    fullPromptResponse += chunk;
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: chunk,
    });
  }

  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step3Id}:OUTPUT:STREAMING:END-->\n<!--STEP:${step3Id}:END:completed-->\n\n`,
  });

  let imagePromptsData;
  try {
    const jsonMatch = fullPromptResponse.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      imagePromptsData = JSON.parse(jsonMatch[1]);
    } else {
      imagePromptsData = JSON.parse(fullPromptResponse || '{}');
    }
  } catch (e) {
    console.error('[Image Planning] Failed to parse response:', e);
    imagePromptsData = {
      images: [
        { order: 1, prompt: 'A vibrant social media image', aspectRatio: '1:1', description: '第1张图' },
        { order: 2, prompt: 'An engaging social media visual', aspectRatio: '1:1', description: '第2张图' }
      ]
    };
  }

  // 步骤 4: 批量生成图片
  const step4Id = 'image-generation';
  const imagePrompts = imagePromptsData.images || [];
  const generatedImages: Array<{order: number; url: string; proxyUrl: string; description: string}> = [];
  
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step4Id}:START:running-->步骤 4/4: 生成图片
准备生成 ${imagePrompts.length} 张图片...
<!--STEP:${step4Id}:INPUT-->
\`\`\`json
${JSON.stringify({ totalImages: imagePrompts.length }, null, 2)}
\`\`\`
<!--STEP:${step4Id}:INPUT:END-->

`,
  });

  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step4Id}:OUTPUT:STREAMING-->\n`,
  });

  try {
    const mcpClient = getMCPClient();
    const allTools = await mcpClient.getTools();
    const imageToolEntry = Object.entries(allTools).find(
      ([name]) => name.toLowerCase().includes('image')
    );

    if (!imageToolEntry) {
      writer.write({
        type: 'text-delta',
        id: textId,
        delta: `未找到图片生成工具\n`,
      });
    } else {
      const [toolName, imageTool] = imageToolEntry;
      
      for (let i = 0; i < imagePrompts.length; i++) {
        const imagePrompt = imagePrompts[i];
        writer.write({
          type: 'text-delta',
          id: textId,
          delta: `\n**[${i + 1}/${imagePrompts.length}] 图片 ${imagePrompt.order}** - ${imagePrompt.description}\n正在生成...\n`,
        });

        try {
          const toolArgs = { prompt: imagePrompt.prompt, aspect_ratio: imagePrompt.aspectRatio || '1:1' };
          const imageResult = await imageTool.execute({ context: toolArgs });
          
          let imageUrl = '';
          if (typeof imageResult === 'string') {
            imageUrl = imageResult;
          } else if (typeof imageResult === 'object' && imageResult !== null) {
            const result = imageResult as any;
            if (Array.isArray(result.content) && result.content.length > 0) {
              const firstContent = result.content[0];
              if (firstContent.type === 'text' && typeof firstContent.text === 'string') {
                try {
                  const parsedText = JSON.parse(firstContent.text);
                  if (Array.isArray(parsedText.results) && parsedText.results.length > 0) {
                    imageUrl = parsedText.results[0];
                  }
                } catch (e) { console.error(e); }
              }
            }
            if (!imageUrl && result.text && typeof result.text === 'string') {
              try {
                const parsedText = JSON.parse(result.text);
                if (Array.isArray(parsedText.results) && parsedText.results.length > 0) {
                  imageUrl = parsedText.results[0];
                }
              } catch (e) { console.error(e); }
            }
            if (!imageUrl) {
              imageUrl = result.url || result.imageUrl || result.image_url || result.data?.url || result.output?.url || '';
              if (Array.isArray(result.images) && result.images.length > 0) {
                imageUrl = result.images[0].url || result.images[0];
              }
              if (Array.isArray(result.results) && result.results.length > 0) {
                imageUrl = result.results[0];
              }
            }
          }
          
          const proxyUrl = imageUrl ? `/api/image-proxy?url=${encodeURIComponent(imageUrl)}` : '';
          if (proxyUrl) {
            generatedImages.push({ order: imagePrompt.order, url: imageUrl, proxyUrl: proxyUrl, description: imagePrompt.description });
            writer.write({ type: 'text-delta', id: textId, delta: `✅ 生成成功\n![图片${imagePrompt.order}](${proxyUrl})\n` });
          } else {
            writer.write({ type: 'text-delta', id: textId, delta: `❌ 未能提取图片 URL\n` });
          }
        } catch (error) {
          console.error(`[Image ${i + 1}] error:`, error);
          writer.write({ type: 'text-delta', id: textId, delta: `❌ 生成失败\n` });
        }
      }
      writer.write({ type: 'text-delta', id: textId, delta: `\n**生成结果**：成功 ${generatedImages.length}/${imagePrompts.length} 张\n` });
    }
  } catch (error) {
    writer.write({ type: 'text-delta', id: textId, delta: `图片生成失败\n` });
  }

  writer.write({ type: 'text-delta', id: textId, delta: `<!--STEP:${step4Id}:OUTPUT:STREAMING:END-->\n<!--STEP:${step4Id}:END:completed-->\n\n` });

  // 最终结果：文案 + 图集
  writer.write({ type: 'text-delta', id: textId, delta: '<!--FINAL_RESULT_START-->\n## 最终内容\n\n' });
  writer.write({ type: 'text-delta', id: textId, delta: fullContent + '\n\n' });

  if (generatedImages.length > 0) {
    writer.write({ type: 'text-delta', id: textId, delta: '---\n\n### 配图集\n\n' });
    for (const img of generatedImages) {
      writer.write({ type: 'text-delta', id: textId, delta: `![图片${img.order} - ${img.description}](${img.proxyUrl})\n\n` });
    }
  }
  
  writer.write({ type: 'text-delta', id: textId, delta: '\n<!--FINAL_RESULT_END-->' });
  
  console.log('[executeSocialMediaPostInStream] 执行完成');
}

/**
 * 在 stream 中执行文章创作工作流
 */
async function executeContentCreationWorkflowInStream(writer: any, textId: string, prompt: string) {
  console.log('[executeContentCreationWorkflowInStream] 开始执行');
  
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: '**开始执行内容创作工作流**\n\n',
  });

  writer.write({
    type: 'text-delta',
    id: textId,
    delta: '工作流包含 5 个步骤: 联网搜索 → 文案生成 → 图片提示词 → 图片生成 → 图文混合\n\n',
  });

  writer.write({
    type: 'text-delta',
    id: textId,
    delta: '---\n\n',
  });

  // 步骤 1: 联网搜索
  const step1Id = 'web-search';
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step1Id}:START:running-->步骤 1/5: 联网搜索
正在搜索相关信息...
<!--STEP:${step1Id}:INPUT-->
\`\`\`json
${JSON.stringify({ query: prompt, purpose: '自媒体内容创作' }, null, 2)}
\`\`\`
<!--STEP:${step1Id}:INPUT:END-->

`,
  });

  const webSearchAgent = mastra.getAgent('webSearchAgent' as any);
  if (!webSearchAgent) {
    throw new Error('webSearchAgent 未找到');
  }
  
  // Agent的instructions已包含所有业务逻辑，只需传递数据
  const searchStream = await webSearchAgent.stream([{
    role: 'user',
    content: `搜索主题: ${prompt}\n\n用途: 自媒体内容创作`,
  }]);
  
  let searchResults = '';
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step1Id}:OUTPUT:STREAMING-->`,
  });
  
  for await (const chunk of searchStream.textStream) {
    searchResults += chunk;
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: chunk,
    });
  }

  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step1Id}:OUTPUT:STREAMING:END-->
<!--STEP:${step1Id}:END:completed-->

`,
  });

  // 步骤 2: 文案生成
  const step2Id = 'content-creation';
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step2Id}:START:running-->步骤 2/5: 文案生成
AI 正在创作中...
<!--STEP:${step2Id}:INPUT-->
\`\`\`json
${JSON.stringify({ 
  topic: prompt, 
  platform: 'generic',
  wordCount: '2500-3000字',
  hasBackgroundInfo: searchResults.length > 0
}, null, 2)}
\`\`\`
<!--STEP:${step2Id}:INPUT:END-->

`,
  });

  const contentCreationAgent = mastra.getAgent('contentCreationAgent' as any);
  if (!contentCreationAgent) {
    throw new Error('contentCreationAgent 未找到');
  }
  
  // 只传递数据参数，让Agent的instructions发挥作用
  const contentStream = await contentCreationAgent.stream([{
    role: 'user',
    content: `写作主题：${prompt}

目标平台：generic

写作字数：1500-2500字

背景信息：
${searchResults || '暂无'}`,
  }]);

  let fullContent = '';
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step2Id}:OUTPUT:STREAMING-->`,
  });

  for await (const chunk of contentStream.textStream) {
    fullContent += chunk;
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: chunk,
    });
  }

  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step2Id}:OUTPUT:STREAMING:END-->
<!--STEP:${step2Id}:END:completed-->

`,
  });

  // 步骤 3: 分析文章结构并生成多个图片提示词
  const step3Id = 'image-prompt';
  const generatedImages: Array<{type: string; position: string; url: string; proxyUrl: string}> = [];
  
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step3Id}:START:running-->步骤 3/5: 分析文章结构并生成图片提示词
正在分析文章内容，规划配图方案...
<!--STEP:${step3Id}:INPUT-->
\`\`\`json
{
  "contentLength": ${fullContent.length},
  "platform": "generic",
  "imageNeeds": "封面图 + 内容配图"
}
\`\`\`
<!--STEP:${step3Id}:INPUT:END-->

`,
  });

  const imagePromptAgent = mastra.getAgent('imagePromptAgent' as any);
  if (!imagePromptAgent) {
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--STEP:${step3Id}:OUTPUT-->imagePromptAgent 未找到<!--STEP:${step3Id}:OUTPUT:END-->\n<!--STEP:${step3Id}:END:error-->\n\n`,
    });
  } else {
    // 使用流式输出，让用户看到生成过程
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--STEP:${step3Id}:OUTPUT:STREAMING-->`,
    });

    const promptStream = await imagePromptAgent.stream([{
      role: 'user',
      content: `文章内容：
${fullContent}

任务：分析文章结构，规划配图方案（封面图 + 0-3张内容配图）`,
    }]);

    let fullPromptResponse = '';
    for await (const chunk of promptStream.textStream) {
      fullPromptResponse += chunk;
      writer.write({
        type: 'text-delta',
        id: textId,
        delta: chunk,
      });
    }

    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--STEP:${step3Id}:OUTPUT:STREAMING:END-->
<!--STEP:${step3Id}:END:completed-->

`,
    });

    let imagePromptsData;
    try {
      const jsonMatch = fullPromptResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        imagePromptsData = JSON.parse(jsonMatch[1]);
      } else {
        imagePromptsData = JSON.parse(fullPromptResponse || '{}');
      }
    } catch (e) {
      console.error('[Image Prompt] Failed to parse response:', e);
      imagePromptsData = {
        images: [
          {
            type: 'cover',
            position: '封面',
            prompt: 'A professional article cover image',
            aspectRatio: '16:9',
            description: '文章封面图'
          }
        ]
      };
    }

    // 步骤 4: 批量生成图片
    const step4Id = 'image-generation';
    const imagePrompts = imagePromptsData.images || [];
    
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--STEP:${step4Id}:START:running-->步骤 4/5: 生成图片
准备生成 ${imagePrompts.length} 张图片...
<!--STEP:${step4Id}:INPUT-->
\`\`\`json
${JSON.stringify({ totalImages: imagePrompts.length, images: imagePrompts.map(img => ({ type: img.type, position: img.position, aspectRatio: img.aspectRatio })) }, null, 2)}
\`\`\`
<!--STEP:${step4Id}:INPUT:END-->

`,
    });

    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--STEP:${step4Id}:OUTPUT:STREAMING-->\n`,
    });

    try {
      const mcpClient = getMCPClient();
      const allTools = await mcpClient.getTools();
      const imageToolEntry = Object.entries(allTools).find(
        ([name]) => name.toLowerCase().includes('image')
      );

      if (!imageToolEntry) {
        writer.write({
          type: 'text-delta',
          id: textId,
          delta: `未找到图片生成工具\n`,
        });
      } else {
        const [toolName, imageTool] = imageToolEntry;
        
        for (let i = 0; i < imagePrompts.length; i++) {
          const imagePrompt = imagePrompts[i];
          writer.write({
            type: 'text-delta',
            id: textId,
            delta: `\n**[${i + 1}/${imagePrompts.length}] ${imagePrompt.type === 'cover' ? '封面图' : '内容配图'}** (${imagePrompt.position})\n正在生成...\n`,
          });

          try {
            const toolArgs = {
              prompt: imagePrompt.prompt,
              aspect_ratio: imagePrompt.aspectRatio || '1:1',
            };
            const imageResult = await imageTool.execute({ context: toolArgs });
            
            let imageUrl = '';
            
            if (typeof imageResult === 'string') {
              imageUrl = imageResult;
            } else if (typeof imageResult === 'object' && imageResult !== null) {
              const result = imageResult as any;
              
              if (Array.isArray(result.content) && result.content.length > 0) {
                const firstContent = result.content[0];
                if (firstContent.type === 'text' && typeof firstContent.text === 'string') {
                  const textContent = firstContent.text.trim();
                  
                  if (textContent.startsWith('Error') || textContent.startsWith('error') || textContent.startsWith('ERROR')) {
                    console.error('[Image Generation] Error response from tool:', textContent);
                    throw new Error(`图片生成工具返回错误: ${textContent.substring(0, 100)}`);
                  }
                  
                  try {
                    const parsedText = JSON.parse(textContent);
                    if (Array.isArray(parsedText.results) && parsedText.results.length > 0) {
                      imageUrl = parsedText.results[0];
                    }
                  } catch (e) {
                    if (textContent.startsWith('http://') || textContent.startsWith('https://')) {
                      imageUrl = textContent;
                    }
                  }
                }
              }
              
              if (!imageUrl && result.text && typeof result.text === 'string') {
                const textContent = result.text.trim();
                
                if (textContent.startsWith('Error') || textContent.startsWith('error') || textContent.startsWith('ERROR')) {
                  console.error('[Image Generation] Error response from tool:', textContent);
                  throw new Error(`图片生成工具返回错误: ${textContent.substring(0, 100)}`);
                }
                
                try {
                  const parsedText = JSON.parse(textContent);
                  if (Array.isArray(parsedText.results) && parsedText.results.length > 0) {
                    imageUrl = parsedText.results[0];
                  }
                } catch (e) {
                  if (textContent.startsWith('http://') || textContent.startsWith('https://')) {
                    imageUrl = textContent;
                  }
                }
              }
              
              if (!imageUrl) {
                imageUrl = result.url || result.imageUrl || result.image_url || 
                          result.data?.url || result.output?.url || '';
                
                if (Array.isArray(result.images) && result.images.length > 0) {
                  imageUrl = result.images[0].url || result.images[0];
                }
                
                if (Array.isArray(result.results) && result.results.length > 0) {
                  imageUrl = result.results[0];
                }
              }
            }
            
            const proxyUrl = imageUrl ? `/api/image-proxy?url=${encodeURIComponent(imageUrl)}` : '';
            
            if (proxyUrl) {
              generatedImages.push({
                type: imagePrompt.type,
                position: imagePrompt.position,
                url: imageUrl,
                proxyUrl: proxyUrl
              });
              
              writer.write({
                type: 'text-delta',
                id: textId,
                delta: `生成成功\n![${imagePrompt.type === 'cover' ? '封面图' : '配图'}](${proxyUrl})\n`,
              });
            } else {
              writer.write({
                type: 'text-delta',
                id: textId,
                delta: `❌ 未能提取图片 URL\n`,
              });
            }
          } catch (error) {
            console.error(`[Image ${i + 1}] Generation error:`, error);
            writer.write({
              type: 'text-delta',
              id: textId,
              delta: `❌ 生成失败: ${error instanceof Error ? error.message : '未知错误'}\n`,
            });
          }
        }
        
        writer.write({
          type: 'text-delta',
          id: textId,
          delta: `\n**生成结果**：成功 ${generatedImages.length}/${imagePrompts.length} 张\n`,
        });
      }
    } catch (error) {
      console.error('Image generation error:', error);
      writer.write({
        type: 'text-delta',
        id: textId,
        delta: `图片生成失败: ${error instanceof Error ? error.message : '未知错误'}\n`,
      });
    }

    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--STEP:${step4Id}:OUTPUT:STREAMING:END-->\n<!--STEP:${step4Id}:END:completed-->\n\n`,
    });
  }

  // 步骤 5: 图文混合（生成最终结果）
  const step5Id = 'content-mix';
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step5Id}:START:running-->步骤 5/5: 图文混合
正在整合文章内容与图片...
<!--STEP:${step5Id}:INPUT-->
\`\`\`json
{
  "contentLength": ${fullContent.length},
  "totalImages": ${generatedImages.length},
  "coverImage": ${generatedImages.some(img => img.type === 'cover')},
  "contentImages": ${generatedImages.filter(img => img.type === 'content').length}
}
\`\`\`
<!--STEP:${step5Id}:INPUT:END-->

`,
  });

  // 调用 contentMixAgent 生成最终内容
  const contentMixAgent = mastra.getAgent('contentMixAgent' as any);
  if (!contentMixAgent) {
    // 降级方案：手动组装图文
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--STEP:${step5Id}:OUTPUT-->contentMixAgent 未找到，使用默认组装方式<!--STEP:${step5Id}:OUTPUT:END-->\n<!--STEP:${step5Id}:END:completed-->\n\n`,
    });
    
    // 手动组装：封面图 + 文章内容 + 内容配图
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: '<!--FINAL_RESULT_START-->\n## 最终内容\n\n',
    });
    
    // 封面图
    const coverImage = generatedImages.find(img => img.type === 'cover');
    if (coverImage) {
      writer.write({
        type: 'text-delta',
        id: textId,
        delta: `![封面图](${coverImage.proxyUrl})

---

`,
      });
    }
    
    // 文章内容
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: fullContent,
    });
    
    // 内容配图
    const contentImages = generatedImages.filter(img => img.type === 'content');
    if (contentImages.length > 0) {
      writer.write({
        type: 'text-delta',
        id: textId,
        delta: '\n\n---\n\n### 相关图片\n\n',
      });
      for (const img of contentImages) {
        writer.write({
          type: 'text-delta',
          id: textId,
          delta: `![${img.position}](${img.proxyUrl})\n\n`,
        });
      }
    }
    
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: '\n<!--FINAL_RESULT_END-->',
    });
  } else {
    // 如果 contentMixAgent 存在，使用它来生成最终内容
    try {
      // 只传递数据参数，让Agent的instructions发挥作用
      const mixStream = await contentMixAgent.stream([{
        role: 'user',
        content: `文章内容：
${fullContent}

可用图片：
${generatedImages.map((img, i) => `${i + 1}. ${img.type === 'cover' ? '封面图' : img.position} - ![${img.type}](${img.proxyUrl})`).join('\n')}`,
      }]);

      writer.write({
        type: 'text-delta',
        id: textId,
        delta: `<!--STEP:${step5Id}:OUTPUT:STREAMING-->`,
      });

      let mixedContent = '';
      for await (const chunk of mixStream.textStream) {
        mixedContent += chunk;
        writer.write({
          type: 'text-delta',
          id: textId,
          delta: chunk,
        });
      }

      writer.write({
        type: 'text-delta',
        id: textId,
        delta: `<!--STEP:${step5Id}:OUTPUT:STREAMING:END-->\n<!--STEP:${step5Id}:END:completed-->\n\n`,
      });

      // 输出最终结果
      writer.write({
        type: 'text-delta',
        id: textId,
        delta: `<!--FINAL_RESULT_START-->
## 最终内容

${mixedContent}
<!--FINAL_RESULT_END-->`,
      });
    } catch (error) {
      console.error('[contentMix] Error:', error);
      // 错误时降级为手动组装
      writer.write({
        type: 'text-delta',
        id: textId,
        delta: `<!--STEP:${step5Id}:OUTPUT-->contentMixAgent 执行失败，使用默认组装方式<!--STEP:${step5Id}:OUTPUT:END-->\n<!--STEP:${step5Id}:END:completed-->\n\n`,
      });
      
      // 手动组装
      writer.write({
        type: 'text-delta',
        id: textId,
        delta: '<!--FINAL_RESULT_START-->\n## 最终内容\n\n',
      });
      
      const coverImage = generatedImages.find(img => img.type === 'cover');
      if (coverImage) {
        writer.write({
          type: 'text-delta',
          id: textId,
          delta: `![封面图](${coverImage.proxyUrl})

---

`,
        });
      }
      
      writer.write({
        type: 'text-delta',
        id: textId,
        delta: fullContent,
      });
      
      const contentImages = generatedImages.filter(img => img.type === 'content');
      if (contentImages.length > 0) {
        writer.write({
          type: 'text-delta',
          id: textId,
          delta: '\n\n---\n\n### 相关图片\n\n',
        });
        for (const img of contentImages) {
          writer.write({
            type: 'text-delta',
            id: textId,
            delta: `![${img.position}](${img.proxyUrl})\n\n`,
          });
        }
      }
      
      writer.write({
        type: 'text-delta',
        id: textId,
        delta: '\n<!--FINAL_RESULT_END-->',
      });
    }
  }
  
  console.log('[executeContentCreationWorkflowInStream] 执行完成');
}



