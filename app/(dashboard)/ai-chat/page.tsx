'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { CopyIcon, RefreshCcwIcon, Sparkles, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputButton,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input';
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources';
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning';
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool';
import { Loader } from '@/components/ai-elements/loader';
import { Suggestions, Suggestion } from '@/components/ai-elements/suggestion';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { WorkflowStep } from '@/components/dashboard/WorkflowStep';
import { WorkflowMessageRenderer } from '@/components/dashboard/WorkflowMessageRenderer';

const quickSuggestions = [
  '写一篇关于 AI 技术发展的文章',
  '创作一篇小红书风格的产品推荐',
  '生成一篇微信公众号深度文章',
  '写一篇关于生活方式的感悟',
];

// 提取消息内容（参考 ops-ai-app）
const getMessageContent = (message: any) => {
  return (
    message.parts
      ?.map((part: any) => {
        if (part.type === 'text') return part.text;
        return '';
      })
      .join('') || ''
  );
};

const ChatBotDemo = () => {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status, regenerate, setMessages } = useChat({
    api: '/api/chat',
    onFinish: (message) => {
      console.log('[Frontend] Message finished:', message);
    },
    onError: (error) => {
      console.error('[Frontend] Chat error:', error);
    },
  });

  // 测试：显示 messages 的长度
  console.log('[Frontend] Messages count:', messages.length);
  console.log('[Frontend] Status:', status);

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);
    if (!(hasText || hasAttachments)) {
      return;
    }

    console.log('[Frontend] Submitting message:', message);

    // 发送消息，使用内容创作工作流
    sendMessage(
      { 
        text: message.text || 'Sent with attachments',
        files: message.files,
      },
      {
        body: {
          useWorkflow: true, // 使用工作流
        },
      }
    );
    setInput('');
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  return (
    <div className="bg-gray-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4 md:space-y-6">
        {/* 快速建议卡片 */}
        {messages.length === 0 && (
          <Card className="border border-gray-300 bg-white">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-black flex items-center gap-2">
                <FileText className="size-4" />
                AI 内容创作助手
              </CardTitle>
              <CardDescription className="text-gray-600">
                输入你想创作的内容主题，AI 将自动搜索、生成文案、配图并混合成最终内容
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suggestions>
                {quickSuggestions.map((suggestion, index) => (
                  <Suggestion
                    key={index}
                    suggestion={suggestion}
                    onClick={handleSuggestionClick}
                    variant="outline"
                    className="border-gray-300 text-black hover:bg-gray-100 transition-all duration-150"
                  />
                ))}
              </Suggestions>
            </CardContent>
          </Card>
        )}

        {/* 聊天对话区域 */}
        <Card className="border border-gray-300 bg-white">
          <CardContent className="p-0">
            <div className="flex flex-col h-[calc(100vh-280px)] md:h-[600px] min-h-[400px]">
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mb-4">
                        <FileText className="size-8 text-blue-600" />
                      </div>
                      <p className="text-gray-800 mb-2 font-medium">开始 AI 内容创作</p>
                      <p className="text-sm text-gray-500">输入你的内容主题，AI 将为你生成完整的图文内容</p>
                    </div>
                  ) : (
                    messages.map((message, index) => {
                      const content = getMessageContent(message);
                      const isUser = message.role === 'user';
                      const isLastMessage = index === messages.length - 1;
                      const isStreamingMessage = isLastMessage && status === 'streaming';

                      return (
                        <div key={message.id} className="flex gap-4 group mb-6">
                          {/* Avatar */}
                          {!isUser ? (
                            <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                              <FileText className="size-4 text-blue-600" />
                            </div>
                          ) : (
                            <div className="h-8 w-8 shrink-0"></div>
                          )}

                          {/* 内容 */}
                          <div className="flex-1 space-y-2">
                            <div className={cn('flex items-center gap-2', isUser && 'flex-row-reverse')}>
                              <span className="text-sm font-medium text-gray-700">
                                {isUser ? '你' : 'AI 助手'}
                              </span>
                            </div>

                            <div
                              className={cn(
                                'rounded-lg text-sm',
                                isUser
                                  ? 'bg-blue-600 text-white p-4 ml-auto max-w-fit'
                                  : 'bg-gray-50 p-4 text-gray-900'
                              )}
                            >
                              {isUser ? (
                                <div className="whitespace-pre-wrap">{content}</div>
                              ) : !content && isStreamingMessage ? (
                                <div className="flex items-center gap-2 text-gray-500">
                                  <Loader className="size-4 animate-spin" />
                                  <span>正在生成...</span>
                                </div>
                              ) : (
                                // 检测是否包含工作流标记
                                (() => {
                                  const hasStepMarker = content.includes('<!--STEP:');
                                  console.log('[ChatMessage] Checking content:', {
                                    messageId: message.id,
                                    contentLength: content.length,
                                    hasStepMarker,
                                    contentPreview: content.substring(0, 100),
                                  });
                                  
                                  return hasStepMarker ? (
                                    <WorkflowMessageRenderer content={content} />
                                  ) : (
                                    <div className="prose prose-sm max-w-none">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {content || '正在生成...'}
                                      </ReactMarkdown>
                                    </div>
                                  );
                                })()
                              )}
                            </div>

                            {/* 复制按钮 */}
                            {!isUser && content && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => navigator.clipboard.writeText(content)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-gray-100 rounded"
                                  title="复制"
                                >
                                  <CopyIcon className="size-4 text-gray-600" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* 用户头像 */}
                          {isUser && (
                            <div className="h-8 w-8 shrink-0 rounded-full bg-blue-600 flex items-center justify-center">
                              <span className="text-white text-xs font-medium">你</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              
              <Separator className="bg-gray-300" />
              
              {/* 输入区域 */}
              <div className="p-4">
                <PromptInput onSubmit={handleSubmit} globalDrop multiple>
                  <PromptInputHeader>
                    <PromptInputAttachments>
                      {(attachment) => <PromptInputAttachment data={attachment} />}
                    </PromptInputAttachments>
                  </PromptInputHeader>
                  <PromptInputBody>
                    <PromptInputTextarea
                      onChange={(e) => setInput(e.target.value)}
                      value={input}
                      placeholder="输入你想创作的内容主题，例如：写一篇关于 AI 技术发展的文章..."
                    />
                  </PromptInputBody>
                  <PromptInputFooter>
                    <PromptInputTools>
                      <PromptInputActionMenu>
                        <PromptInputActionMenuTrigger />
                        <PromptInputActionMenuContent>
                          <PromptInputActionAddAttachments />
                        </PromptInputActionMenuContent>
                      </PromptInputActionMenu>
                    </PromptInputTools>
                    <PromptInputSubmit disabled={!input && !status} status={status} />
                  </PromptInputFooter>
                </PromptInput>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ChatBotDemo;