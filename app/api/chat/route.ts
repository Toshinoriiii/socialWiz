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
    useWorkflow = true, // 默认使用工作流
  }: { 
    messages: UIMessage[];
    useWorkflow?: boolean;
  } = body;

  console.log('useWorkflow:', useWorkflow);
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
    if (useWorkflow) {
      console.log('>>> 准备执行 executeContentCreationWorkflow');
      // 使用内容创作工作流
      return await executeContentCreationWorkflow(messages, userPrompt);
    } else {
      // 使用普通 Agent 对话（保留原有功能）
      return await executeAgentChat(messages);
    }
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
 * 执行内容创作工作流（使用 Agent 流式输出）
 */
async function executeContentCreationWorkflow(messages: UIMessage[], prompt: string) {
  console.log('[executeContentCreationWorkflow] 函数被调用');
  console.log('[executeContentCreationWorkflow] prompt:', prompt);

  const textId = `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log('[executeContentCreationWorkflow] textId:', textId);
  
  console.log('[executeContentCreationWorkflow] Creating stream...');
  
  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      console.log('[Stream Execute] Callback started!');
      
      try {
        // 开始文本块
        console.log('[Stream Execute] Writing text-start...');
        writer.write({ type: 'text-start', id: textId });
        
        // 显示开始提示
        writer.write({
          type: 'text-delta',
          id: textId,
          delta: '🚀 **开始执行内容创作工作流**\n\n',
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
          delta: `<!--STEP:${step1Id}:START:running-->🔍 **步骤 1/5: 联网搜索**
⏳ 正在搜索相关信息...
<!--STEP:${step1Id}:INPUT-->
\`\`\`json
${JSON.stringify({ query: prompt, purpose: '自媒体内容创作' }, null, 2)}
\`\`\`
<!--STEP:${step1Id}:INPUT:END-->

`,
        });

        console.log('[Workflow] Getting webSearchAgent...');
        const webSearchAgent = mastra.getAgent('webSearchAgent' as any);
        console.log('[Workflow] webSearchAgent:', webSearchAgent ? 'found' : 'NOT FOUND');
        
        if (!webSearchAgent) {
          throw new Error('webSearchAgent 未找到');
        }
        
        // 检查工具是否已加载
        try {
          const mcpClient = getMCPClient();
          const allTools = await mcpClient.getTools();
          const toolNames = Object.keys(allTools);
          console.log('[Workflow] MCP Tools available:', toolNames);
          console.log('[Workflow] MCP Tools count:', toolNames.length);
          
          // 打印每个工具的详细信息
          for (const [name, tool] of Object.entries(allTools)) {
            console.log(`[Workflow] Tool "${name}":`, {
              hasExecute: typeof tool.execute === 'function',
              toolType: typeof tool
            });
          }
        } catch (error) {
          console.error('[Workflow] Failed to load MCP tools:', error);
        }
        
        console.log('[Workflow] Calling webSearchAgent.stream...');
        // 使用流式生成
        const searchStream = await webSearchAgent.stream([{
          role: 'user',
          content: `请搜索关于"${prompt}"的最新信息和热点内容，用于自媒体内容创作。`,
        }]);
        
        let searchResults = '';
        writer.write({
          type: 'text-delta',
          id: textId,
          delta: `<!--STEP:${step1Id}:OUTPUT:STREAMING-->`,
        });
        
        // 实时流式输出搜索结果
        for await (const chunk of searchStream.textStream) {
          searchResults += chunk;
          writer.write({
            type: 'text-delta',
            id: textId,
            delta: chunk,
          });
        }
        console.log('[Workflow] Search completed, response length:', searchResults.length);

        writer.write({
          type: 'text-delta',
          id: textId,
          delta: `<!--STEP:${step1Id}:OUTPUT:STREAMING:END-->
<!--STEP:${step1Id}:END:completed-->

`,
        });

        // 步骤 2: 文案生成（使用流式输出）
        const step2Id = 'content-creation';
        writer.write({
          type: 'text-delta',
          id: textId,
          delta: `<!--STEP:${step2Id}:START:running-->✍️ **步骤 2/5: 文案生成**
⏳ AI 正在创作中...
<!--STEP:${step2Id}:INPUT-->
\`\`\`json
${JSON.stringify({ 
  topic: prompt, 
  platform: 'generic',
  wordCount: '800-1200字',
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
        
        const contentPrompt = `
## 本次创作任务

**写作主题**: ${prompt}

**目标平台**: generic

**写作字数**: 800-1200字（默认）

**背景信息**: 
${searchResults || '暂无（仅基于用户输入的主题进行创作）'}

请按照你的专业标准，创作一篇高质量的自媒体文案。记住：
1. 先生成5个备选标题（问句/反问形式）
2. 以钩子开头，第一人称"我"的视角
3. 情感充沛，细节丰富
4. 末尾添加4-5个SEO关键词标签
5. 使用Markdown格式输出
`;

        console.log('[Workflow] Calling contentCreationAgent.stream...');
        // 使用 Agent 的流式生成
        const contentStream = await contentCreationAgent.stream([{
          role: 'user',
          content: contentPrompt,
        }]);

        let fullContent = '';
        writer.write({
          type: 'text-delta',
          id: textId,
          delta: `<!--STEP:${step2Id}:OUTPUT:STREAMING-->`,
        });

        // 实时流式输出文案内容
        console.log('[Workflow] Starting to stream content...');
        for await (const chunk of contentStream.textStream) {
          fullContent += chunk;
          writer.write({
            type: 'text-delta',
            id: textId,
            delta: chunk,
          });
        }
        console.log('[Workflow] Content streaming completed, length:', fullContent.length);

        writer.write({
          type: 'text-delta',
          id: textId,
          delta: `<!--STEP:${step2Id}:OUTPUT:STREAMING:END-->
<!--STEP:${step2Id}:END:completed-->

`,
        });

        // 步骤 3: 图片提示词
        const step3Id = 'image-prompt';
        writer.write({
          type: 'text-delta',
          id: textId,
          delta: `<!--STEP:${step3Id}:START:running-->🎨 **步骤 3/5: 生成图片提示词**
⏳ 正在生成...
<!--STEP:${step3Id}:INPUT-->
\`\`\`json
{
  "content": ${JSON.stringify(fullContent.substring(0, 500))},
  "platform": "generic",
  "aspectRatio": "1:1"
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
            delta: `<!--STEP:${step3Id}:OUTPUT-->⚠️ imagePromptAgent 未找到<!--STEP:${step3Id}:OUTPUT:END-->\n<!--STEP:${step3Id}:END:error-->\n\n`,
          });
        } else {
          const promptRequest = `
请为以下文案生成适合的英文图片提示词：

文案摘要：
${fullContent.substring(0, 500)}...

目标平台：generic
宽高比：1:1

请输出 JSON 格式：
{
  "prompt": "详细的英文图片描述提示词",
  "aspectRatio": "1:1"
}
`;

          const promptResponse = await imagePromptAgent.generate(promptRequest);
          let imagePromptData;
          try {
            imagePromptData = JSON.parse(promptResponse.text || '{}');
          } catch {
            imagePromptData = { prompt: promptResponse.text || 'A social media post image', aspectRatio: '1:1' };
          }

          writer.write({
            type: 'text-delta',
            id: textId,
            delta: `<!--STEP:${step3Id}:OUTPUT-->
\`\`\`json
${JSON.stringify(imagePromptData, null, 2)}
\`\`\`
<!--STEP:${step3Id}:OUTPUT:END-->
<!--STEP:${step3Id}:END:completed-->

`,
          });

          // 步骤 4: 图片生成
          const step4Id = 'image-generation';
          writer.write({
            type: 'text-delta',
            id: textId,
            delta: `<!--STEP:${step4Id}:START:running-->🖼️ **步骤 4/5: 生成图片**
⏳ 正在调用图片生成服务...
<!--STEP:${step4Id}:INPUT-->
\`\`\`json
${JSON.stringify({ prompt: imagePromptData.prompt, aspect_ratio: imagePromptData.aspectRatio }, null, 2)}
\`\`\`
<!--STEP:${step4Id}:INPUT:END-->

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
              
              console.log('[Image Generation] Full Result:', JSON.stringify(imageResult, null, 2));
              console.log('[Image Generation] Result type:', typeof imageResult);
              console.log('[Image Generation] Is Array:', Array.isArray(imageResult));
              
              // 提取图片 URL
              let imageUrl = '';
              
              if (typeof imageResult === 'string') {
                // 直接返回字符串 URL
                imageUrl = imageResult;
              } else if (typeof imageResult === 'object' && imageResult !== null) {
                const result = imageResult as any;
                
                // 打印所有字段名
                console.log('[Image Generation] Available keys:', Object.keys(result));
                
                // 处理 MCP 工具返回的 { content: [{ type: 'text', text: '...' }] } 格式
                if (Array.isArray(result.content) && result.content.length > 0) {
                  const firstContent = result.content[0];
                  if (firstContent.type === 'text' && typeof firstContent.text === 'string') {
                    try {
                      const parsedText = JSON.parse(firstContent.text);
                      console.log('[Image Generation] Parsed text from content:', parsedText);
                      
                      // 从 results 数组中提取第一个 URL
                      if (Array.isArray(parsedText.results) && parsedText.results.length > 0) {
                        imageUrl = parsedText.results[0];
                        console.log('[Image Generation] Extracted from results array:', imageUrl);
                      }
                    } catch (e) {
                      console.error('[Image Generation] Failed to parse text field:', e);
                    }
                  }
                }
                
                // 备用：处理直接的 { text: "..." } 格式
                if (!imageUrl && result.text && typeof result.text === 'string') {
                  try {
                    const parsedText = JSON.parse(result.text);
                    console.log('[Image Generation] Parsed text:', parsedText);
                    
                    // 从 results 数组中提取第一个 URL
                    if (Array.isArray(parsedText.results) && parsedText.results.length > 0) {
                      imageUrl = parsedText.results[0];
                      console.log('[Image Generation] Extracted from results array:', imageUrl);
                    }
                  } catch (e) {
                    console.error('[Image Generation] Failed to parse text field:', e);
                  }
                }
                
                // 如果还没有找到，尝试其他字段
                if (!imageUrl) {
                  imageUrl = result.url || result.imageUrl || result.image_url || 
                            result.data?.url || result.output?.url || '';
                  
                  // 如果是数组，取第一个
                  if (Array.isArray(result.images) && result.images.length > 0) {
                    imageUrl = result.images[0].url || result.images[0];
                  }
                  
                  if (Array.isArray(result.results) && result.results.length > 0) {
                    imageUrl = result.results[0];
                  }
                }
              }
              
              console.log('[Image Generation] Extracted URL:', imageUrl);
              
              // 生成代理 URL
              const proxyUrl = imageUrl ? `/api/image-proxy?url=${encodeURIComponent(imageUrl)}` : '';
              
              // 最终检查：输出前再次验证
              console.log('[Image Generation] Before writer.write:', {
                imageUrl,
                imageUrlLength: imageUrl.length,
                proxyUrl,
                proxyUrlLength: proxyUrl.length
              });
              
              writer.write({
                type: 'text-delta',
                id: textId,
                delta: `<!--STEP:${step4Id}:OUTPUT-->
**图片生成结果**：
\`\`\`json
${JSON.stringify({ 
  success: true,
  originalUrl: imageUrl,
  proxyUrl: proxyUrl
}, null, 2)}
\`\`\`

**生成的图片**：

${proxyUrl ? `![\u751f\u6210\u7684\u56fe\u7247](${proxyUrl})` : '⚠️ 未\u80fd\u63d0\u53d6\u56fe\u7247 URL'}

<!--STEP:${step4Id}:OUTPUT:END-->
<!--STEP:${step4Id}:END:completed-->

`,
              });
            } else {
              writer.write({
                type: 'text-delta',
                id: textId,
                delta: `<!--STEP:${step4Id}:OUTPUT-->⚠️ 未找到图片生成工具<!--STEP:${step4Id}:OUTPUT:END-->\n<!--STEP:${step4Id}:END:error-->\n\n`,
              });
            }
          } catch (error) {
            console.error('Image generation error:', error);
            writer.write({
              type: 'text-delta',
              id: textId,
              delta: `<!--STEP:${step4Id}:OUTPUT-->⚠️ 图片生成失败: ${error instanceof Error ? error.message : '未知错误'}<!--STEP:${step4Id}:OUTPUT:END-->\n<!--STEP:${step4Id}:END:error-->\n\n`,
            });
          }
        }

        // 步骤 5: 图文混合（生成最终结果）
        const step5Id = 'content-mix';
        writer.write({
          type: 'text-delta',
          id: textId,
          delta: `<!--STEP:${step5Id}:START:running-->🎉 **步骤 5/5: 图文混合**
⏳ 正在整合最终内容...
<!--STEP:${step5Id}:INPUT-->
\`\`\`text
文案字数: ${fullContent.length} 字
\`\`\`
<!--STEP:${step5Id}:INPUT:END-->

`,
        });

        // 调用 contentMixAgent 生成最终内容
        const contentMixAgent = mastra.getAgent('contentMixAgent' as any);
        if (!contentMixAgent) {
          writer.write({
            type: 'text-delta',
            id: textId,
            delta: `<!--STEP:${step5Id}:OUTPUT-->⚠️ contentMixAgent 未找到，直接输出原始文案<!--STEP:${step5Id}:OUTPUT:END-->\n<!--STEP:${step5Id}:END:completed-->\n\n`,
          });
          
          // 直接输出原始文案作为最终结果
          writer.write({
            type: 'text-delta',
            id: textId,
            delta: '<!--FINAL_RESULT_START-->\n## 📝 最终内容\n\n',
          });
          
          writer.write({
            type: 'text-delta',
            id: textId,
            delta: fullContent,
          });
          
          writer.write({
            type: 'text-delta',
            id: textId,
            delta: '\n<!--FINAL_RESULT_END-->',
          });
        } else {
          const mixPrompt = `
请将以下文案进行最终整合和美化，生成适合发布的完整版本：

${fullContent}

请保持Markdown格式，并确保内容的连贯性和可读性。
`;

          console.log('[Workflow] Step 5: Starting content mix...');
          console.log('[Workflow] Step 5: Input content length:', fullContent.length);

          try {
            const mixResponse = await contentMixAgent.stream([{
              role: 'user',
              content: mixPrompt,
            }]);
            
            let finalContent = '';
            writer.write({
              type: 'text-delta',
              id: textId,
              delta: `<!--STEP:${step5Id}:OUTPUT:STREAMING-->`,
            });
            
            // 实时流式输出最终内容
            for await (const chunk of mixResponse.textStream) {
              finalContent += chunk;
              writer.write({
                type: 'text-delta',
                id: textId,
                delta: chunk,
              });
            }
            
            console.log('[Workflow] Step 5: Content mix completed, length:', finalContent.length);
            console.log('[Workflow] Step 5: Final content preview:', finalContent.substring(0, 200));

            writer.write({
              type: 'text-delta',
              id: textId,
              delta: `<!--STEP:${step5Id}:OUTPUT:STREAMING:END-->
<!--STEP:${step5Id}:END:completed-->

`,
            });

            // 输出最终结果
            writer.write({
              type: 'text-delta',
              id: textId,
              delta: '<!--FINAL_RESULT_START-->\n## 📝 最终内容\n\n',
            });

            writer.write({
              type: 'text-delta',
              id: textId,
              delta: finalContent,
            });
            
            writer.write({
              type: 'text-delta',
              id: textId,
              delta: '\n<!--FINAL_RESULT_END-->',
            });
          } catch (error) {
            console.error('Content mix error:', error);
            writer.write({
              type: 'text-delta',
              id: textId,
              delta: `<!--STEP:${step5Id}:OUTPUT-->⚠️ 图文混合失败: ${error instanceof Error ? error.message : '未知错误'}<!--STEP:${step5Id}:OUTPUT:END-->\n<!--STEP:${step5Id}:END:error-->\n\n`,
            });
            
            writer.write({
              type: 'text-delta',
              id: textId,
              delta: '<!--FINAL_RESULT_START-->\n## 📝 最终内容\n\n',
            });
            
            writer.write({
              type: 'text-delta',
              id: textId,
              delta: fullContent,
            });
            
            writer.write({
              type: 'text-delta',
              id: textId,
              delta: '\n<!--FINAL_RESULT_END-->',
            });
          }
        }

        // 结束文本块
        writer.write({ type: 'text-end', id: textId });
        
        console.log('[Stream Execute] Callback completed!');
      } catch (error: any) {
        console.error('[Stream Execute] Error:', error);
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
  
  console.log('[executeContentCreationWorkflow] Stream created, returning response...');
  return createUIMessageStreamResponse({ stream });
}

/**
 * 执行普通 Agent 对话（原有功能）
 */
async function executeAgentChat(messages: UIMessage[]) {
  const agent = mastra.getAgent('webSearchAgent' as any);
  if (!agent) {
    throw new Error('Web Search Agent 不存在');
  }

  // 转换消息格式
  const agentMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  
  for (const msg of messages) {
    const textParts = msg.parts?.filter((part: any) => part.type === 'text') || [];
    if (textParts.length > 0) {
      const content = textParts.map((part: any) => {
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

  const textId = `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      try {
        writer.write({
          type: 'text-start',
          id: textId,
        });
        
        for await (const chunk of agentResponse.textStream) {
          writer.write({
            type: 'text-delta',
            id: textId,
            delta: chunk,
          });
        }

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
}