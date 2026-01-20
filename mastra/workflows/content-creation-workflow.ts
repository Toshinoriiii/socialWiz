// mastra/workflows/content-creation-workflow.ts

import { createWorkflow, createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { webSearchAgent } from '../agents/web-search-agent'
import { contentCreationAgent } from '../agents/content-creation-agent'
import { imagePromptAgent } from '../agents/image-prompt-agent'
import { contentMixAgent } from '../agents/content-mix-agent'
import { getMCPClient } from '../mcp'

/**
 * Step 1: Web Search
 */
const webSearchStep = createStep({
  id: 'web-search',
  description: '根据用户主题进行联网搜索',
  inputSchema: z.object({
    prompt: z.string().describe('用户输入的主题'),
    platform: z.enum(['weibo', 'wechat', 'xiaohongshu', 'douyin', 'generic']).optional(),
    wordCount: z.number().optional(),
  }),
  outputSchema: z.object({
    prompt: z.string(),
    platform: z.enum(['weibo', 'wechat', 'xiaohongshu', 'douyin', 'generic']).optional(),
    wordCount: z.number().optional(),
    searchResults: z.string(),
  }),
  // 声明此步骤使用的 state
  stateSchema: z.object({
    searchResults: z.string().optional(),
  }),
  execute: async ({ inputData, runId, state, setState }) => {
    const { prompt, platform, wordCount } = inputData
  
    console.log(`[${runId}] Web Search Step - Starting with prompt:`, prompt);
  
    try {
      // 调用 Web Search Agent
      const searchPrompt = `请搜索关于“${prompt}”的最新信息和热点内容，用于自媒体内容创作。`
        
      console.log(`[${runId}] Calling webSearchAgent.generate...`);
      const response = await webSearchAgent.generate(searchPrompt)
      const searchResults = response.text || ''
  
      console.log(`[${runId}] Search completed, result length:`, searchResults.length);


      // 将搜索结果保存到 Workflow State
      setState({
        ...state,
        searchResults,
      })

      // 返回包含所有需要的数据
      return {
        prompt,
        platform,
        wordCount,
        searchResults,
      }
    } catch (error) {
      console.error(`[${runId}] 搜索失败`, error)
      throw new Error(`搜索失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  },
})

/**
 * Step 2: Content Creation（基于搜索结果）
 */
const contentCreationStep = createStep({
  id: 'content-creation',
  description: '根据用户输入生成文案',
  inputSchema: z.object({
    prompt: z.string().describe('用户输入的主题'),
    platform: z.enum(['weibo', 'wechat', 'xiaohongshu', 'douyin', 'generic']).optional(),
    wordCount: z.number().optional().describe('写作字数要求'),
    searchResults: z.string(),
  }),
  outputSchema: z.object({
    content: z.object({
      titles: z.array(z.string()).describe('5个备选标题'),
      body: z.string().describe('正文内容（Markdown格式）'),
      tags: z.array(z.string()).describe('4-5个SEO关键词标签'),
      platform: z.string().optional(),
      wordCount: z.number().optional(),
    }),
  }),
  // 声明此步骤使用的 state
  stateSchema: z.object({
    requestId: z.string(),
    searchResults: z.string().optional(),  // 从 Web Search 步骤获取
    content: z.object({
      titles: z.array(z.string()),
      body: z.string(),
      tags: z.array(z.string()),
      platform: z.string().optional(),
      wordCount: z.number().optional(),
    }).optional(),
  }),
  execute: async ({ inputData, runId, state, setState }) => {
    const { prompt, platform, wordCount, searchResults } = inputData
    const { requestId } = state

    console.log(`[${runId}] Content Creation Step - Starting...`);

    try {
      // 构造给 Content Creation Agent 的提示词
      const contentPrompt = `
## 本次创作任务

**写作主题**: ${prompt}

**目标平台**: ${platform || 'generic'}

**写作字数**: ${wordCount ? `${wordCount}字左右` : '800-1200字（默认）'}

**背景信息**: 
${searchResults || '暂无（仅基于用户输入的主题进行创作）'}

请按照你的专业标准，创作一篇高质量的自媒体文案。记住：
1. 先生成5个备选标题（问句/反问形式）
2. 以钩子开头，第一人称"我"的视角
3. 情感充沛，细节丰富
4. 末尾添加4-5个SEO关键词标签
5. 使用Markdown格式输出
`

      const response = await contentCreationAgent.generate(contentPrompt)

      // 解析响应内容
      const textContent = response.text || ''

      // 尝试从文本中提取结构化信息
      // 提取标题（查找"1. "开头的行）
      const titleMatches = textContent.match(/^\d+\.\s*(.+)$/gm)
      const titles = titleMatches ? titleMatches.slice(0, 5).map(t => t.replace(/^\d+\.\s*/, '').trim()) : []

      // 提取标签（查找 # 标签）
      const tagMatches = textContent.match(/#[^\s#、,]+/g)
      const tags = tagMatches ? tagMatches.map(t => t.replace('#', '').trim()).slice(0, 5) : []


      // 将文案保存到 Workflow State
      const contentData = {
        titles,
        body: textContent,
        tags,
        platform: platform || 'generic',
        wordCount: textContent.length,
      }

      setState({
        ...state,
        content: contentData,
      })

      return {
        content: contentData,
      }
    } catch (error) {
      console.error(`[${runId}] 文案生成失败`, error)
      throw new Error(`文案生成失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  },
})

/**
 * Step 3: Image Prompt Generation
 */
const imagePromptStep = createStep({
  id: 'image-prompt-generation',
  description: '根据文案生成图片提示词',
  inputSchema: z.object({
    content: z.object({
      titles: z.array(z.string()),
      body: z.string(),
      tags: z.array(z.string()),
      platform: z.string().optional(),
      wordCount: z.number().optional(),
    }),
  }),
  outputSchema: z.object({
    imagePrompt: z.string().describe('完整的图片提示词'),
    aspectRatio: z.enum(['1:1', '16:9', '9:16', '3:4']).optional(),
  }),
  // 声明此步骤使用的 state
  stateSchema: z.object({
    content: z.object({
      titles: z.array(z.string()),
      body: z.string(),
      tags: z.array(z.string()),
      platform: z.string().optional(),
    }).optional(),
    imagePrompt: z.string().optional(),
  }),
  execute: async ({ inputData, runId, state, setState }) => {
    const { content } = inputData
  
    console.log(`[${runId}] Image Prompt Step - Starting...`);
  
    try {
      // 根据平台确定宽高比
      const platform = content.platform || 'generic'
      const defaultAspectRatio =
        platform === 'weibo' ? '1:1' :
        platform === 'xiaohongshu' ? '3:4' :
        platform === 'wechat' ? '16:9' :
        platform === 'douyin' ? '9:16' : '1:1'

      const promptRequest = `
请为以下文案生成适合的英文图片提示词：

标题选项：
${content.titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

正文摘要：
${content.body.substring(0, 500)}...

标签：${content.tags.join('、')}

目标平台：${platform || 'generic'}
宽高比：${defaultAspectRatio}

请输出 JSON 格式：
{
  "prompt": "详细的英文图片描述提示词",
  "aspectRatio": "${defaultAspectRatio}"
}
`

      const response = await imagePromptAgent.generate(promptRequest)

      let imagePromptData
      const responseText = response.text || ''
      
      try {
        // 尝试直接解析 JSON
        imagePromptData = JSON.parse(responseText)
      } catch {
        // 如果直接解析失败，尝试从文本中提取 JSON
        const jsonMatch = responseText.match(/\{[\s\S]*?"prompt"[\s\S]*?"aspectRatio"[\s\S]*?\}/)
        if (jsonMatch) {
          try {
            imagePromptData = JSON.parse(jsonMatch[0])
          } catch {
            // 如果还是失败，使用整个文本作为 prompt
            imagePromptData = {
              prompt: responseText,
              aspectRatio: defaultAspectRatio,
            }
          }
        } else {
          // 找不到 JSON，使用整个文本作为 prompt
          imagePromptData = {
            prompt: responseText,
            aspectRatio: defaultAspectRatio,
          }
        }
      }

      // 确保 prompt 是字符串且不为空
      const finalPrompt = typeof imagePromptData.prompt === 'string' && imagePromptData.prompt.trim() 
        ? imagePromptData.prompt.trim() 
        : 'A social media post image'

      // 保存 imagePrompt 到 state
      setState({
        ...state,
        imagePrompt: finalPrompt,
      })

      // 只返回当前步骤的输出，不需要传递 content
      return {
        imagePrompt: finalPrompt,  // 完整的提示词（传递给下一步）
        aspectRatio: imagePromptData.aspectRatio || defaultAspectRatio,
      }
    } catch (error) {
      console.error(`[${runId}] 图片提示词生成失败`, error)
      throw new Error(`图片提示词生成失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  },
})

/**
 * Step 4: Image Generation (使用 MCP 工具)
 */
const imageGenerationStep = createStep({
  id: 'image-generation',
  description: '使用 MCP 工具生成图片',
  inputSchema: z.object({
    imagePrompt: z.string(),
    aspectRatio: z.enum(['1:1', '16:9', '9:16', '3:4']).optional(),
  }),
  outputSchema: z.object({
    imageResult: z.any().describe('完整的MCP图片生成结果'),
  }),
  // 声明此步骤使用的 state
  stateSchema: z.object({
    imageResult: z.any().optional(),
  }),
  execute: async ({ inputData, runId, state, setState }) => {
    const { imagePrompt, aspectRatio } = inputData

    console.log(`[${runId}] Image Generation Step - Starting...`);

    // 检查 imagePrompt 是否为空
    if (!imagePrompt || typeof imagePrompt !== 'string' || !imagePrompt.trim()) {
      throw new Error(`图片提示词为空或无效: ${JSON.stringify(imagePrompt)}`)
    }


    try {
      // 获取 MCP tools
      const mcpClient = getMCPClient();
      const allTools = await mcpClient.getTools()
      
      // 查找 image generation tool
      // MCPClient 会以 serverName_toolName 格式命名工具
      const imageToolEntry = Object.entries(allTools).find(
        ([name]) => name.toLowerCase().includes('image')
      )

      if (!imageToolEntry) {
        throw new Error('未找到图片生成工具，请检查 MCP 配置')
      }

      const [toolName, imageTool] = imageToolEntry

      // 调用 MCP 图片生成工具
      // Mastra 工具的调用方式：imageTool.execute({ context: params })
      const toolArgs = {
        prompt: imagePrompt,
        aspect_ratio: aspectRatio || '1:1',
      }
      

      // Mastra 工具需要将参数包装在 context 对象中
      const result = await imageTool.execute({ context: toolArgs })


      // 将图片结果保存到 Workflow State
      setState({
        ...state,
        imageResult: result,
      })

      return {
        imageResult: result,
      }
    } catch (error) {
      console.error(`[${runId}] 图片生成失败`, error)
      throw new Error(`图片生成失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  },
})

/**
 * Step 5: Content Mix（图文混合）
 */
const contentMixStep = createStep({
  id: 'content-mix',
  description: '将文案和图片混合成最终内容',
  inputSchema: z.object({
    imageResult: z.any(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    requestId: z.string(),
    finalContent: z.string().describe('图文混合后的最终内容（Markdown）'),
    rawContent: z.object({
      titles: z.array(z.string()),
      body: z.string(),
      tags: z.array(z.string()),
    }),
    imageData: z.any(),
    timestamp: z.string(),
    // 调试信息
    finalContentLength: z.number().describe('最终内容长度'),
    imageUrlsCount: z.number().describe('解析到的图片数量'),
  }),
  // 声明此步骤使用的 state
  stateSchema: z.object({
    requestId: z.string(),
    content: z.object({
      titles: z.array(z.string()),
      body: z.string(),
      tags: z.array(z.string()),
    }),
    imageResult: z.any(),
  }),
  execute: async ({ inputData, runId, state }) => {
    const { imageResult } = inputData
    const { requestId, content } = state

    console.log(`[${runId}] Content Mix Step - Starting...`);
    console.log(`[${runId}] State:`, { requestId, hasContent: !!content, hasImageResult: !!imageResult });
    console.log(`[${runId}] Content data:`, content ? { titleCount: content.titles?.length, bodyLength: content.body?.length } : 'no content');

    // 检查 content 是否存在
    if (!content) {
      console.error(`[${runId}] content 为空! state keys:`, Object.keys(state));
      throw new Error('content 为空，无法混合内容');
    }

    try {
      // 解析图片 URL
      let imageUrls: string[] = []
      
      // imageResult 可能的格式:
      // 1. { content: [{ type: 'text', text: '{"results": [...]}' }] }
      // 2. { results: [...] }
      // 3. 直接是字符串
      
      if (imageResult?.content?.[0]?.text) {
        // 格式 1: MCP 工具返回的格式
        try {
          const parsed = JSON.parse(imageResult.content[0].text)
          if (parsed.results && Array.isArray(parsed.results)) {
            imageUrls = parsed.results
          }
        } catch (e) {
          console.error(`[${runId}] 解析 MCP 返回的 JSON 失败`, e)
        }
      } else if (imageResult?.results && Array.isArray(imageResult.results)) {
        // 格式 2: 直接的 results 数组
        imageUrls = imageResult.results
      } else if (typeof imageResult === 'string') {
        // 格式 3: 字符串格式
        try {
          const parsed = JSON.parse(imageResult)
          if (parsed.results && Array.isArray(parsed.results)) {
            imageUrls = parsed.results
          }
        } catch (e) {
          console.error(`[${runId}] 解析字符串 JSON 失败`, e)
        }
      }


      // 构造给 Content Mix Agent 的输入
      const mixPrompt = `
请将以下文案内容和图片进行混合：

## 文案内容

### 标题选项
${content.titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

### 正文
${content.body}

### 标签
${content.tags.map(t => `#${t}`).join('、')}

## 图片 URL 列表
${imageUrls.length > 0 ? imageUrls.map((url, i) => `${i + 1}. ${url}`).join('\n') : '（未生成图片）'}

请将图片和文案混合成图文并茂的内容。
要求：
1. 选择第一个标题作为主标题
2. 在标题后插入第一张图片
3. 正文按段落排版
4. 在正文中间适当位置插入其他图片（如果有多张）
5. 标签放在最后
6. 使用 Markdown 格式
7. **必须保留完整的图片 URL，不能有任何截断！**
`

      const response = await contentMixAgent.generate(mixPrompt)

      const finalContent = response.text || ''

      console.log(`[${runId}] Content mix completed, finalContent length:`, finalContent.length);

      const outputData = {
        success: true,
        requestId,
        finalContent,
        rawContent: {
          titles: content.titles,
          body: content.body,
          tags: content.tags,
        },
        imageData: imageResult,
        timestamp: new Date().toISOString(),
        // 调试信息
        finalContentLength: finalContent.length,
        imageUrlsCount: imageUrls.length,
      }

      console.log(`[${runId}] Returning output:`, {
        success: outputData.success,
        requestId: outputData.requestId,
        finalContentLength: outputData.finalContentLength,
        imageUrlsCount: outputData.imageUrlsCount,
        hasRawContent: !!outputData.rawContent,
      });

      return outputData
    } catch (error) {
      console.error(`[${runId}] 图文混合失败`, error)
      throw new Error(`图文混合失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  },
})

/**
 * 内容创作工作流（完整版）
 * 用户输入 → 联网搜索 → 文案生成 → 图片提示词 → 图片生成 → 图文混合
 */
const contentCreationWorkflow = createWorkflow({
  id: 'content-creation-workflow',
  inputSchema: z.object({
    prompt: z.string().describe('用户输入的主题'),
    platform: z.enum(['weibo', 'wechat', 'xiaohongshu', 'douyin', 'generic']).optional().default('generic'),
    wordCount: z.number().optional().describe('写作字数要求'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    requestId: z.string(),
    finalContent: z.string(),
    rawContent: z.object({
      titles: z.array(z.string()),
      body: z.string(),
      tags: z.array(z.string()),
    }),
    imageData: z.any(),
    timestamp: z.string(),
    finalContentLength: z.number().optional(),
    imageUrlsCount: z.number().optional(),
  }),
  // 定义 Workflow State 模式 - 共享所有步骤需要的数据
  stateSchema: z.object({
    requestId: z.string(),
    searchResults: z.string().optional(),  // Web Search 结果
    content: z.object({
      titles: z.array(z.string()),
      body: z.string(),
      tags: z.array(z.string()),
      platform: z.string().optional(),
      wordCount: z.number().optional(),
    }).optional(),
    imagePrompt: z.string().optional(),  // 图片提示词
    imageResult: z.any().optional(),  // 图片生成结果
  }),
})
  .then(webSearchStep)        // Step 1: 联网搜索
  .then(contentCreationStep)  // Step 2: 文案生成
  .then(imagePromptStep)      // Step 3: 图片提示词
  .then(imageGenerationStep)  // Step 4: 图片生成
  .then(contentMixStep)       // Step 5: 图文混合（最后一步的返回值会成为 workflow 的输出）
  .commit()  // commit() 调用应该链式调用，不要分开

export { contentCreationWorkflow }
