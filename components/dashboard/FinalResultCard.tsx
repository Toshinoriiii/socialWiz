import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Copy, Save } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { stripMarkdownFromTitle } from '@/lib/utils/strip-markdown-title';
import { Button } from '@/components/ui/Button';

interface FinalResultCardProps {
  content: string;
  wordCount?: number;
  workflowType?: 'article' | 'social-media' | null;
  onSaveDraft?: (data: { title: string; content: string; images: string[]; coverImage?: string; rawContent?: string }) => void;
}

// 解析 Markdown 内容
const parseContent = (markdown: string) => {
  // 提取标题的多种方式：
  // 1. 从 Markdown 标题标记中提取（# 或 ##）
  let titleMatch = markdown.match(/^#\s+(.+)$/m) || markdown.match(/^##\s+(.+)$/m);
  let title = titleMatch ? stripMarkdownFromTitle(titleMatch[1]) : null;
  if (title === '') title = null;

  // 2. 如果没有 Markdown 标题，从第一行提取（无配图工作流的第一行是标题）
  if (!title) {
    // 移除所有 Markdown 图片语法后，提取第一行
    const contentWithoutImages = markdown.replace(/!\[[^\]]*\]\([^\)]*\)/g, '').trim();
    const firstLineMatch = contentWithoutImages.match(/^([^\n]+)/);
    if (firstLineMatch) {
      const firstLine = firstLineMatch[1].trim();
      const plainLine = stripMarkdownFromTitle(firstLine);
      // 清洗后以纯文本长度判断；排除分隔线
      if (
        plainLine.length >= 10 &&
        plainLine.length <= 100 &&
        !firstLine.startsWith('---')
      ) {
        title = plainLine;
      }
    }
  }

  // 3. 如果还是没有标题，使用默认值
  if (!title) {
    title = '未命名内容';
  }
  
  // 提取图片 URL（在去除格式之前）
  const imageRegex = /!\[.*?\]\((.*?)\)/g;
  const images: string[] = [];
  let match;
  while ((match = imageRegex.exec(markdown)) !== null) {
    const url = match[1];
    // 过滤掉占位符URL（如"图片URL1"、"图片URL2"等）
    // 只保留真实的URL（以http://、https://、/api/、/content-images/开头）
    if (url && (
      url.startsWith('http://') || 
      url.startsWith('https://') || 
      url.startsWith('/api/') || 
      url.startsWith('/content-images/') ||
      url.startsWith('data:')
    )) {
      images.push(url);
    }
  }
  
  // 从代理URL中提取原始URL（如果存在）
  // 代理URL格式：/api/image-proxy?url=https%3A%2F%2F...
  const extractedImages: string[] = [];
  for (const imgUrl of images) {
    if (imgUrl.startsWith('/api/image-proxy')) {
      try {
        const urlObj = new URL(imgUrl, 'http://dummy');
        const originalUrl = urlObj.searchParams.get('url');
        if (originalUrl) {
          extractedImages.push(decodeURIComponent(originalUrl));
        } else {
          // 如果无法提取，保留代理URL（下载时会处理）
          extractedImages.push(imgUrl);
        }
      } catch (e) {
        // 如果解析失败，保留原URL
        extractedImages.push(imgUrl);
      }
    } else {
      // 非代理URL，直接使用
      extractedImages.push(imgUrl);
    }
  }
  
  // 也尝试从文本中提取原始URL（格式化Agent可能在文本中包含了原始URL）
  const originalUrlRegex = /原始URL[：:]\s*(https?:\/\/[^\s\n]+)/gi;
  let urlMatch;
  while ((urlMatch = originalUrlRegex.exec(markdown)) !== null) {
    const originalUrl = urlMatch[1];
    if (originalUrl && !extractedImages.includes(originalUrl)) {
      extractedImages.push(originalUrl);
    }
  }
  
  // 过滤掉所有占位符URL（如"图片URL1"、"图片URL2"等）
  const finalImages = extractedImages.filter(url => {
    // 只保留真实的URL
    return url && (
      url.startsWith('http://') || 
      url.startsWith('https://') || 
      url.startsWith('/api/image-proxy') || 
      url.startsWith('/content-images/') ||
      url.startsWith('data:')
    ) && !url.includes('图片URL') && !url.includes('图片url');
  });
  
  console.log('[parseContent] 提取的图片URL:', {
    fromMarkdown: images,
    extracted: extractedImages,
    final: finalImages
  });
  
  // 提取第一张图片作为封面(文章类型)
  const coverImage = finalImages.length > 0 ? finalImages[0] : undefined;
  
  // 移除所有 Markdown 格式，只保留纯文本
  let contentText = markdown;
  
  // 1. 移除图片 Markdown 语法（包括换行）
  contentText = contentText.replace(/!\[[^\]]*\]\([^\)]*\)/g, '');
  contentText = contentText.replace(/!\[[^\]]*\]\([^\)]*\)\s*\n?/g, '');
  
  // 2. 移除标题标记（# ## ### 等），但保留标题文本
  contentText = contentText.replace(/^#{1,6}\s+(.+)$/gm, '$1');
  
  // 2.5. 如果提取了标题，从内容中移除标题行（避免重复）
  if (title && title !== '未命名内容') {
    // 移除第一行如果是标题（与已清洗的纯文本标题比对）
    const lines = contentText.split('\n');
    const rawFirst = lines[0]?.trim() || '';
    const firstPlain = stripMarkdownFromTitle(rawFirst.replace(/^#{1,6}\s+/, ''));
    if (
      rawFirst &&
      (firstPlain === title ||
        firstPlain.includes(title.substring(0, Math.min(20, title.length))) ||
        title.includes(firstPlain.substring(0, Math.min(20, firstPlain.length))))
    ) {
      // 移除第一行和可能的空行
      let startIndex = 1;
      while (startIndex < lines.length && lines[startIndex].trim() === '') {
        startIndex++;
      }
      contentText = lines.slice(startIndex).join('\n');
    }
  }
  
  // 3. 移除加粗和斜体标记（多次处理确保去除嵌套）
  contentText = contentText.replace(/\*\*\*(.*?)\*\*\*/g, '$1'); // 粗斜体
  contentText = contentText.replace(/\*\*(.*?)\*\*/g, '$1'); // 加粗
  contentText = contentText.replace(/\*(.*?)\*/g, '$1'); // 斜体
  contentText = contentText.replace(/___(.*?)___/g, '$1'); // 粗斜体
  contentText = contentText.replace(/__(.*?)__/g, '$1'); // 加粗
  contentText = contentText.replace(/_(.*?)_/g, '$1'); // 斜体
  
  // 4. 移除链接，保留链接文本
  contentText = contentText.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
  
  // 5. 移除代码块（包括多行代码块）
  contentText = contentText.replace(/```[\s\S]*?```/g, '');
  contentText = contentText.replace(/`([^`]+)`/g, '$1');
  
  // 6. 移除列表标记（包括有序和无序列表）
  contentText = contentText.replace(/^[\s]*[-*+]\s+/gm, '');
  contentText = contentText.replace(/^[\s]*\d+\.\s+/gm, '');
  
  // 7. 移除引用标记
  contentText = contentText.replace(/^>\s+/gm, '');
  
  // 8. 移除分隔线（---、___、***）
  contentText = contentText.replace(/^[-_*]{3,}$/gm, '');
  
  // 9. 移除 HTML 标签（如果有）
  contentText = contentText.replace(/<[^>]+>/g, '');
  
  // 10. 移除 HTML 注释
  contentText = contentText.replace(/<!--[\s\S]*?-->/g, '');
  
  // 10.5. 删除配图建议部分（如果存在）
  // 匹配 "配图建议" 或 "**配图建议**" 及其后面的所有内容，直到下一个部分或文档结束
  // 支持多种格式：**配图建议**、配图建议：、配图建议等
  contentText = contentText.replace(/\*\*配图建议\*\*[\s\S]*?(?=\n\n|\*\*|$)/gi, '');
  contentText = contentText.replace(/配图建议[：:][\s\S]*?(?=\n\n|\*\*|$)/gi, '');
  contentText = contentText.replace(/^配图建议[\s\S]*?(?=\n\n|\*\*|$)/gim, '');
  
  // 10.6. 移除图片描述和原始URL文本（格式化Agent可能在文末添加了图片描述）
  // 匹配格式：图片1 - 描述...原始URL: https://... 或 图片1：描述...原始URL: https://...
  contentText = contentText.replace(/图片\d+[：:\s-]+[^\n]*原始URL[：:]\s*https?:\/\/[^\s\n]+/gi, '');
  contentText = contentText.replace(/图片\d+[：:\s-]+[^\n]*原始url[：:]\s*https?:\/\/[^\s\n]+/gi, '');
  // 匹配单独的图片描述行（图片1 - 描述...）
  contentText = contentText.replace(/^图片\d+[：:\s-]+[^\n]+$/gim, '');
  // 匹配单独的原始URL行
  contentText = contentText.replace(/^原始URL[：:]\s*https?:\/\/[^\s\n]+$/gim, '');
  contentText = contentText.replace(/^原始url[：:]\s*https?:\/\/[^\s\n]+$/gim, '');
  
  // 11. 保留标签格式（#tag格式，通常在行尾）
  // 注意：不删除#标签，保留行尾或单独一行的#标签（如 #打工人必备）
  // 这些标签是内容的一部分，不应该被删除
  
  // 12. 移除行首的特殊标记和emoji（如 ✅、👉 等）
  // 匹配行首的emoji或特殊字符，后面可能有空格
  contentText = contentText.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}✅👉❌⚠️💡🎉👏💼✨😭]\s*/gmu, '');
  
  // 13. 再次处理加粗标记（确保所有嵌套的加粗都被移除）
  contentText = contentText.replace(/\*\*(.*?)\*\*/g, '$1');
  contentText = contentText.replace(/\*(.*?)\*/g, '$1');
  
  // 14. 清理多余的空行（连续 3 个以上的\n 改为 2 个\n）
  contentText = contentText.replace(/\n{3,}/g, '\n\n');
  
  // 15. 移除每行开头和结尾的空白字符
  contentText = contentText.split('\n').map(line => line.trim()).join('\n');
  
  // 16. 移除开头和结尾的空行
  contentText = contentText.trim();
  
  return { 
    title, 
    content: contentText,  // 纯文本内容（不含任何格式）
    images: finalImages,   // 图片 URL 数组（已提取原始URL）
    coverImage             // 第一张图片作为封面
  };
};

export function FinalResultCard({ content, wordCount, workflowType, onSaveDraft }: FinalResultCardProps) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // 解析内容，提取标题和正文
  const parsedData = parseContent(content);
  
  // 如果第一行是标题，从显示内容中移除标题行
  const displayContent = (() => {
    if (parsedData.title && parsedData.title !== '未命名内容') {
      const lines = content.split('\n');
      const rawFirst = lines[0]?.trim() || '';
      const firstPlain = stripMarkdownFromTitle(rawFirst.replace(/^#{1,6}\s+/, ''));
      if (
        rawFirst &&
        (firstPlain === parsedData.title ||
          firstPlain.includes(
            parsedData.title.substring(0, Math.min(30, parsedData.title.length))
          ) ||
          parsedData.title.includes(
            firstPlain.substring(0, Math.min(30, firstPlain.length))
          ))
      ) {
        // 移除第一行和可能的空行
        let startIndex = 1;
        while (startIndex < lines.length && lines[startIndex].trim() === '') {
          startIndex++;
        }
        return lines.slice(startIndex).join('\n');
      }
    }
    return content;
  })();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveDraft = async () => {
    if (!onSaveDraft) return;
    
    setSaving(true);
    try {
      console.log('[FinalResultCard] 原始内容:', content.substring(0, 500));
      console.log('[FinalResultCard] 解析后的数据:', {
        title: parsedData.title,
        contentLength: parsedData.content.length,
        contentPreview: parsedData.content.substring(0, 500),
        imagesCount: parsedData.images.length,
        images: parsedData.images
      });
      // 文章编辑器需要完整 Markdown（含 ![image](url)），传递 rawContent
      await onSaveDraft({ ...parsedData, rawContent: content });
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
                {saving ? '准备中...' : '继续编辑'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          {/* 如果有标题，先显示标题 */}
          {parsedData.title && parsedData.title !== '未命名内容' && (
            <h2 className="scroll-m-20 text-2xl font-semibold tracking-tight mb-4 border-b pb-2">
              {parsedData.title}
            </h2>
          )}
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
            {displayContent}
          </ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  );
}
