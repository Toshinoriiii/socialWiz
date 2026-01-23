import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Copy, Save } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface FinalResultCardProps {
  content: string;
  wordCount?: number;
  workflowType?: 'article' | 'social-media' | null;
  onSaveDraft?: (data: { title: string; content: string; images: string[]; coverImage?: string }) => void;
}

// 解析 Markdown 内容
const parseContent = (markdown: string) => {
  // 提取第一个 h1/h2 作为标题
  const titleMatch = markdown.match(/^#\s+(.+)$/m) || markdown.match(/^##\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : '未命名内容';
  
  // 提取图片 URL
  const imageRegex = /!\[.*?\]\((.*?)\)/g;
  const images: string[] = [];
  let match;
  while ((match = imageRegex.exec(markdown)) !== null) {
    images.push(match[1]);
  }
  
  // 提取第一张图片作为封面(文章类型)
  const coverImage = images.length > 0 ? images[0] : undefined;
  
  // 移除 Markdown 图片语法，保留纯文本内容
  let contentText = markdown;
  
  // 1. 移除图片 Markdown 语法
  contentText = contentText.replace(/!\[.*?\]\(.*?\)/g, '');
  
  // 2. 移除分隔线（---）
  contentText = contentText.replace(/^---$/gm, '');
  
  // 3. 清理多余的空行（连续 3 个以上的\n 改为 2 个\n）
  contentText = contentText.replace(/\n{3,}/g, '\n\n');
  
  // 4. 移除开头和结尾的空行
  contentText = contentText.trim();
  
  return { 
    title, 
    content: contentText,  // 纯文本内容（不含图片）
    images,                // 图片 URL 数组
    coverImage             // 第一张图片作为封面
  };
};

export function FinalResultCard({ content, wordCount, workflowType, onSaveDraft }: FinalResultCardProps) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveDraft = async () => {
    if (!onSaveDraft) return;
    
    setSaving(true);
    try {
      const parsedData = parseContent(content);
      await onSaveDraft(parsedData);
    } catch (error) {
      console.error('保存草稿失败:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-muted/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background">
              <CheckCircle2 className="size-4 text-primary" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold">最终生成内容</CardTitle>
              <CardDescription>
                {wordCount && `共 ${wordCount} 字`}
              </CardDescription>
            </div>
          </div>

          <div className="flex gap-2">
            {onSaveDraft && workflowType && (
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveDraft}
                disabled={saving}
                className="gap-2 bg-black text-white hover:bg-gray-800"
              >
                <Save className="size-3.5" />
                {saving ? '保存中...' : '保存到草稿并继续编辑'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ node, ...props }) => (
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight" {...props} />
              ),
              h2: ({ node, ...props }) => (
                <h2 className="scroll-m-20 text-2xl font-semibold tracking-tight" {...props} />
              ),
              h3: ({ node, ...props }) => (
                <h3 className="scroll-m-20 text-xl font-semibold tracking-tight" {...props} />
              ),
              h4: ({ node, ...props }) => (
                <h4 className="scroll-m-20 text-lg font-semibold tracking-tight" {...props} />
              ),
              p: ({ node, ...props }) => (
                <p className="leading-7 [&:not(:first-child)]:mt-4" {...props} />
              ),
              ul: ({ node, ...props }) => (
                <ul className="my-4 ml-6 list-disc [&>li]:mt-2" {...props} />
              ),
              ol: ({ node, ...props }) => (
                <ol className="my-4 ml-6 list-decimal [&>li]:mt-2" {...props} />
              ),
              blockquote: ({ node, ...props }) => (
                <blockquote className="mt-4 border-l-2 border-muted-foreground/20 pl-6 italic text-muted-foreground" {...props} />
              ),
              code: ({ node, inline, ...props }: any) =>
                inline ? (
                  <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold" {...props} />
                ) : (
                  <code className="relative block rounded-lg border bg-muted p-4 font-mono text-sm" {...props} />
                ),
              a: ({ node, ...props }) => (
                <a className="font-medium text-primary underline underline-offset-4" {...props} />
              ),
              strong: ({ node, ...props }) => (
                <strong className="font-semibold" {...props} />
              ),
              img: ({ node, ...props }) => (
                <img className="rounded-lg border" {...props} />
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  );
}
