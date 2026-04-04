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
  const intentMatch = content.match(
    /<!--INTENT_RECOGNITION_START-->([\s\S]*?)<!--INTENT_RECOGNITION_END-->/
  );
  const intentRecognition = intentMatch ? intentMatch[1].trim() : null;
  
  // 从意图识别结果中提取 workflowType
  const intentTypeMatch = content.match(
    /<!--INTENT_RECOGNITION_START-->[\s\S]*?intent[\s\S]*?`(.*?)`/
  );
  const intent = intentTypeMatch ? intentTypeMatch[1] : null;
  
  // 提取 workflowType，支持多种格式
  // 注：content-creation 为文章创作工作流 resume 时存储的 workflowType
  let workflowType: 'social-media' | 'article' | null = null;
  if (intent === 'article-creation-workflow' || intent === 'article' || intent === 'content-creation') {
    workflowType = 'article';
  } else if (intent === 'social-media-post' || intent === 'social-media') {
    workflowType = 'social-media';
  }
  
  console.log('[WorkflowMessageRenderer] Intent recognition:', intentRecognition ? '找到' : '未找到');
  console.log('[WorkflowMessageRenderer] Intent:', intent);
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
      /<!--INTENT_RECOGNITION_START-->[\s\S]*?<!--INTENT_RECOGNITION_END-->/,
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
  const stepRegex =
    /<!--STEP:([^:]+):START:([^>]+)-->([\s\S]*?)(?:<!--STEP:\1:END:([^>]+)-->|$)/g;
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
  const finalResultMatch = processedContent.match(
    /<!--FINAL_RESULT_START-->([\s\S]*?)<!--FINAL_RESULT_END-->/
  );
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
  
  
  // 下载图片并转换为 File 对象
  const downloadImageAsFile = async (imageUrl: string, index: number): Promise<File | null> => {
    try {
      // 确定实际请求的 URL：优先通过同源代理拉取，避免 CORS 导致 fetch 失败
      // img 标签可正常显示跨域图片，但 fetch 会受 CORS 限制
      let fetchUrl: string;
      if (imageUrl.startsWith('/api/image-proxy')) {
        fetchUrl = `${window.location.origin}${imageUrl}`;
        console.log(`[downloadImageAsFile] 通过代理下载: ${fetchUrl}`);
      } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        // 外部 URL 通过我们的代理拉取，绕过 CORS
        fetchUrl = `${window.location.origin}/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
        console.log(`[downloadImageAsFile] 外部 URL 经代理下载: ${imageUrl}`);
      } else if (imageUrl.startsWith('/')) {
        fetchUrl = `${window.location.origin}${imageUrl}`;
      } else {
        fetchUrl = `${window.location.origin}/${imageUrl}`;
      }

      console.log(`[downloadImageAsFile] 开始下载图片 ${index + 1}: (原始: ${imageUrl})`);

      // 获取图片（添加错误处理和超时）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
      
      const response = await fetch(fetchUrl, {
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit',
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`[downloadImageAsFile] 下载图片失败: ${imageUrl}`, response.status, response.statusText);
        return null;
      }

      // 代理可能返回 JSON 错误
      const resContentType = response.headers.get('content-type') || '';
      if (resContentType.includes('application/json')) {
        const errData = await response.json().catch(() => ({}));
        console.error(`[downloadImageAsFile] 代理返回错误:`, errData);
        return null;
      }

      const blob = await response.blob();
      
      // 验证是否为图片
      if (!blob.type.startsWith('image/')) {
        console.error(`[downloadImageAsFile] 不是有效的图片类型: ${blob.type}`);
        return null;
      }
      
      // 从URL或Content-Type推断文件扩展名
      let extension = 'jpg';
      const contentType = blob.type;
      if (contentType.includes('png')) {
        extension = 'png';
      } else if (contentType.includes('gif')) {
        extension = 'gif';
      } else if (contentType.includes('webp')) {
        extension = 'webp';
      } else {
        // 尝试从URL提取扩展名
        const urlMatch = imageUrl.match(/\.(jpg|jpeg|png|gif|webp)/i);
        if (urlMatch) {
          extension = urlMatch[1].toLowerCase();
        }
      }

      // 创建 File 对象
      const fileName = `image-${index + 1}.${extension}`;
      const file = new File([blob], fileName, { type: blob.type });
      
      console.log(`[downloadImageAsFile] 成功下载图片 ${index + 1}: ${fileName}, 大小: ${file.size} bytes`);
      return file;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`[downloadImageAsFile] 下载图片超时: ${imageUrl}`);
      } else {
        console.error(`[downloadImageAsFile] 下载图片错误: ${imageUrl}`, error);
      }
      return null;
    }
  };

  // 处理跳转到编辑器（不创建草稿，只是跳转）
  const handleSaveDraft = async (data: { title: string; content: string; images: string[]; coverImage?: string; rawContent?: string }) => {
    console.log('[handleSaveDraft] 开始跳转到编辑器');
    console.log('[handleSaveDraft] Token exists:', !!token);
    
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
      // 下载并上传图片（图片需要先上传到服务器，因为编辑器需要访问）
      let uploadedImageUrls: string[] = [];
      
      if (data.images && data.images.length > 0) {
        toast.loading('正在下载图片...', { id: 'download-images' });
        
        // 下载所有图片
        const imageFiles: File[] = [];
        const failedUrls: string[] = [];
        
        for (let i = 0; i < data.images.length; i++) {
          const imageUrl = data.images[i];
          const file = await downloadImageAsFile(imageUrl, i);
          if (file) {
            imageFiles.push(file);
          } else {
            failedUrls.push(imageUrl);
            console.warn(`[handleSaveDraft] 图片 ${i + 1} 下载失败: ${imageUrl}`);
          }
        }
        
        // 如果部分图片下载成功，继续上传成功的图片
        if (imageFiles.length > 0) {
          toast.loading(`正在上传图片... (${imageFiles.length}/${data.images.length})`, { id: 'download-images' });
          
          // 上传图片到服务器
          const formData = new FormData();
          imageFiles.forEach((file) => {
            formData.append('images', file);
          });
          
          const uploadResponse = await fetch('/api/content/images/upload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData
          });
          
          const uploadResult = await uploadResponse.json();
          
          if (uploadResponse.ok && uploadResult.imageUrls) {
            uploadedImageUrls = uploadResult.imageUrls;
            
            // 如果有失败的图片，添加原始URL作为后备
            if (failedUrls.length > 0) {
              uploadedImageUrls = [...uploadedImageUrls, ...failedUrls];
              toast.success(`成功上传 ${uploadResult.imageUrls.length} 张图片，${failedUrls.length} 张使用原始URL`, { id: 'download-images' });
            } else {
              toast.success(`成功上传 ${uploadedImageUrls.length} 张图片`, { id: 'download-images' });
            }
          } else {
            console.error('[handleSaveDraft] 图片上传失败:', uploadResult.error);
            toast.error(uploadResult.error || '图片上传失败', { id: 'download-images' });
            // 如果上传失败，使用原始URL
            uploadedImageUrls = data.images;
          }
        } else {
          // 所有图片都下载失败，使用原始URL
          console.warn('[handleSaveDraft] 所有图片下载失败，使用原始URL');
          uploadedImageUrls = data.images;
          toast.warning('图片下载失败，将使用原始URL', { id: 'download-images' });
        }
      }
      
      // 处理封面图（与正文配图同源上传后的 URL）
      let coverImageUrl = data.coverImage?.trim() || undefined;
      if (coverImageUrl && uploadedImageUrls.length > 0) {
        // 如果封面图在图片列表中，使用对应的上传后的URL
        const coverIndex = data.images.indexOf(coverImageUrl);
        if (coverIndex >= 0 && coverIndex < uploadedImageUrls.length) {
          coverImageUrl = uploadedImageUrls[coverIndex];
        } else {
          // 封面可能是已上传的站内地址，或不在列表中：尝试按索引对齐，否则单独下载上传
          const coverInUploaded = uploadedImageUrls.includes(coverImageUrl);
          if (!coverInUploaded) {
            const coverFile = await downloadImageAsFile(coverImageUrl, 0);
            if (coverFile) {
              const coverFormData = new FormData();
              coverFormData.append('images', coverFile);
              const coverUploadResponse = await fetch('/api/content/images/upload', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`
                },
                body: coverFormData
              });
              const coverUploadResult = await coverUploadResponse.json();
              if (coverUploadResponse.ok && coverUploadResult.imageUrls && coverUploadResult.imageUrls.length > 0) {
                coverImageUrl = coverUploadResult.imageUrls[0];
              }
            }
          }
        }
      }
      // AI 文章仅有配图、未单独标封面时：用首张配图作为封面，编辑器打开即可直接展示
      if (!coverImageUrl && uploadedImageUrls.length > 0) {
        coverImageUrl = uploadedImageUrls[0];
      }
      
      // 确定 contentType
      const contentType = workflowType === 'social-media' ? 'image-text' : 'article';
      
      // 文章编辑器需要完整 Markdown（保留标题、加粗、列表等格式），仅替换图片 URL 为上传后的地址
      let finalContent: string;
      if (contentType === 'article' && data.rawContent) {
        finalContent = data.rawContent;
        if (uploadedImageUrls.length > 0) {
          let imageIndex = 0;
          finalContent = finalContent.replace(/!\[([^\]]*)\]\(([^\)]*)\)/g, (_match, alt, _url) => {
            const newUrl = uploadedImageUrls[imageIndex] ?? _url;
            imageIndex++;
            return `![${alt}](${newUrl})`;
          });
        }
      } else {
        finalContent = data.content;
      }
      
      // 将数据保存到 sessionStorage，供编辑器使用
      const editorData = {
        title: data.title,
        content: finalContent,
        images: uploadedImageUrls,
        coverImage: coverImageUrl,
        contentType: contentType,
        aiGenerated: true
      };
      
      sessionStorage.setItem('ai-generated-content', JSON.stringify(editorData));
      
      console.log('[handleSaveDraft] 跳转到编辑页, workflowType:', workflowType);
      console.log('[handleSaveDraft] ContentType:', contentType);
      
      // 根据工作流类型跳转（不因是否选择配图而改变）
      // social-media 工作流 → 图文编辑器（支持多张图片）
      // article 工作流 → 文章编辑器（支持封面图）
      if (workflowType === 'social-media') {
        router.push('/publish/create-image?from=ai');
      } else if (workflowType === 'article') {
        router.push('/publish/create-article?from=ai');
      } else {
        // workflowType 无法确定时，根据 contentType 判断
        if (contentType === 'image-text') {
          console.log('[handleSaveDraft] 根据 contentType 判断：使用图文编辑器');
          router.push('/publish/create-image?from=ai');
        } else {
          console.log('[handleSaveDraft] 根据 contentType 判断：使用文章编辑器');
          router.push('/publish/create-article?from=ai');
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
      .replace(/<!--FINAL_RESULT_START-->[\s\S]*?<!--FINAL_RESULT_END-->/, '')
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
