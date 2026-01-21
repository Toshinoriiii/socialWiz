import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StepStatus = 'pending' | 'running' | 'completed' | 'error';

interface WorkflowStepProps {
  title: string;
  status: StepStatus;
  icon?: React.ReactNode;
  input?: React.ReactNode;
  output?: React.ReactNode;
  error?: string;
  defaultOpen?: boolean;
  className?: string;
}

const StatusIcon = ({ status }: { status: StepStatus }) => {
  switch (status) {
    case 'running':
      return <Loader2 className="size-4 animate-spin text-primary" />;
    case 'completed':
      return <CheckCircle2 className="size-4 text-green-600" />;
    case 'error':
      return <XCircle className="size-4 text-destructive" />;
    case 'pending':
    default:
      return <Clock className="size-4 text-muted-foreground" />;
  }
};

const StatusBadge = ({ status }: { status: StepStatus }) => {
  const styles = {
    pending: 'bg-muted text-muted-foreground border-muted',
    running: 'bg-primary/10 text-primary border-primary/20',
    completed: 'bg-green-50 text-green-700 border-green-200',
    error: 'bg-destructive/10 text-destructive border-destructive/20',
  };

  const labels = {
    pending: '等待中',
    running: '执行中',
    completed: '已完成',
    error: '失败',
  };

  return (
    <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', styles[status])}>
      {labels[status]}
    </span>
  );
};

export function WorkflowStep({
  title,
  status,
  icon,
  input,
  output,
  error,
  defaultOpen = false,
  className,
}: WorkflowStepProps) {
  // 使用 useEffect 同步 defaultOpen 和 status 变化
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  // 当 status 为 running 时自动展开，完成后自动收起
  useEffect(() => {
    if (status === 'running') {
      setIsOpen(true);
    } else if (status === 'completed') {
      // 完成后自动收起
      setIsOpen(false);
    } else if (status === 'error') {
      // 错误时保持展开
      setIsOpen(true);
    }
  }, [status]);

  // 手动切换展开/收起
  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className={cn('rounded-lg border bg-card overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={toggleOpen}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer"
      >
        {isOpen ? (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
        )}
        
        {icon || <StatusIcon status={status} />}
        
        <span className="flex-1 text-left text-sm font-medium text-foreground">{title}</span>
        
        <StatusBadge status={status} />
      </button>

      {/* Content */}
      {isOpen && (
        <div className="border-t">
          {/* Input */}
          {input && (
            <div className="p-3 bg-muted/30 border-b">
              <div className="text-xs font-medium text-muted-foreground mb-2">输入参数</div>
              <div className="text-sm text-foreground max-w-4xl">{input}</div>
            </div>
          )}

          {/* Output */}
          {output && !error && (
            <div className="p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">输出结果</div>
              <div className="text-sm text-foreground max-w-4xl overflow-x-auto">{output}</div>
            </div>
          )}
          
          {/* 正在运行，但还没有输出 */}
          {!output && !error && status === 'running' && (
            <div className="p-3 flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-sm">正在执行...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-destructive/10">
              <div className="text-xs font-medium text-destructive mb-2">错误信息</div>
              <div className="text-sm text-destructive font-mono max-w-4xl overflow-x-auto">{error}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
