import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Copy } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

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

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-2"
          >
            <Copy className="size-3.5" />
            {copied ? '已复制' : '复制'}
          </Button>
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
