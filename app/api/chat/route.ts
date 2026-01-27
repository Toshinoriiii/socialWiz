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
    resumeWorkflow, // 新增: 是否是 resume 模式
  }: { 
    messages: UIMessage[];
    resumeWorkflow?: {
      runId: string;
      stepId: string;
      resumeData: any;
    };
  } = body;

  console.log('messages count:', messages?.length);
  console.log('resumeWorkflow:', resumeWorkflow);

  // 如果是 resume 模式，直接执行 resume
  if (resumeWorkflow) {
    return handleWorkflowResume(resumeWorkflow, messages);
  }

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
 * 处理工作流 resume
 */
async function handleWorkflowResume(
  resumeInfo: { runId: string; stepId: string; resumeData: any },
  messages: UIMessage[]
) {
  console.log('[handleWorkflowResume] 开始 resume 工作流:', resumeInfo);

  try {
    // 创建流式响应
    const textId = `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const stream = createUIMessageStream({
      originalMessages: messages,
      execute: async ({ writer }) => {
        try {
          writer.write({ type: 'text-start', id: textId });
          
          writer.write({
            type: 'text-delta',
            id: textId,
            delta: '**继续执行工作流...**\n\n',
          });

          // 从内存中获取之前保存的数据
          const runData = global.workflowRunData?.[resumeInfo.runId];
          if (!runData) {
            throw new Error('无法找到工作流数据，请重新开始');
          }

          const { workflowType, prompt, searchResults, fullContent } = runData;
          const { needImages } = resumeInfo.resumeData;

          console.log('[handleWorkflowResume] 工作流类型:', workflowType);
          console.log('[handleWorkflowResume] 用户选择:', needImages ? '需要配图' : '不需要配图');
          
          // 输出意图识别标记（供前端提取 workflowType）
          // 注意：前端正则匹配 intent 这个词（英文），所以必须包含 "intent" 关键字
          writer.write({
            type: 'text-delta',
            id: textId,
            delta: `<!--INTENT_RECOGNITION_START-->**intent**: \`${workflowType}\`  
**类型**: ${workflowType === 'social-media-post' ? '社交媒体图文' : '文章创作'}<!--INTENT_RECOGNITION_END-->\n\n`,
          });

          // 根据工作流类型分发处理
          if (workflowType === 'social-media-post') {
            await handleSocialMediaResume(writer, textId, needImages, fullContent);
          } else {
            // content-creation 工作流
            await handleContentCreationResume(writer, textId, needImages, prompt, searchResults, fullContent);
          }

          // 清理已使用的数据
          if (global.workflowRunData) {
            delete global.workflowRunData[resumeInfo.runId];
          }
        } catch (error: any) {
          console.error('[handleWorkflowResume] 错误:', error);
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
    console.error('[handleWorkflowResume] API 错误:', error);
    return new Response(
      JSON.stringify({ 
        error: `Resume 失败: ${error.message}`,
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
 * 使用 imageGenerationAgent 生成图片
 */
async function generateImageWithAgent(
  prompt: string,
  size: string = '1024*1024'
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const imageAgent = mastra.getAgent('imageGenerationAgent' as any);
    if (!imageAgent) {
      return { success: false, error: '图片生成 Agent 未找到' };
    }

    const agentPrompt = `**图片提示词**: ${prompt}

**尺寸**: ${size}

**数量**: 1`;
    
    console.log('[generateImageWithAgent] 调用 imageGenerationAgent');
    const result = await imageAgent.generate([{
      role: 'user',
      content: agentPrompt,
    }]);

    console.log('[generateImageWithAgent] Agent 返回:', result);
    
    // 解析 Agent 返回的结果
    const responseText = result.text || '';
    
    // 尝试从 JSON 格式提取
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*"success"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.success && parsed.images && parsed.images.length > 0) {
          return { success: true, url: parsed.images[0].url };
        } else if (!parsed.success) {
          return { success: false, error: parsed.error || '生成失败' };
        }
      }
    } catch (e) {
      console.warn('[generateImageWithAgent] JSON 解析失败，尝试其他方式');
    }
    
    // 尝试直接提取 URL
    const urlMatch = responseText.match(/https?:\/\/[^\s"\)]+/);
    if (urlMatch) {
      return { success: true, url: urlMatch[0] };
    }
    
    return { success: false, error: '未能提取图片 URL' };
  } catch (error) {
    console.error('[generateImageWithAgent] 错误:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '生成失败' 
    };
  }
}

/**
 * 处理社交媒体内容工作流的 Resume
 */
async function handleSocialMediaResume(
  writer: any,
  textId: string,
  needImages: boolean,
  fullContent: string
) {
  if (!needImages) {
    // 用户选择不需要配图，使用格式化 Agent 清理文案
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: '✅ 用户选择不需要配图\n\n',
    });

    // 步骤 3: 内容格式化
    const step3Id = 'content-formatting';
    console.log('[handleSocialMediaResume] 步骤 3: 开始内容格式化（无配图）');
    
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--STEP:${step3Id}:START:running-->步骤 3/3: 内容格式化
AI 正在整理最终输出格式...
<!--STEP:${step3Id}:INPUT-->
\`\`\`json
${JSON.stringify({ 
        contentLength: fullContent.length,
        imagesCount: 0 
      }, null, 2)}
\`\`\`
<!--STEP:${step3Id}:INPUT:END-->

`,
    });
    
    const contentFormatterAgent = mastra.getAgent('contentFormatterAgent' as any);
    if (!contentFormatterAgent) {
      throw new Error('contentFormatterAgent 未找到');
    }
    
    // 构造格式化 Agent 的输入
    const formatterInput = `请格式化以下社交媒体文案，去除所有格式标签和Markdown语法，直接输出纯文本内容（不包含#、**、-、![]()等任何Markdown标记，但保留行尾或单独一行的#标签）。

**重要要求**：
1. 第一行必须是标题（提取原文标题或第一段的前30-50字作为标题）
2. 标题后必须有一个空行
3. 然后输出正文内容
4. **必须删除"配图建议"部分**：如果原文案中包含"配图建议"或"**配图建议**"这个部分，必须完全删除，包括该部分的所有内容
5. **保留#标签**：行尾或单独一行的#标签（如 #打工人必备）必须保留

文案内容：\n${fullContent}`;
    
    // 调用格式化 Agent（流式输出）
    writer.write({ type: 'text-delta', id: textId, delta: `<!--STEP:${step3Id}:OUTPUT:STREAMING-->` });
    
    const formatterStream = await contentFormatterAgent.stream([{
      role: 'user',
      content: formatterInput,
    }]);
    
    let formattedContent = '';
    for await (const chunk of formatterStream.textStream) {
      formattedContent += chunk;
      writer.write({ type: 'text-delta', id: textId, delta: chunk });
    }
    
    writer.write({ type: 'text-delta', id: textId, delta: `<!--STEP:${step3Id}:OUTPUT:STREAMING:END-->\n<!--STEP:${step3Id}:END:completed-->\n\n` });
    
    console.log('[handleSocialMediaResume] 格式化完成（无配图），内容长度:', formattedContent.length);
    
    // 最终结果：使用格式化后的内容
    writer.write({ type: 'text-delta', id: textId, delta: '<!--FINAL_RESULT_START-->\n' });
    writer.write({ type: 'text-delta', id: textId, delta: formattedContent });
    writer.write({ type: 'text-delta', id: textId, delta: '\n<!--FINAL_RESULT_END-->' });

    writer.write({ type: 'text-end', id: textId });
    console.log('[handleSocialMediaResume] 不需要配图，文案格式化完成');
  } else {
    // 用户选择需要配图，执行配图流程
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: '✅ 用户选择需要配图\n\n',
    });

    // 步骤 3: 图片提示词生成
    const step3Id = 'image-prompt-generation';
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--STEP:${step3Id}:START:running-->步骤 3/4: 图片提示词生成
AI 正在分析文案，生成配图方案...
<!--STEP:${step3Id}:INPUT-->
\`\`\`json
${JSON.stringify({ content: fullContent.substring(0, 500) + '...', targetImages: '2-4张' }, null, 2)}
\`\`\`
<!--STEP:${step3Id}:INPUT:END-->

`,
    });

    const imagePromptAgent = mastra.getAgent('imagePromptAgent' as any);
    if (!imagePromptAgent) {
      throw new Error('imagePromptAgent 未找到');
    }

    const imagePromptStream = await imagePromptAgent.stream([{
      role: 'user',
      content: `文案内容：\n${fullContent}\n\n任务：为社交媒体规划2-4张配图（作为图集展示）`,
    }]);

    let imagePromptsText = '';
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--STEP:${step3Id}:OUTPUT:STREAMING-->`,
    });

    for await (const chunk of imagePromptStream.textStream) {
      imagePromptsText += chunk;
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

    // 解析图片提示词
    console.log('[handleSocialMediaResume 步骤 3] 开始解析图片提示词');
    console.log('[handleSocialMediaResume 步骤 3] Agent 输出原文:', imagePromptsText);
    
    let imagePrompts: Array<{ order: number; description: string; prompt: string; }> = [];
    try {
      // 尝试匹配 ```json 代码块
      const jsonMatch = imagePromptsText.match(/```json\s*([\s\S]*?)\s*```/);
      let jsonText = '';
      
      if (jsonMatch) {
        console.log('[handleSocialMediaResume 步骤 3] 检测到代码块格式');
        jsonText = jsonMatch[1];
      } else {
        // 如果没有代码块，尝试直接解析整个文本
        console.log('[handleSocialMediaResume 步骤 3] 未检测到代码块，尝试直接解析 JSON');
        jsonText = imagePromptsText.trim();
      }
      
      const parsed = JSON.parse(jsonText);
      imagePrompts = parsed.imagePrompts || [];
      console.log('[handleSocialMediaResume 步骤 3] 提取到的 imagePrompts 数量:', imagePrompts.length);
    } catch (e) {
      console.error('[handleSocialMediaResume 步骤 3] 解析图片提示词失败:', e);
    }

    // 步骤 4: 图片生成
    const step4Id = 'image-generation';
    console.log('[handleSocialMediaResume 步骤 4] 开始图片生成，数量:', imagePrompts.length);
    
    const step4StartMarker = `<!--STEP:${step4Id}:START:running-->步骤 4/4: 图片生成
使用 AI 生成配图 (${imagePrompts.length} 张)...
<!--STEP:${step4Id}:INPUT-->
\`\`\`json
${JSON.stringify({ imagePrompts: imagePrompts.map(p => ({ order: p.order, description: p.description })) }, null, 2)}
\`\`\`
<!--STEP:${step4Id}:INPUT:END-->

`;
    
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: step4StartMarker,
    });

    const generatedImages: Array<{ order: number; url: string; proxyUrl: string; description: string; }> = [];

    // 开始流式输出
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--STEP:${step4Id}:OUTPUT:STREAMING-->`,
    });

    if (imagePrompts.length > 0) {
      for (let i = 0; i < imagePrompts.length; i++) {
        const imagePrompt = imagePrompts[i];
        console.log(`[handleSocialMediaResume 步骤 4] 开始生成第 ${i + 1}/${imagePrompts.length} 张图片`);
        
        const imageStartText = `\n**[图片 ${i + 1}/${imagePrompts.length}] ${imagePrompt.description}**\n正在生成...\n`;
        writer.write({ type: 'text-delta', id: textId, delta: imageStartText });

        try {
          // 使用 imageGenerationAgent 生成图片
          const result = await generateImageWithAgent(imagePrompt.prompt, '1024*1024');
          
          if (result.success && result.url) {
            const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(result.url)}`;
            generatedImages.push({ 
              order: imagePrompt.order, 
              url: result.url, 
              proxyUrl: proxyUrl, 
              description: imagePrompt.description 
            });
            writer.write({ type: 'text-delta', id: textId, delta: `✅ 生成成功\n![图片${imagePrompt.order}](${proxyUrl})\n` });
          } else {
            writer.write({ type: 'text-delta', id: textId, delta: `❌ ${result.error || '生成失败'}\n` });
          }
        } catch (error) {
          console.error(`[handleSocialMediaResume 步骤 4] 图片 ${i + 1} 生成错误:`, error);
          const errorMessage = error instanceof Error ? error.message : '生成失败';
          writer.write({ type: 'text-delta', id: textId, delta: `❌ ${errorMessage}\n` });
        }
      }
      writer.write({ type: 'text-delta', id: textId, delta: `\n**生成结果**：成功 ${generatedImages.length}/${imagePrompts.length} 张\n` });
    }

    writer.write({ type: 'text-delta', id: textId, delta: `<!--STEP:${step4Id}:OUTPUT:STREAMING:END-->\n<!--STEP:${step4Id}:END:completed-->\n\n` });

    // 步骤 5: 内容格式化
    const step5Id = 'content-formatting';
    console.log('[handleSocialMediaResume] 步骤 5: 开始内容格式化');
    
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--STEP:${step5Id}:START:running-->步骤 5/5: 内容格式化
AI 正在整理最终输出格式...
<!--STEP:${step5Id}:INPUT-->
\`\`\`json
${JSON.stringify({ 
        contentLength: fullContent.length,
        imagesCount: generatedImages.length 
      }, null, 2)}
\`\`\`
<!--STEP:${step5Id}:INPUT:END-->

`,
    });
    
    const contentFormatterAgent = mastra.getAgent('contentFormatterAgent' as any);
    if (!contentFormatterAgent) {
      throw new Error('contentFormatterAgent 未找到');
    }
    
    // 构造格式化 Agent 的输入
    let formatterInput = `请格式化以下社交媒体文案，去除所有格式标签和Markdown语法，直接输出纯文本内容（不包含#、**、-、![]()等任何Markdown标记）。\n\n文案内容：\n${fullContent}`;
    
    if (generatedImages.length > 0) {
      formatterInput += `\n\n配图列表：\n`;
      generatedImages.forEach(img => {
        formatterInput += `- 图片${img.order}: ${img.description}\n  原始URL: ${img.url}\n  代理URL: ${img.proxyUrl}\n`;
      });
      formatterInput += `\n\n注意：配图信息只需要在文末以纯文本形式列出图片描述和原始URL，不要使用Markdown图片语法。保存草稿时会使用原始URL下载图片。`;
    }
    
    // 调用格式化 Agent（流式输出）
    writer.write({ type: 'text-delta', id: textId, delta: `<!--STEP:${step5Id}:OUTPUT:STREAMING-->` });
    
    const formatterStream = await contentFormatterAgent.stream([{
      role: 'user',
      content: formatterInput,
    }]);
    
    let formattedContent = '';
    for await (const chunk of formatterStream.textStream) {
      formattedContent += chunk;
      writer.write({ type: 'text-delta', id: textId, delta: chunk });
    }
    
    writer.write({ type: 'text-delta', id: textId, delta: `<!--STEP:${step5Id}:OUTPUT:STREAMING:END-->\n<!--STEP:${step5Id}:END:completed-->\n\n` });
    
    console.log('[handleSocialMediaResume] 格式化完成，内容长度:', formattedContent.length);
    
    // 最终结果：使用格式化后的内容
    writer.write({ type: 'text-delta', id: textId, delta: '<!--FINAL_RESULT_START-->\n' });
    writer.write({ type: 'text-delta', id: textId, delta: formattedContent });
    writer.write({ type: 'text-delta', id: textId, delta: '\n<!--FINAL_RESULT_END-->' });

    writer.write({ type: 'text-end', id: textId });
    console.log('[handleSocialMediaResume] 配图流程完成');
  }
}

/**
 * 处理文章创作工作流的 Resume
 */
async function handleContentCreationResume(
  writer: any,
  textId: string,
  needImages: boolean,
  prompt: string,
  searchResults: string,
  fullContent: string
) {
  if (!needImages) {
    // 用户选择不需要配图，跳过图片生成，但要过图文混合 agent 优化文案
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: '✅ 用户选择不需要配图\n\n',
    });

    writer.write({
      type: 'text-delta',
      id: textId,
      delta: '**跳过:** 图片生成\n\n',
    });

    // 步骤 3: 文案优化（仅文案）
    const step3Id = 'content-mix';
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--STEP:${step3Id}:START:running-->步骤 3/3: 文案优化
AI 正在优化文案排版和格式...
<!--STEP:${step3Id}:INPUT-->
\`\`\`json
${JSON.stringify({ 
        content: fullContent.substring(0, 500) + '...',
        hasImages: false 
      }, null, 2)}
\`\`\`
<!--STEP:${step3Id}:INPUT:END-->

`,
    });

    const contentMixAgent = mastra.getAgent('contentMixAgent' as any);
    if (!contentMixAgent) {
      throw new Error('contentMixAgent 未找到');
    }

    // 调用图文混合 agent（仅文案模式）
    const mixPrompt = `请优化以下文案的排版和格式，保持内容不变，但让它更适合微信公众号阅读。注意：用户不需要配图，所以只需输出文案。\n\n文案内容：\n${fullContent}`;

    const mixStream = await contentMixAgent.stream([{
      role: 'user',
      content: mixPrompt,
    }]);

    let finalContent = '';
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--STEP:${step3Id}:OUTPUT:STREAMING-->`,
    });

    for await (const chunk of mixStream.textStream) {
      finalContent += chunk;
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

    writer.write({
      type: 'text-delta',
      id: textId,
      delta: '---\n\n',
    });

    // 最终结果（移除标题）
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: '<!--FINAL_RESULT_START-->\n',
    });

    writer.write({
      type: 'text-delta',
      id: textId,
      delta: finalContent || fullContent, // 如果混合失败，使用原始文案
    });

    writer.write({
      type: 'text-delta',
      id: textId,
      delta: '\n<!--FINAL_RESULT_END-->',
    });

    writer.write({ type: 'text-end', id: textId });
    console.log('[handleContentCreationResume] 不需要配图，文案优化完成');
  } else {
    // 用户选择需要配图，继续执行图片生成流程
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: '✅ 用户选择需要配图\n\n',
    });

    // 步骤 3: 图片提示词生成
    const step3Id = 'image-prompt-generation';
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--STEP:${step3Id}:START:running-->步骤 3/5: 图片提示词生成
AI 正在分析文案，生成配图方案...
<!--STEP:${step3Id}:INPUT-->
\`\`\`json
${JSON.stringify({ content: fullContent.substring(0, 500) + '...' }, null, 2)}
\`\`\`
<!--STEP:${step3Id}:INPUT:END-->

`,
    });

    const imagePromptAgent = mastra.getAgent('imagePromptAgent' as any);
    if (!imagePromptAgent) {
      throw new Error('imagePromptAgent 未找到');
    }

    const imagePromptStream = await imagePromptAgent.stream([{
      role: 'user',
      content: `文案内容:\n${fullContent}\n\n请为这篇文案生成 2-3 张配图的提示词。`,
    }]);

    let imagePromptsText = '';
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--STEP:${step3Id}:OUTPUT:STREAMING-->`,
    });

    for await (const chunk of imagePromptStream.textStream) {
      imagePromptsText += chunk;
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

    // 解析图片提示词
    console.log('[handleContentCreationResume 步骤 3] 开始解析图片提示词');
    console.log('[handleContentCreationResume 步骤 3] Agent 输出原文:', imagePromptsText);
    console.log('[handleContentCreationResume 步骤 3] 输出长度:', imagePromptsText.length);
    
    let imagePrompts: Array<{ order: number; description: string; prompt: string; }> = [];
    try {
      // 尝试匹配 ```json 代码块
      const jsonMatch = imagePromptsText.match(/```json\s*([\s\S]*?)\s*```/);
      let jsonText = '';
      
      if (jsonMatch) {
        console.log('[handleContentCreationResume 步骤 3] 检测到代码块格式');
        jsonText = jsonMatch[1];
      } else {
        // 如果没有代码块，尝试直接解析整个文本
        console.log('[handleContentCreationResume 步骤 3] 未检测到代码块，尝试直接解析 JSON');
        jsonText = imagePromptsText.trim();
      }
      
      console.log('[handleContentCreationResume 步骤 3] 待解析的 JSON 文本（前 200 字符）:', jsonText.substring(0, 200));
      
      const parsed = JSON.parse(jsonText);
      console.log('[handleContentCreationResume 步骤 3] 解析后的对象 keys:', Object.keys(parsed));
      
      imagePrompts = parsed.imagePrompts || [];
      console.log('[handleContentCreationResume 步骤 3] 提取到的 imagePrompts 数量:', imagePrompts.length);
      
      if (imagePrompts.length > 0) {
        console.log('[handleContentCreationResume 步骤 3] 第一张图片:', JSON.stringify(imagePrompts[0], null, 2));
      }
    } catch (e) {
      console.error('[handleContentCreationResume 步骤 3] 解析图片提示词失败:', e);
      console.error('[handleContentCreationResume 步骤 3] 错误堆栈:', e instanceof Error ? e.stack : '');
    }
    
    console.log('[handleContentCreationResume 步骤 3] 最终解析结果 - 图片数量:', imagePrompts.length);

    // 步骤 4: 图片生成
    const step4Id = 'image-generation';
    console.log('[handleContentCreationResume 步骤 4] 开始图片生成步骤');
    console.log('[handleContentCreationResume 步骤 4] 图片提示词数量:', imagePrompts.length);
    console.log('[handleContentCreationResume 步骤 4] 图片提示词:', JSON.stringify(imagePrompts, null, 2));
    
    const step4StartMarker = `<!--STEP:${step4Id}:START:running-->步骤 4/5: 图片生成
使用 AI 生成配图 (${imagePrompts.length} 张)...
<!--STEP:${step4Id}:INPUT-->
\`\`\`json
${JSON.stringify({ imagePrompts: imagePrompts.map(p => ({ order: p.order, description: p.description })) }, null, 2)}
\`\`\`
<!--STEP:${step4Id}:INPUT:END-->

`;
    
    console.log('[handleContentCreationResume 步骤 4] 发送 START 标记和 INPUT:');
    console.log(step4StartMarker);
    
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: step4StartMarker,
    });

    const generatedImages: Array<{ order: number; url: string; proxyUrl: string; description: string; }> = [];

    // 开始流式输出
    const outputStreamingMarker = `<!--STEP:${step4Id}:OUTPUT:STREAMING-->`;
    console.log('[handleContentCreationResume 步骤 4] 发送 OUTPUT:STREAMING 标记:', outputStreamingMarker);
    
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: outputStreamingMarker,
    });

    if (imagePrompts.length > 0) {
      for (let i = 0; i < imagePrompts.length; i++) {
        const imagePrompt = imagePrompts[i];
        console.log(`[handleContentCreationResume 步骤 4] 开始生成第 ${i + 1}/${imagePrompts.length} 张图片:`, imagePrompt.description);
        
        const imageStartText = `\n**[图片 ${i + 1}/${imagePrompts.length}] ${imagePrompt.description}**\n正在生成...\n`;
        console.log(`[handleContentCreationResume 步骤 4] 发送图片进度:`, imageStartText);
        
        writer.write({ type: 'text-delta', id: textId, delta: imageStartText });

        try {
          // 使用 imageGenerationAgent 生成图片
          const result = await generateImageWithAgent(imagePrompt.prompt, '1024*1024');
          
          if (result.success && result.url) {
            const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(result.url)}`;
            generatedImages.push({ 
              order: imagePrompt.order, 
              url: result.url, 
              proxyUrl: proxyUrl, 
              description: imagePrompt.description 
            });
            const successText = `✅ 生成成功\n![图片${imagePrompt.order}](${proxyUrl})\n`;
            console.log(`[handleContentCreationResume 步骤 4] 图片 ${i + 1} 生成成功:`, successText);
            writer.write({ type: 'text-delta', id: textId, delta: successText });
          } else {
            console.log(`[handleContentCreationResume 步骤 4] 图片 ${i + 1} 失败:`, result.error);
            writer.write({ type: 'text-delta', id: textId, delta: `❌ ${result.error || '生成失败'}\n` });
          }
        } catch (error) {
          console.error(`[handleContentCreationResume 步骤 4] 图片 ${i + 1} 生成错误:`, error);
          const errorMessage = error instanceof Error ? error.message : '生成失败';
          const errorText = `❌ ${errorMessage}\n`;
          console.log(`[handleContentCreationResume 步骤 4] 发送错误信息:`, errorText);
          writer.write({ type: 'text-delta', id: textId, delta: errorText });
        }
      }
      const summaryText = `\n**生成结果**：成功 ${generatedImages.length}/${imagePrompts.length} 张\n`;
      console.log('[handleContentCreationResume 步骤 4] 发送生成结果汇总:', summaryText);
      writer.write({ type: 'text-delta', id: textId, delta: summaryText });
    }

    // 结束流式输出
    const step4EndMarker = `<!--STEP:${step4Id}:OUTPUT:STREAMING:END-->\n<!--STEP:${step4Id}:END:completed-->\n\n`;
    console.log('[handleContentCreationResume 步骤 4] 发送结束标记:', step4EndMarker);
    console.log('[handleContentCreationResume 步骤 4] 生成的图片总数:', generatedImages.length);
    console.log('[handleContentCreationResume 步骤 4] 图片详情:', JSON.stringify(generatedImages, null, 2));
    
    writer.write({ type: 'text-delta', id: textId, delta: step4EndMarker });

    // 步骤 5: 图文混合
    const step5Id = 'content-mix';
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--STEP:${step5Id}:START:running-->步骤 5/5: 图文混合
AI 正在将文案与配图进行最优排版...
<!--STEP:${step5Id}:INPUT-->
\`\`\`json
${JSON.stringify({ 
        content: fullContent.substring(0, 300) + '...',
        imagesCount: generatedImages.length
      }, null, 2)}
\`\`\`
<!--STEP:${step5Id}:INPUT:END-->

`,
    });

    const contentMixAgent = mastra.getAgent('contentMixAgent' as any);
    if (!contentMixAgent) {
      throw new Error('contentMixAgent 未找到');
    }

    // 准备图片信息（同时提供原始URL和代理URL）
    const imageDescriptions = generatedImages.map(img => 
      `图片${img.order}: ${img.description}\n  原始URL: ${img.url}\n  代理URL: ${img.proxyUrl}`
    ).join('\n\n');

    // 调用图文混合 agent
    const mixPrompt = generatedImages.length > 0
      ? `请将以下文案与配图进行最优排版，让内容更适合微信公众号阅读。

文案内容：
${fullContent}

可用配图：
${imageDescriptions}

请将图片合理地插入到文案中，使用 Markdown 格式。`
      : `请优化以下文案的排版，让它更适合微信公众号阅读。注意：配图生成失败，所以只需输出文案。\n\n文案内容：\n${fullContent}`;

    const mixStream = await contentMixAgent.stream([{
      role: 'user',
      content: mixPrompt,
    }]);

    let mixedContent = '';
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--STEP:${step5Id}:OUTPUT:STREAMING-->`,
    });

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

    // 最终结果：使用混合后的内容（移除标题）
    writer.write({ type: 'text-delta', id: textId, delta: '<!--FINAL_RESULT_START-->\n' });
    writer.write({ type: 'text-delta', id: textId, delta: mixedContent || fullContent }); // 如果混合失败，使用原始文案
    writer.write({ type: 'text-delta', id: textId, delta: '\n<!--FINAL_RESULT_END-->' });

    writer.write({ type: 'text-end', id: textId });
    console.log('[handleContentCreationResume] 配图流程完成');
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
    delta: '**开始执行联网搜索工作流**\n\n',
  });

  writer.write({
    type: 'text-delta',
    id: textId,
    delta: '工作流包含 1 个步骤: 联网搜索\n\n',
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
    delta: `<!--STEP:${step1Id}:START:running-->步骤 1/1: 联网搜索
正在搜索相关信息...
<!--STEP:${step1Id}:INPUT-->
\`\`\`json
${JSON.stringify({ query: userPrompt, purpose: '获取最新信息' }, null, 2)}
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
    content: `搜索主题: ${userPrompt}\n\n用途: 获取最新信息`,
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

  // 最终结果
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: '<!--FINAL_RESULT_START-->\n## 搜索结果\n\n',
  });

  writer.write({
    type: 'text-delta',
    id: textId,
    delta: searchResults,
  });

  writer.write({
    type: 'text-delta',
    id: textId,
    delta: '\n<!--FINAL_RESULT_END-->',
  });
  
  console.log('[executeWebSearchInStream] 执行完成');
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
    // 使用 imageGenerationAgent 生成图片
    const result = await generateImageWithAgent(
      imagePromptData.prompt, 
      imagePromptData.aspectRatio === '16:9' ? '1024*576' : '1024*1024'
    );

    if (result.success && result.url) {
      const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(result.url)}`;
      
      writer.write({
        type: 'text-delta',
        id: textId,
        delta: `<!--STEP:${step2Id}:OUTPUT-->
**图片生成结果**：
\`\`\`json
${JSON.stringify({ 
  success: true,
  originalUrl: result.url,
  proxyUrl: proxyUrl
}, null, 2)}
\`\`\`

**生成的图片**：

![生成的图片](${proxyUrl})

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
        delta: `![生成的图片](${proxyUrl})`,
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
        delta: `<!--STEP:${step2Id}:OUTPUT-->图片生成失败: ${result.error}<!--STEP:${step2Id}:OUTPUT:END-->\n<!--STEP:${step2Id}:END:error-->\n\n`,
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
    delta: '工作流包含 3 个步骤: 联网搜索 → 文案生成 → 人工确认\n\n',
  });

  writer.write({
    type: 'text-delta',
    id: textId,
    delta: '---\n\n',
  });

  // 步骤 1: 联网搜索
  const step1Id = 'web-search';
  console.log('[executeSocialMediaPostInStream] 开始步骤 1: 联网搜索');
  
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step1Id}:START:running-->步骤 1/3: 联网搜索
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
    console.error('[executeSocialMediaPostInStream] webSearchAgent 未找到');
    throw new Error('webSearchAgent 未找到');
  }
  
  console.log('[executeSocialMediaPostInStream] 调用 webSearchAgent.stream');
  
  // Agent的instructions已包含所有业务逻辑，只需传递数据
  const searchStream = await webSearchAgent.stream([{
    role: 'user',
    content: `搜索主题: ${prompt}\n\n用途: 社交媒体内容创作`,
  }]);

  console.log('[executeSocialMediaPostInStream] webSearchAgent.stream 返回成功');
  
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

  console.log('[executeSocialMediaPostInStream] 搜索完成，结果长度:', searchResults.length);

  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step1Id}:OUTPUT:STREAMING:END-->
<!--STEP:${step1Id}:END:completed-->

`,
  });

  // 步骤 2: 生成社交媒体文案
  const step2Id = 'social-media-content';
  console.log('[executeSocialMediaPostInStream] 开始步骤 2: 生成文案');
  
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step2Id}:START:running-->步骤 2/2: 生成社交媒体文案
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
    console.error('[executeSocialMediaPostInStream] socialMediaAgent 未找到');
    throw new Error('socialMediaAgent 未找到');
  }
  
  console.log('[executeSocialMediaPostInStream] 调用 socialMediaAgent.stream');
  
  // 只传递数据参数，让Agent的instructions发挥作用
  const contentStream = await socialMediaAgent.stream([{
    role: 'user',
    content: `主题：${prompt}\n\n背景信息：\n${searchResults || '暂无'}`,
  }]);

  console.log('[executeSocialMediaPostInStream] socialMediaAgent.stream 返回成功');

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

  console.log('[executeSocialMediaPostInStream] 文案生成完成，长度:', fullContent.length);

  writer.write({
    type: 'text-delta',
    id: textId,
    delta: `<!--STEP:${step2Id}:OUTPUT:STREAMING:END-->\n<!--STEP:${step2Id}:END:completed-->\n\n`,
  });

  try {
    // 生成唯一的 runId
    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('[executeSocialMediaPostInStream] 生成 runId:', runId);

    // 保存工作流数据到全局内存
    if (!global.workflowRunData) {
      global.workflowRunData = {};
    }
    global.workflowRunData[runId] = {
      workflowType: 'social-media-post',
      prompt,
      searchResults,
      fullContent,
      stepId: 'await-image-confirmation',
    };
    console.log('[executeSocialMediaPostInStream] 已保存工作流数据:', runId);

    // 暂停工作流，等待用户确认
    const stepId = 'await-image-confirmation';
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--WORKFLOW_SUSPENDED:${runId}:${stepId}-->

---

**❓ 需要为这条文案配图吗？**

文案已生成完成，您可以选择：
- 配图：生成 2-4 张适合社交媒体的图片
- 不配图：直接输出文案

`,
    });

    // 结束文本块
    writer.write({ type: 'text-end', id: textId });
    console.log('[executeSocialMediaPostInStream] 工作流已暂停，等待用户确认');

  } catch (error: any) {
    console.error('[executeSocialMediaPostInStream] 错误:', error);
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `

❌ **错误**: ${error.message}

`,
    });
    writer.write({ type: 'text-end', id: textId });
  }
  
  console.log('[executeSocialMediaPostInStream] 执行完成');
}

/**
 * 在 stream 中执行文章创作工作流
 * 混合方案: 使用手动流式输出 + Mastra workflow suspend/resume
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
    delta: '工作流包含 2 个步骤: 联网搜索 → 文案生成 → 人工确认\n\n',
  });

  writer.write({
    type: 'text-delta',
    id: textId,
    delta: '---\n\n',
  });

  try {
    // 生成唯一的 runId
    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('[executeContentCreationWorkflowInStream] 生成 runId:', runId);

    // 步骤 1: 联网搜索 (手动流式输出)
    const step1Id = 'web-search';
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--STEP:${step1Id}:START:running-->步骤 1/2: 联网搜索
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
      delta: `<!--STEP:${step1Id}:OUTPUT:STREAMING:END-->\n<!--STEP:${step1Id}:END:completed-->\n\n`,
    });

    // 步骤 2: 文案生成 (手动流式输出)
    const step2Id = 'content-creation';
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--STEP:${step2Id}:START:running-->步骤 2/2: 文案生成
AI 正在创作中...
<!--STEP:${step2Id}:INPUT-->
\`\`\`json
${JSON.stringify({ 
        topic: prompt, 
        platform: 'generic',
        wordCount: '1500-2500字',
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
    
    const contentStream = await contentCreationAgent.stream([{
      role: 'user',
      content: `写作主题:${prompt}

目标平台:generic

写作字数:1500-2500字

背景信息:
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
      delta: `<!--STEP:${step2Id}:OUTPUT:STREAMING:END-->\n<!--STEP:${step2Id}:END:completed-->\n\n`,
    });

    // 现在使用 Mastra workflow 的 suspend 机制
    console.log('[executeContentCreationWorkflowInStream] 准备 suspend 工作流');
    
    // 保存工作流数据到全局内存
    if (!global.workflowRunData) {
      global.workflowRunData = {};
    }
    global.workflowRunData[runId] = {
      workflowType: 'content-creation',
      prompt,
      searchResults,
      fullContent,
      stepId: 'human-confirmation',
      timestamp: Date.now(),
    };
    console.log('[executeContentCreationWorkflowInStream] 已保存工作流数据:', runId);
    
    // 显示确认标记（使用统一的新格式）
    const stepId = 'human-confirmation';
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--WORKFLOW_SUSPENDED:${runId}:${stepId}-->

---

**❓ 需要为文案配图吗？**

文案已生成完成，您可以选择：
- 配图：生成 2-3 张适合文章的配图
- 不配图：直接输出文案

`,
    });

    // 结束流,等待用户确认
    writer.write({ type: 'text-end', id: textId });
    console.log('[executeContentCreationWorkflowInStream] 工作流已暂停,等待用户确认');
  } catch (error: any) {
    console.error('[executeContentCreationWorkflowInStream] 错误:', error);
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `

❌ **错误**: ${error.message}

`,
    });
    writer.write({ type: 'text-end', id: textId });
  }
}



