import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, FileText, Copy, Download } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface FinalResultCardProps {
  content: string;
  wordCount?: number;
}

export function FinalResultCard({ content, wordCount }: FinalResultCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-2 border-blue-500 bg-gradient-to-br from-blue-50/50 to-purple-50/50 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <CheckCircle2 className="size-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                📝 最终生成内容
                <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                  已完成
                </Badge>
              </CardTitle>
              <CardDescription className="text-gray-600 mt-1">
                工作流执行成功，以下是最终生成的内容
                {wordCount && ` · 共 ${wordCount} 字`}
              </CardDescription>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                copied
                  ? 'bg-green-100 text-green-700'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              )}
            >
              <Copy className="size-4" />
              {copied ? '已复制' : '复制'}
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Markdown 内容 */}
        <div className="prose prose-sm max-w-4xl bg-white rounded-lg p-6 shadow-sm border border-gray-200 overflow-x-auto">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // 自定义样式
              h1: ({ node, ...props }) => (
                <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-4 pb-2 border-b-2 border-blue-500" {...props} />
              ),
              h2: ({ node, ...props }) => (
                <h2 className="text-xl font-bold text-gray-900 mt-5 mb-3" {...props} />
              ),
              h3: ({ node, ...props }) => (
                <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2" {...props} />
              ),
              p: ({ node, ...props }) => (
                <p className="text-gray-700 leading-relaxed my-3" {...props} />
              ),
              ul: ({ node, ...props }) => (
                <ul className="list-disc list-inside space-y-2 my-4 text-gray-700" {...props} />
              ),
              ol: ({ node, ...props }) => (
                <ol className="list-decimal list-inside space-y-2 my-4 text-gray-700" {...props} />
              ),
              li: ({ node, ...props }) => (
                <li className="ml-4" {...props} />
              ),
              blockquote: ({ node, ...props }) => (
                <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 my-4" {...props} />
              ),
              code: ({ node, inline, ...props }: any) =>
                inline ? (
                  <code className="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono" {...props} />
                ) : (
                  <code className="block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4 font-mono text-sm" {...props} />
                ),
              a: ({ node, ...props }) => (
                <a className="text-blue-600 hover:text-blue-700 underline" {...props} />
              ),
              strong: ({ node, ...props }) => (
                <strong className="font-bold text-gray-900" {...props} />
              ),
              em: ({ node, ...props }) => (
                <em className="italic text-gray-700" {...props} />
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>

        {/* 底部提示 */}
        <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
          <FileText className="size-3" />
          <span>内容已生成，您可以直接复制使用或进一步编辑</span>
        </div>
      </CardContent>
    </Card>
  );
}
