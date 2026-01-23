import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { WorkflowStep, StepStatus } from './WorkflowStep';
import { FinalResultCard } from './FinalResultCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { BrainIcon, SparklesIcon, ImageIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

interface WorkflowStepData {
  id: string;
  title: string;
  status: StepStatus;
  input?: string;
  output?: string;
  streamingOutput?: string;  // 流式过程内容
  error?: string;
}

interface WorkflowMessageRendererProps {
  content: string;
  onResumeWorkflow?: (runId: string, stepId: string, resumeData: any) => Promise<void>; // 新增: workflow resume 回调
  token?: string; // JWT token
  router?: AppRouterInstance; // Next.js router
}

/**
 * 解析包含工作流步骤标记的消息内容
 * 格式: <!--STEP:stepId:START:status-->...<!--STEP:stepId:END:status-->
 */
export function WorkflowMessageRenderer({ content, onResumeWorkflow, token, router }: WorkflowMessageRendererProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmationHandled, setConfirmationHandled] = useState(false);
  
  console.log('[WorkflowMessageRenderer] Parsing content, length:', content.length);
  console.log('[WorkflowMessageRenderer] Contains STEP marker:', content.includes('<!--STEP:'));
  console.log('[WorkflowMessageRenderer] Contains WORKFLOW_SUSPENDED:', content.includes('<!--WORKFLOW_SUSPENDED-->'));
  
  // 先提取意图识别信息(在处理之前)
  const intentMatch = content.match(/<!--INTENT_RECOGNITION_START-->(.*?)<!--INTENT_RECOGNITION_END-->/s);
  const intentRecognition = intentMatch ? intentMatch[1].trim() : null;
  
  // 从意图识别结果中提取 workflowType
  const intentTypeMatch = content.match(/<!--INTENT_RECOGNITION_START-->.*?intent.*?`(.*?)`/s);
  const intent = intentTypeMatch ? intentTypeMatch[1] : null;
  
  const workflowType = intent === 'article-creation-workflow' ? 'article' 
    : intent === 'social-media-post' ? 'social-media' 
    : null;
  
  console.log('[WorkflowMessageRenderer] Intent recognition:', intentRecognition ? '找到' : '未找到');
  console.log('[WorkflowMessageRenderer] Workflow type:', workflowType);
  
  // 处理内容:如果出现了INTENT_RECOGNITION_START,则移除INTENT_RECOGNIZING部分
  let processedContent = content;
  if (processedContent.includes('<!--INTENT_RECOGNITION_START-->')) {
    processedContent = processedContent.replace(
      /<!--INTENT_RECOGNIZING_START-->[\s\S]*?<!--INTENT_RECOGNIZING_END-->/g,
      ''
    );
  }
  
  // 移除意图识别结果部分(在移除HTML标签之前)
  if (intentRecognition) {
    processedContent = processedContent.replace(
      /<!--INTENT_RECOGNITION_START-->.*?<!--INTENT_RECOGNITION_END-->/s,
      ''
    );
  }
  
  // 移除所有INTENT相关的HTML注释标签(但保留STEP等其他标记)
  processedContent = processedContent.replace(
    /<!--INTENT_(RECOGNIZING_START|RECOGNIZING_END|RECOGNITION_START|RECOGNITION_END)-->/g,
    ''
  );
  
  // 解析步骤标记(使用处理后的内容)
  const steps: WorkflowStepData[] = [];
  let remainingContent = processedContent;

  // 正则表达式匹配步骤标记(支持未完成的步骤)
  const stepRegex = /<!--STEP:([^:]+):START:([^>]+)-->(.*?)(?:<!--STEP:\1:END:([^>]+)-->|$)/gs;
  const matches = Array.from(processedContent.matchAll(stepRegex));
  
  console.log('[WorkflowMessageRenderer] Found steps:', matches.length);

  matches.forEach((match, index) => {
    const stepId = match[1];
    const startStatus = match[2] as StepStatus;
    const stepContent = match[3];
    const endStatus = match[4] as StepStatus | undefined;
    
    console.log(`[WorkflowMessageRenderer] Step ${index + 1}:`, {
      stepId,
      startStatus,
      endStatus,
      contentLength: stepContent.length,
    });

    // 提取输入
    const inputMatch = stepContent.match(new RegExp(`<!--STEP:${stepId}:INPUT-->(.*?)<!--STEP:${stepId}:INPUT:END-->`, 's'));
    const input = inputMatch ? inputMatch[1].trim() : undefined;
    
    console.log(`[WorkflowMessageRenderer] Step ${index + 1} input:`, input ? `${input.substring(0, 100)}...` : 'NOT FOUND');

    // 提取流式过程内容（支持未结束的流式输出）
    const streamingMatch = stepContent.match(new RegExp(`<!--STEP:${stepId}:OUTPUT:STREAMING-->(.*?)(?:<!--STEP:${stepId}:OUTPUT:STREAMING:END-->|$)`, 's'));
    const streamingOutput = streamingMatch ? streamingMatch[1].trim() : undefined;
    
    // 提取最终输出结果
    const outputMatch = stepContent.match(new RegExp(`<!--STEP:${stepId}:OUTPUT-->(.*?)(?:<!--STEP:${stepId}:OUTPUT:END-->|$)`, 's'));
    const output = outputMatch ? outputMatch[1].trim() : undefined;
    
    console.log(`[WorkflowMessageRenderer] Step ${index + 1} (${stepId}):`, {
      streaming: streamingOutput ? `Found (${streamingOutput.length} chars)` : 'NOT FOUND',
      output: output ? `Found (${output.length} chars)` : 'NOT FOUND',
      streamingPreview: streamingOutput ? streamingOutput.substring(0, 100) + '...' : null,
      outputPreview: output ? output.substring(0, 100) + '...' : null
    });

    // 提取标题（从内容中的第一行）
    const contentWithoutTags = stepContent
      .replace(/<!--STEP:[^>]+-->/g, '')
      .trim();
    const titleMatch = contentWithoutTags.match(/^([^\n]+)/);
    const title = titleMatch ? titleMatch[1].replace(/[🔍✍️🎨🖼️🎉⏳✅]/g, '').trim() : `步骤 ${stepId}`;

    steps.push({
      id: stepId,
      title,
      status: endStatus || startStatus,
      input,
      output,
      streamingOutput,
    });

    // 从剩余内容中移除这个步骤
    remainingContent = remainingContent.replace(match[0], '');
  });

  // 清理剩余内容中的所有步骤标记
  remainingContent = remainingContent
    .replace(/<!--STEP:[^>]+-->/g, '')
    .trim();
  
  console.log('[WorkflowMessageRenderer] Parsed steps:', steps.length);
  console.log('[WorkflowMessageRenderer] Remaining content length:', remainingContent.length);
  
  // 提取最终结果(使用处理后的内容)
  const finalResultMatch = processedContent.match(/<!--FINAL_RESULT_START-->(.*?)<!--FINAL_RESULT_END-->/s);
  let finalResult = finalResultMatch ? finalResultMatch[1].trim() : null;
  
  // 移除标题部分（如果存在）
  if (finalResult) {
    // 移除各种格式的标题
    finalResult = finalResult
      .replace(/^##\s*📝?\s*最终内容\s*\n+/i, '')
      .replace(/^##\s*最终内容\s*\n+/i, '')
      .replace(/^最终内容\s*\n+/i, '')
      .trim();
  }
  
  console.log('[WorkflowMessageRenderer] Final result:', finalResult ? '找到' : '未找到');
  console.log('[WorkflowMessageRenderer] Final result preview:', finalResult ? finalResult.substring(0, 200) : null);
  
  // 提取 workflow suspended 信息
  // 格式: <!--WORKFLOW_SUSPENDED:runId:stepId-->
  const workflowSuspendedMatch = processedContent.match(/<!--WORKFLOW_SUSPENDED:([^:]+):([^>]+)-->/);
  const workflowSuspended = !!workflowSuspendedMatch;
  let workflowRunId = '';
  let workflowStepId = '';
  
  if (workflowSuspendedMatch) {
    workflowRunId = workflowSuspendedMatch[1];
    workflowStepId = workflowSuspendedMatch[2];
    
    console.log('[WorkflowMessageRenderer] Workflow suspended:', {
      runId: workflowRunId,
      stepId: workflowStepId,
    });
  }
  
  const needsConfirmation = workflowSuspended && !confirmationHandled;
  
  console.log('[WorkflowMessageRenderer] Needs confirmation:', needsConfirmation);
  console.log('[WorkflowMessageRenderer] Workflow run ID:', workflowRunId);
  console.log('[WorkflowMessageRenderer] Workflow step ID:', workflowStepId);
  
  // 处理用户确认
  const handleConfirmation = async (needImages: boolean) => {
    setIsConfirming(true);
    setConfirmationHandled(true);
    
    try {
      console.log('[Confirmation] 调用 workflow resume:', {
        runId: workflowRunId,
        stepId: workflowStepId,
        resumeData: { needImages },
      });
      
      if (onResumeWorkflow) {
        // 调用父组件提供的 resume 回调
        await onResumeWorkflow(workflowRunId, workflowStepId, { needImages });
      } else {
        // 默认行为: 直接调用 API (不推荐,应由父组件处理)
        console.warn('[Confirmation] onResumeWorkflow 未提供，请在父组件中处理 resume');
      }
      
      setIsConfirming(false);
    } catch (error) {
      console.error('[Confirmation] Error:', error);
      setIsConfirming(false);
      setConfirmationHandled(false);
      alert(`操作失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };
  
  
  // 处理保存草稿
  const handleSaveDraft = async (data: { title: string; content: string; images: string[]; coverImage?: string }) => {
    console.log('[handleSaveDraft] 开始保存草稿');
    console.log('[handleSaveDraft] Token exists:', !!token);
    console.log('[handleSaveDraft] Token preview:', token ? token.substring(0, 20) + '...' : 'null');
    
    if (!token) {
      console.error('[handleSaveDraft] Token 不存在');
      toast.error('未登录，请先登录');
      return;
    }
    
    if (!router) {
      console.error('[handleSaveDraft] Router 不可用');
      toast.error('路由不可用');
      return;
    }
    
    try {
      console.log('[handleSaveDraft] 发送请求到 /api/content/draft');
      console.log('[handleSaveDraft] 数据:', { title: data.title.substring(0, 50), contentLength: data.content.length, imagesCount: data.images.length });
      
      const response = await fetch('/api/content/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: data.title,
          content: data.content,
          images: data.images,
          coverImage: data.coverImage,
          aiGenerated: true
        })
      });
      
      console.log('[handleSaveDraft] 响应状态:', response.status);
      
      const result = await response.json();
      console.log('[handleSaveDraft] 响应数据:', result);
      
      if (response.ok && result.draft?.id) {
        toast.success('草稿已保存');
        console.log('[handleSaveDraft] 跳转到编辑页, workflowType:', workflowType);
        
        // 根据类型跳转
        if (workflowType === 'social-media') {
          router.push(`/publish/create-image?id=${result.draft.id}`);
        } else {
          router.push(`/publish/create-article?id=${result.draft.id}`);
        }
      } else {
        console.error('[handleSaveDraft] 保存失败:', result.error);
        toast.error(result.error || '保存失败');
        
        // 如果是 token 错误，提示用户重新登录
        if (response.status === 401) {
          toast.error('登录已过期，请重新登录');
        }
      }
    } catch (error) {
      console.error('[handleSaveDraft] 请求错误:', error);
      toast.error('网络错误，请重试');
    }
  };
  
  
  // 从剩余内容中移除最终结果标记
  if (finalResult) {
    remainingContent = remainingContent
      .replace(/<!--FINAL_RESULT_START-->.*?<!--FINAL_RESULT_END-->/s, '')
      .trim();
  }
  
  // 移除 WORKFLOW 相关标记
  remainingContent = remainingContent
    .replace(/<!--WORKFLOW_SUSPENDED:[^>]+-->/g, '')
    .trim();

  return (
    <div className="space-y-6">
      {/* 显示意图识别 - shadcn 黑白简约风格 */}
      {intentRecognition && (
        <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background border">
            <BrainIcon className="size-4 text-muted-foreground" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">意图识别</span>
              <Badge variant="outline" className="gap-1 rounded-md px-2 py-0.5 text-xs font-normal">
                <SparklesIcon className="size-3" />
                AI 分析
              </Badge>
            </div>
            <div className="prose prose-sm max-w-none text-muted-foreground [&_strong]:text-foreground [&_em]:text-muted-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {intentRecognition}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}
      {/* 渲染工作流开始提示 */}
      {remainingContent.includes('开始执行内容创作工作流') && (
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {remainingContent.split('---')[0]}
          </ReactMarkdown>
        </div>
      )}

      {/* 渲染工作流步骤 - shadcn 风格 */}
      {steps.length > 0 && (
        <div className="space-y-2">
          {steps.map((step) => {
            // 总是显示流式过程内容（无论 running 还是 completed）
            const displayOutput = step.streamingOutput || step.output;
            
            console.log(`[WorkflowMessageRenderer] Rendering step ${step.id}:`, {
              status: step.status,
              hasStreamingOutput: !!step.streamingOutput,
              hasOutput: !!step.output,
              displayOutputLength: displayOutput?.length || 0
            });
            
            // 决定是否默认展开：
            // 1. running 状态的步骤
            // 2. 有输出内容的步骤（如图片生成、图文混合等）
            // 3. 图片生成步骤（image-generation）即使没有输出也要展开
            const shouldDefaultOpen = 
              step.status === 'running' || 
              !!displayOutput || 
              step.id === 'image-generation' ||
              step.id === 'content-mix';
            
            return (
              <WorkflowStep
                key={step.id}
                title={step.title}
                status={step.status}
                input={
                  step.input ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {step.input}
                      </ReactMarkdown>
                    </div>
                  ) : undefined
                }
                output={
                  displayOutput ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {displayOutput}
                      </ReactMarkdown>
                    </div>
                  ) : undefined
                }
                defaultOpen={shouldDefaultOpen}
              />
            );
          })}
        </div>
      )}

      {/* 渲染用户确认按钮 */}
      {needsConfirmation && (
        <div className="rounded-lg border bg-card p-6 shadow-sm mt-6">
          <div className="space-y-4">
            {/* 确认提示文本 */}
            <div className="prose prose-sm max-w-none">
              <p className="font-medium">文案已生成完成！</p>
              <p>是否需要为文案配图？</p>
            </div>
            
            {/* 确认按钮 */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => handleConfirmation(true)}
                disabled={isConfirming}
                className="flex-1 bg-black text-white hover:bg-gray-800 transition-all duration-150"
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
                className="flex-1 border-gray-300 text-black hover:bg-gray-100 transition-all duration-150"
              >
                <XIcon className="size-4 mr-2" />
                不需要生图
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 渲染最终结果 - 使用专用卡片组件 */}
      {finalResult && (
        <FinalResultCard 
          content={finalResult} 
          wordCount={finalResult.length}
          workflowType={workflowType}
          onSaveDraft={token && router ? handleSaveDraft : undefined}
        />
      )}

      {/* 渲染工作流完成后的其他内容 */}
      {remainingContent.includes('工作流执行完成') && (
        <div className="prose prose-sm max-w-none mt-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {remainingContent.split('---').slice(1).join('---')}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
