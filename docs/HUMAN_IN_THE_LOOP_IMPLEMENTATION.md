# Human in the Loop 实现方案文档

## 目录

- [概述](#概述)
- [技术选型分析](#技术选型分析)
- [Human in the Loop 实现机制](#human-in-the-loop-实现机制)
- [完整实现示例](#完整实现示例)
- [架构问题与改进方向](#架构问题与改进方向)
- [方案对比](#方案对比)
- [参考资料](#参考资料)

---

## 概述

### 项目背景

在文章创作工作流中，我们需要实现以下核心功能：

1. **实时流式输出**：用户能够实时看到每个步骤（联网搜索、文案生成、图片生成等）的执行过程和 Agent 的中间输出
2. **Human in the Loop**：在文案生成后，询问用户是否需要配图，根据用户选择执行不同的后续流程
3. **良好的用户体验**：步骤编号连贯一致，用户消息简洁友好，所有步骤的输出都能展开查看

### 技术挑战

在实现过程中，我们发现 **Mastra 框架的 `workflow.stream()` 存在严重局限性**：

- 只能输出工作流级别的事件（`workflow-start`, `step-started`, `step-completed`）
- 无法访问 Agent 内部的 `textStream`，看不到 Agent 的思考过程
- 用户体验差：长时间等待（10-30秒），看不到任何进展

**问题示例**：

```
✅ 步骤 1 开始：联网搜索
   [等待 10 秒...] ← 用户看不到任何进展
✅ 步骤 1 完成：搜索结果...

✅ 步骤 2 开始：文案生成
   [等待 20 秒...] ← 用户看不到 Agent 正在写什么
✅ 步骤 2 完成：完整文章...
```

### 解决方案

我们采用了**混合方案**：

- **手动流式输出**：直接调用 `Agent.stream()` 并实时输出每个 token
- **模拟 Mastra 的 suspend/resume 概念**：使用全局内存存储工作流状态，实现 Human in the Loop
- **自定义标记系统**：使用 HTML 注释标记来标识步骤边界和工作流状态

**优化后的用户体验**：

```
✅ 步骤 1：联网搜索
   正在搜索主题...
   使用 Tavily 搜索工具...
   找到 3 条相关结果：
   1. xxx
   2. yyy
   ✅ 搜索完成

✅ 步骤 2：文案创作
   开始构思文章结构...
   标题：xxxxx
   正在撰写内容...
   [实时显示每个字]
   ✅ 文案完成
   
⏸️ 是否需要为文案配图？
   [需要配图] [不需要配图]
```

---

## 技术选型分析

### Mastra Workflow 方案的局限性

#### 1. 事件级别的输出限制

Mastra 的 `workflow.stream()` 只提供工作流级别的事件：

```typescript
// Mastra workflow.stream() 的输出
for await (const event of workflowRun.stream()) {
  if (event.type === 'workflow-step-started') {
    // ✅ 可以看到：步骤开始
    console.log('步骤开始:', event.stepId);
  }
  
  if (event.type === 'workflow-step-completed') {
    // ✅ 可以看到：步骤结束 + 最终结果
    console.log('步骤完成:', event.stepId, event.output);
  }
  
  // ❌ 看不到：Agent 内部的流式输出
  // ❌ 看不到：工具调用过程
  // ❌ 看不到："正在搜索..."、"找到3条结果..." 等中间状态
}
```

#### 2. Agent 内部执行是黑盒

当一个 workflow 步骤调用 Agent 时：

```typescript
// Mastra workflow 定义
{
  id: 'web-search',
  execute: async ({ context }) => {
    // 这里调用 Agent
    const result = await webSearchAgent.generate([...]);
    return result;
  }
}
```

**问题**：
- ❌ 无法访问 `agent.stream()` 的 `textStream`
- ❌ 无法实时输出 Agent 的思考过程
- ❌ 无法显示工具调用的中间结果
- ✅ 只能获取最终的执行结果（在步骤完成后）

#### 3. 实际表现对比

| 用户看到的内容 | Mastra workflow.stream() | 混合方案 |
|--------------|-------------------------|---------|
| 步骤开始提示 | ✅ "步骤 1 开始" | ✅ "步骤 1: 联网搜索" |
| 执行过程 | ❌ 长时间空白等待 | ✅ "正在搜索...使用 Tavily...找到3条结果..." |
| 步骤完成提示 | ✅ "步骤 1 完成" | ✅ "搜索完成" |
| Agent 思考过程 | ❌ 完全不可见 | ✅ 实时流式输出 |
| 工具调用详情 | ❌ 不可见 | ✅ 完整显示 |

### 混合方案的优势

#### 1. 完全控制流式输出

```typescript
// 手动调用 Agent.stream() 获取实时输出
const searchStream = await webSearchAgent.stream([...]);

// ✅ 实时输出每个 token
for await (const chunk of searchStream.textStream) {
  writer.write({
    type: 'text-delta',
    delta: chunk,  // 实时发送给前端
  });
}
```

#### 2. 保留 Mastra 的概念模型

虽然不使用 `workflow.stream()`，但我们保留了 Mastra 的核心概念：

- **步骤系统**：每个步骤有明确的 ID、输入、输出
- **Suspend/Resume**：工作流可以暂停并等待外部输入
- **标记系统**：使用标记来标识步骤状态和边界

#### 3. 灵活性

- 可以自定义每个步骤的展示方式
- 可以添加自定义的进度提示
- 可以控制步骤编号和显示逻辑

---

## Human in the Loop 实现机制

### 数据流程图

```
┌─────────────────────────────────────────────────────────────┐
│                      初始请求                                │
│                   (用户: 写一篇AI文章)                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │  步骤 1: 联网搜索       │
        │  (Agent.stream())       │
        │  实时输出搜索过程       │
        └────────┬───────────────┘
                 │
                 ▼
        ┌────────────────────────┐
        │  步骤 2: 文案生成       │
        │  (Agent.stream())       │
        │  实时输出创作过程       │
        └────────┬───────────────┘
                 │
                 ▼
        ┌────────────────────────┐
        │   SUSPEND (暂停)        │
        │ ┌─────────────────────┐│
        │ │ 生成 runId          ││
        │ │ 保存数据到内存      ││
        │ │ 发送暂停标记        ││
        │ └─────────────────────┘│
        └────────┬───────────────┘
                 │
                 ▼
        ┌────────────────────────┐
        │   前端显示确认按钮      │
        │  [需要配图][不需要配图] │
        └────────┬───────────────┘
                 │
         ┌───────┴───────┐
         │               │
    用户选择        用户选择
    不需要配图      需要配图
         │               │
         ▼               ▼
   ┌─────────┐    ┌──────────────┐
   │步骤 3/3 │    │  步骤 3/5    │
   │文案优化 │    │图片提示词生成│
   └────┬────┘    └──────┬───────┘
        │                │
        │                ▼
        │         ┌──────────────┐
        │         │  步骤 4/5    │
        │         │  图片生成    │
        │         └──────┬───────┘
        │                │
        │                ▼
        │         ┌──────────────┐
        │         │  步骤 5/5    │
        │         │  图文混合    │
        │         └──────┬───────┘
        │                │
        └────────┬───────┘
                 │
                 ▼
        ┌────────────────────────┐
        │     最终结果输出        │
        └────────────────────────┘
```

### 关键实现点

#### 后端实现（app/api/chat/route.ts）

**核心函数**：

1. **`executeContentCreationWorkflowInStream()`**
   - 作用：初始执行工作流，执行前2个步骤后暂停
   - 职责：
     - 生成唯一的 `runId`
     - 手动调用 Agent.stream() 并实时输出
     - 保存中间数据到 `global.workflowRunData[runId]`
     - 发送暂停标记给前端

2. **`handleWorkflowResume()`**
   - 作用：处理 Resume 请求，根据用户选择执行不同分支
   - 职责：
     - 从 `global.workflowRunData[runId]` 读取数据
     - 根据 `needImages` 选择执行分支
     - 继续手动调用 Agent.stream() 并实时输出

3. **`global.workflowRunData`**
   - 作用：临时内存存储，保存工作流的中间状态
   - 结构：
     ```typescript
     {
       [runId: string]: {
         prompt: string;          // 用户原始输入
         searchResults: string;   // 搜索结果
         fullContent: string;     // 生成的文案
         timestamp: number;       // 时间戳
       }
     }
     ```
   - **问题**：服务器重启后数据丢失，多实例部署无法共享

#### 前端实现（app/(dashboard)/ai-chat/page.tsx）

**核心函数**：

1. **`handleResumeWorkflow()`**
   - 作用：用户点击确认按钮后，发送 Resume 请求
   - 实现：
     ```typescript
     const handleResumeWorkflow = async (runId: string, stepId: string, resumeData: any) => {
       const friendlyMessage = resumeData.needImages 
         ? '需要配图'
         : '不需要配图';
       
       sendMessage(
         { text: friendlyMessage },
         {
           body: {
             resumeWorkflow: { runId, stepId, resumeData },
           },
         }
       );
     };
     ```

2. **WorkflowMessageRenderer**
   - 作用：解析工作流标记并渲染 UI
   - 职责：
     - 解析 `<!--WORKFLOW_SUSPENDED-->` 标记
     - 显示确认按钮
     - 解析步骤标记并显示步骤卡片

### 标记系统详解

我们使用 HTML 注释标记来在流式输出中嵌入元数据，这些标记不会显示给用户，但前端可以解析它们来构建 UI。

#### 工作流级别标记

```html
<!--WORKFLOW_SUSPENDED-->
<!--WORKFLOW_RUN_ID:run_1768980770422_gogpofetq-->
<!--WORKFLOW_STEP_ID:human-confirmation-->
```

- **用途**：标记工作流已暂停，包含 runId 和 stepId
- **触发时机**：文案生成完成后
- **前端行为**：显示"需要配图"/"不需要配图"按钮

#### 步骤级别标记

**步骤开始**：
```html
<!--STEP:web-search:START:running-->步骤 1/2: 联网搜索
正在搜索相关信息...
<!--STEP:web-search:INPUT-->
```json
{"query": "AI技术发展", "purpose": "自媒体内容创作"}
```
<!--STEP:web-search:INPUT:END-->
```

**步骤输出（流式）**：
```html
<!--STEP:web-search:OUTPUT:STREAMING-->
正在搜索主题...
使用 Tavily 搜索工具...
找到 3 条相关结果：
1. xxx
2. yyy
<!--STEP:web-search:OUTPUT:STREAMING:END-->
```

**步骤结束**：
```html
<!--STEP:web-search:END:completed-->
```

#### 最终结果标记

```html
<!--FINAL_RESULT_START-->
## 最终内容

[文章内容...]

<!--FINAL_RESULT_END-->
```

---

## 完整实现示例

### 4.1 初始执行（Suspend）

**文件**：`app/api/chat/route.ts`

```typescript
/**
 * 在 stream 中执行文章创作工作流
 * 混合方案: 使用手动流式输出 + Mastra workflow suspend/resume
 */
async function executeContentCreationWorkflowInStream(
  writer: any, 
  textId: string, 
  prompt: string
) {
  console.log('[executeContentCreationWorkflowInStream] 开始执行');
  
  writer.write({
    type: 'text-delta',
    id: textId,
    delta: '**开始执行内容创作工作流**\n\n',
  });

  writer.write({
    type: 'text-delta',
    id: textId,
    delta: '工作流包含 2 个步骤: 联网搜索 → 文案生成 → 人工确认\n\n---\n\n',
  });

  try {
    // 生成唯一的 runId
    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('[executeContentCreationWorkflowInStream] 生成 runId:', runId);

    // ============================================================
    // 步骤 1: 联网搜索 (手动流式输出)
    // ============================================================
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
    
    // 🔑 关键：手动调用 Agent.stream() 获取实时输出
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
    
    // 🔑 关键：实时输出每个 token
    for await (const chunk of searchStream.textStream) {
      searchResults += chunk;
      writer.write({
        type: 'text-delta',
        id: textId,
        delta: chunk,  // 实时发送给前端
      });
    }

    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--STEP:${step1Id}:OUTPUT:STREAMING:END-->\n<!--STEP:${step1Id}:END:completed-->\n\n`,
    });

    // ============================================================
    // 步骤 2: 文案生成 (手动流式输出)
    // ============================================================
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

    // ============================================================
    // 🔑 关键：使用 Mastra workflow 的 suspend 概念
    // ============================================================
    console.log('[executeContentCreationWorkflowInStream] 准备 suspend 工作流');
    
    // 显示暂停标记
    writer.write({
      type: 'text-delta',
      id: textId,
      delta: `<!--WORKFLOW_SUSPENDED-->
<!--WORKFLOW_RUN_ID:${runId}-->
<!--WORKFLOW_STEP_ID:human-confirmation-->

`,
    });

    writer.write({
      type: 'text-delta',
      id: textId,
      delta: '**文案已生成完成!**\n\n是否需要为文案配图?\n\n',
    });

    // 🔑 关键：将数据保存到全局内存
    global.workflowRunData = global.workflowRunData || {};
    global.workflowRunData[runId] = {
      prompt,
      searchResults,
      fullContent,
      timestamp: Date.now(),
    };

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
```

### 4.2 Resume 处理

**文件**：`app/api/chat/route.ts`

```typescript
/**
 * 处理工作流 resume
 */
async function handleWorkflowResume(
  resumeInfo: { runId: string; stepId: string; resumeData: any },
  messages: UIMessage[]
) {
  console.log('[handleWorkflowResume] 开始 resume 工作流:', resumeInfo);

  try {
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

          // 🔑 关键：从内存中获取之前保存的数据
          const runData = global.workflowRunData?.[resumeInfo.runId];
          if (!runData) {
            throw new Error('无法找到工作流数据，请重新开始');
          }

          const { prompt, searchResults, fullContent } = runData;
          const { needImages } = resumeInfo.resumeData;

          console.log('[handleWorkflowResume] 用户选择:', needImages ? '需要配图' : '不需要配图');

          // ============================================================
          // 分支 A: 用户选择不需要配图
          // ============================================================
          if (!needImages) {
            writer.write({
              type: 'text-delta',
              id: textId,
              delta: '✅ 用户选择不需要配图\n\n**跳过:** 图片生成\n\n',
            });

            // 步骤 3/3: 文案优化（仅文案）
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

            // 显示最终内容
            writer.write({
              type: 'text-delta',
              id: textId,
              delta: '<!--FINAL_RESULT_START-->\n## 最终内容\n\n' + (finalContent || fullContent) + '\n<!--FINAL_RESULT_END-->',
            });

            writer.write({ type: 'text-end', id: textId });
            console.log('[handleWorkflowResume] 不需要配图，文案优化完成');
            
          // ============================================================
          // 分支 B: 用户选择需要配图
          // ============================================================
          } else {
            writer.write({
              type: 'text-delta',
              id: textId,
              delta: '✅ 用户选择需要配图\n\n',
            });

            // 步骤 3/5: 图片提示词生成
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
            let imagePrompts: Array<{ order: number; description: string; prompt: string; }> = [];
            try {
              const jsonMatch = imagePromptsText.match(/```json\s*([\s\S]*?)\s*```/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[1]);
                imagePrompts = parsed.imagePrompts || [];
              }
            } catch (e) {
              console.error('[步骤 3] 解析图片提示词失败:', e);
            }

            // 步骤 4/5: 图片生成
            // 步骤 5/5: 图文混合
            // ... (省略图片生成和图文混合的代码)
          }

          // 🔑 关键：清理已使用的数据
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
```

### 4.3 前端交互

**文件**：`app/(dashboard)/ai-chat/page.tsx`

```typescript
// 处理 workflow resume
const handleResumeWorkflow = async (
  runId: string, 
  stepId: string, 
  resumeData: any
) => {
  console.log('[ChatBotDemo] Resuming workflow:', { runId, stepId, resumeData });
  
  // 🔑 关键：使用友好的消息文本
  const friendlyMessage = resumeData.needImages 
    ? '需要配图'
    : '不需要配图';
  
  // 发送 resume 请求
  sendMessage(
    { 
      text: friendlyMessage,
    },
    {
      body: {
        resumeWorkflow: {
          runId,
          stepId,
          resumeData,
        },
      },
    }
  );
};
```

**文件**：`components/dashboard/WorkflowMessageRenderer.tsx`

```typescript
// 解析工作流暂停信息
const workflowSuspended = processedContent.includes('<!--WORKFLOW_SUSPENDED-->');
let workflowRunId = '';
let workflowStepId = '';

if (workflowSuspended) {
  const runIdMatch = processedContent.match(/<!--WORKFLOW_RUN_ID:([^>]+)-->/);
  const stepIdMatch = processedContent.match(/<!--WORKFLOW_STEP_ID:([^>]+)-->/);
  
  if (runIdMatch) workflowRunId = runIdMatch[1];
  if (stepIdMatch) workflowStepId = stepIdMatch[1];
}

const needsConfirmation = workflowSuspended && !confirmationHandled;

// 渲染确认按钮
{needsConfirmation && (
  <div className="rounded-lg border bg-card p-6 shadow-sm mt-6">
    <div className="space-y-4">
      <div className="prose prose-sm max-w-none">
        <p className="font-medium">文案已生成完成！</p>
        <p>是否需要为文案配图？</p>
      </div>
      
      <div className="flex gap-3 pt-2">
        <Button
          onClick={() => handleConfirmation(true)}
          disabled={isConfirming}
          className="flex-1 bg-black text-white hover:bg-gray-800"
        >
          {isConfirming ? (
            <>
              <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              处理中...
            </>
          ) : (
            <>
              <ImageIcon className="size-4 mr-2" />
              需要生图
            </>
          )}
        </Button>
        <Button
          onClick={() => handleConfirmation(false)}
          disabled={isConfirming}
          variant="outline"
          className="flex-1"
        >
          <XIcon className="size-4 mr-2" />
          不需要生图
        </Button>
      </div>
    </div>
  </div>
)}
```

---

## 架构问题与改进方向

### 当前问题

#### 1. 全局内存不可靠

**问题描述**：

使用 `global.workflowRunData` 存储工作流状态：

```typescript
global.workflowRunData = global.workflowRunData || {};
global.workflowRunData[runId] = {
  prompt,
  searchResults,
  fullContent,
  timestamp: Date.now(),
};
```

**存在的风险**：

- ❌ **服务器重启**：所有未完成的工作流数据丢失
- ❌ **多实例部署**：负载均衡时，Resume 请求可能路由到不同实例，找不到数据
- ❌ **内存泄漏**：长时间运行后，未清理的 runData 会占用大量内存
- ❌ **无持久化**：无法查询历史工作流状态

#### 2. 维护两套代码

**问题描述**：

虽然删除了 `mastra/workflows/content-creation-workflow.ts`，但我们实际上是**手动实现了完整的工作流逻辑**：

- 步骤定义和顺序
- 步骤之间的数据传递
- 错误处理
- 状态管理

这增加了维护成本，且容易出错。

#### 3. 不是真正的 Mastra workflow

**问题描述**：

我们失去了 Mastra workflow 框架的以下能力：

- ❌ **状态管理**：无法持久化工作流状态
- ❌ **错误恢复**：步骤失败后无法自动重试
- ❌ **工作流可视化**：无法在 Mastra 控制台查看工作流执行情况
- ❌ **版本管理**：无法追踪工作流定义的变化

### 改进建议

#### 方案 A: 保持混合方案 + Redis 持久化（推荐）

**描述**：

保持当前的手动流式输出方案，但将 `global.workflowRunData` 改为 **Redis 存储**。

**实现步骤**：

1. **安装 Redis 客户端**：
   ```bash
   npm install ioredis
   ```

2. **创建 Redis 工具**（`lib/redis.ts`）：
   ```typescript
   import Redis from 'ioredis';

   const redis = new Redis({
     host: process.env.REDIS_HOST || 'localhost',
     port: parseInt(process.env.REDIS_PORT || '6379'),
     password: process.env.REDIS_PASSWORD,
   });

   export async function saveWorkflowData(runId: string, data: any) {
     await redis.setex(
       `workflow:${runId}`,
       3600, // 1小时过期
       JSON.stringify(data)
     );
   }

   export async function getWorkflowData(runId: string) {
     const data = await redis.get(`workflow:${runId}`);
     return data ? JSON.parse(data) : null;
   }

   export async function deleteWorkflowData(runId: string) {
     await redis.del(`workflow:${runId}`);
   }
   ```

3. **修改代码使用 Redis**：
   ```typescript
   // 保存数据
   await saveWorkflowData(runId, {
     prompt,
     searchResults,
     fullContent,
     timestamp: Date.now(),
   });

   // 读取数据
   const runData = await getWorkflowData(resumeInfo.runId);
   if (!runData) {
     throw new Error('无法找到工作流数据，请重新开始');
   }

   // 清理数据
   await deleteWorkflowData(resumeInfo.runId);
   ```

**优点**：

- ✅ **数据可靠**：Redis 持久化，服务器重启不丢失
- ✅ **多实例支持**：所有实例共享 Redis，可以正确处理 Resume
- ✅ **保持用户体验**：继续享受流式输出的优势
- ✅ **TTL 自动清理**：设置过期时间，自动清理旧数据

**缺点**：

- ⚠️ **增加依赖**：需要部署和维护 Redis
- ⚠️ **仍需手动管理**：工作流逻辑仍需手动编写

**适用场景**：

- 用户体验优先
- 需要展示 Agent 的详细执行过程
- 有 Redis 基础设施

#### 方案 B: 迁移到真正的 Mastra workflow

**描述**：

使用真正的 Mastra `workflow.run()` 和 `workflow.suspend()`，但接受无法看到 Agent 内部流式输出的限制。

**实现步骤**：

1. **重新创建 workflow 定义**：
   ```typescript
   export const contentCreationWorkflow = new Workflow({
     name: 'content-creation-workflow',
     steps: [
       {
         id: 'web-search',
         execute: async ({ context }) => {
           const result = await webSearchAgent.generate([...]);
           return { searchResults: result.text };
         },
       },
       {
         id: 'content-creation',
         execute: async ({ context }) => {
           const result = await contentCreationAgent.generate([...]);
           return { fullContent: result.text };
         },
       },
       {
         id: 'human-confirmation',
         execute: async ({ context }) => {
           // 使用 Mastra 的 suspend
           return await workflow.suspend('human-confirmation');
         },
       },
       // ... 其他步骤
     ],
   });
   ```

2. **使用 Mastra 的 suspend/resume**：
   ```typescript
   // 初始执行
   const run = await contentCreationWorkflow.run({ prompt });
   
   // Resume
   await run.resume('human-confirmation', { needImages: true });
   ```

**优点**：

- ✅ **框架能力**：使用 Mastra 的状态管理和错误处理
- ✅ **代码简洁**：不需要手动管理工作流逻辑
- ✅ **可视化**：可以在 Mastra 控制台查看

**缺点**：

- ❌ **用户体验下降**：看不到 Agent 的思考过程，长时间等待
- ❌ **失去灵活性**：无法自定义步骤的展示方式

**适用场景**：

- 维护性优先
- 不需要展示 Agent 的详细执行过程
- 团队熟悉 Mastra 框架

---

## 方案对比

### 功能对比表

| 特性 | Mastra workflow.stream() | 当前混合方案 | 混合方案 + Redis | 真正的 Mastra workflow |
|------|-------------------------|-------------|-----------------|---------------------|
| **步骤开始/结束事件** | ✅ 支持 | ✅ 支持（手动模拟） | ✅ 支持（手动模拟） | ✅ 原生支持 |
| **Agent 内部流式输出** | ❌ 不支持 | ✅ 支持 | ✅ 支持 | ❌ 不支持 |
| **工具调用过程可见** | ❌ 不可见 | ✅ 可见 | ✅ 可见 | ❌ 不可见 |
| **用户体验** | ⚠️ 长时间等待 | ✅ 实时反馈 | ✅ 实时反馈 | ⚠️ 长时间等待 |
| **代码复杂度** | ✅ 简单 | ⚠️ 手动管理 | ⚠️ 手动管理 + Redis | ✅ 简单 |
| **数据可靠性** | ✅ 框架管理 | ❌ 全局内存 | ✅ Redis 持久化 | ✅ 框架管理 |
| **多实例支持** | ✅ 支持 | ❌ 不支持 | ✅ 支持 | ✅ 支持 |
| **Human in the Loop** | ✅ 原生支持 | ✅ 模拟实现 | ✅ 模拟实现 | ✅ 原生支持 |
| **错误恢复** | ✅ 框架支持 | ⚠️ 需手动实现 | ⚠️ 需手动实现 | ✅ 框架支持 |
| **工作流可视化** | ✅ 支持 | ❌ 不支持 | ❌ 不支持 | ✅ 支持 |

### 推荐决策树

```
┌─────────────────────────────────────┐
│  是否需要展示 Agent 的详细执行过程?   │
└──────────┬──────────────────────────┘
           │
     ┌─────┴─────┐
     │           │
    是          否
     │           │
     ▼           ▼
┌─────────┐  ┌──────────────┐
│混合方案  │  │Mastra workflow│
│+ Redis  │  │（方案 B）     │
│（推荐）  │  └──────────────┘
└─────────┘
     │
     ▼
┌──────────────────────┐
│ 是否需要多实例部署?   │
└──────┬───────────────┘
       │
  ┌────┴────┐
  │         │
 是        否
  │         │
  ▼         ▼
必须用    可以暂时用
Redis     global 内存
         （单实例场景）
```

---

## 参考资料

### Mastra 官方文档

- **Workflows**: https://mastra.ai/docs/workflows
- **Agents**: https://mastra.ai/docs/agents
- **Streaming**: https://mastra.ai/docs/streaming

### 项目文件

- **后端实现**: `app/api/chat/route.ts` (1591 行)
  - `executeContentCreationWorkflowInStream()`: 行 1407-1585
  - `handleWorkflowResume()`: 行 186-579
  
- **前端实现**: `app/(dashboard)/ai-chat/page.tsx` (340 行)
  - `handleResumeWorkflow()`: 行 137-160
  
- **UI 渲染**: `components/dashboard/WorkflowMessageRenderer.tsx` (372 行)
  - 步骤解析: 行 66-128
  - 确认按钮: 行 301-341

### 相关 Agent

- `mastra/agents/web-search-agent.ts`: 联网搜索 Agent
- `mastra/agents/content-creation-agent.ts`: 文案生成 Agent
- `mastra/agents/image-prompt-agent.ts`: 图片提示词生成 Agent
- `mastra/agents/content-mix-agent.ts`: 图文混合 Agent

---

## 附录：调试日志示例

### 成功的执行流程

```
[API /api/chat 被调用]
User prompt: 写一篇关于AI技术发展的文章

[executeContentCreationWorkflowInStream] 开始执行
[executeContentCreationWorkflowInStream] 生成 runId: run_1768980770422_gogpofetq

[步骤 1] 开始联网搜索
[步骤 1] Agent 输出: 正在搜索主题...使用 Tavily 搜索工具...
[步骤 1] 完成

[步骤 2] 开始文案生成
[步骤 2] Agent 输出: # AI技术发展...（实时流式输出）
[步骤 2] 完成

[executeContentCreationWorkflowInStream] 准备 suspend 工作流
[executeContentCreationWorkflowInStream] 工作流已暂停,等待用户确认

--- 用户点击"需要配图" ---

[handleWorkflowResume] 开始 resume 工作流
[handleWorkflowResume] 用户选择: 需要配图

[步骤 3] 开始解析图片提示词
[步骤 3] Agent 输出原文: { "imagePrompts": [...] }
[步骤 3] 最终解析结果 - 图片数量: 3

[步骤 4] 开始图片生成步骤
[步骤 4] 图片提示词数量: 3
[步骤 4] 开始生成第 1/3 张图片
[步骤 4] 图片 1 生成成功
[步骤 4] 开始生成第 2/3 张图片
...

[步骤 5] 开始图文混合
[步骤 5] Agent 输出: （混合后的内容）

[handleWorkflowResume] 配图流程完成
```

---

**文档版本**: 1.0  
**最后更新**: 2025-01-21  
**维护者**: 开发团队
