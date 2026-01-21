import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { WorkflowStep, StepStatus } from './WorkflowStep';
import { FinalResultCard } from './FinalResultCard';
import { Badge } from '@/components/ui/badge';
import { BrainIcon, SparklesIcon } from 'lucide-react';

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
}

/**
 * 解析包含工作流步骤标记的消息内容
 * 格式: <!--STEP:stepId:START:status-->...<!--STEP:stepId:END:status-->
 */
export function WorkflowMessageRenderer({ content }: WorkflowMessageRendererProps) {
  console.log('[WorkflowMessageRenderer] Parsing content, length:', content.length);
  console.log('[WorkflowMessageRenderer] Contains STEP marker:', content.includes('<!--STEP:'));
  
  // 先提取意图识别信息(在处理之前)
  const intentMatch = content.match(/<!--INTENT_RECOGNITION_START-->(.*?)<!--INTENT_RECOGNITION_END-->/s);
  const intentRecognition = intentMatch ? intentMatch[1].trim() : null;
  
  console.log('[WorkflowMessageRenderer] Intent recognition:', intentRecognition ? '找到' : '未找到');
  
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
    const inputMatch = stepContent.match(/<!--STEP:[^:]+:INPUT-->(.*?)<!--STEP:[^:]+:INPUT:END-->/s);
    const input = inputMatch ? inputMatch[1].trim() : undefined;
    
    console.log(`[WorkflowMessageRenderer] Step ${index + 1} input:`, input ? `${input.substring(0, 100)}...` : 'NOT FOUND');

    // 提取流式过程内容（支持未结束的流式输出）
    const streamingMatch = stepContent.match(/<!--STEP:[^:]+:OUTPUT:STREAMING-->(.*?)(?:<!--STEP:[^:]+:OUTPUT:STREAMING:END-->|$)/s);
    const streamingOutput = streamingMatch ? streamingMatch[1].trim() : undefined;
    
    // 提取最终输出结果
    const outputMatch = stepContent.match(/<!--STEP:[^:]+:OUTPUT-->(.*?)(?:<!--STEP:[^:]+:OUTPUT:END-->|$)/s);
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
    finalResult = finalResult.replace(/^##\s*📝\s*最终内容\s*\n+/i, '').trim();
  }
  
  console.log('[WorkflowMessageRenderer] Final result:', finalResult ? '找到' : '未找到');
  
  // 从剩余内容中移除最终结果标记
  if (finalResult) {
    remainingContent = remainingContent
      .replace(/<!--FINAL_RESULT_START-->.*?<!--FINAL_RESULT_END-->/s, '')
      .trim();
  }

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
                defaultOpen={step.status === 'running'}  // 只有执行中的步骤默认展开
              />
            );
          })}
        </div>
      )}

      {/* 渲染最终结果 - 使用专用卡片组件 */}
      {finalResult && (
        <FinalResultCard 
          content={finalResult} 
          wordCount={finalResult.length}
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
