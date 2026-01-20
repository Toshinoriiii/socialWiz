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
      return <Loader2 className="size-4 animate-spin text-blue-600" />;
    case 'completed':
      return <CheckCircle2 className="size-4 text-green-600" />;
    case 'error':
      return <XCircle className="size-4 text-red-600" />;
    case 'pending':
    default:
      return <Clock className="size-4 text-gray-400" />;
  }
};

const StatusBadge = ({ status }: { status: StepStatus }) => {
  const styles = {
    pending: 'bg-gray-100 text-gray-600',
    running: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
  };

  const labels = {
    pending: '等待中',
    running: '执行中',
    completed: '已完成',
    error: '失败',
  };

  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', styles[status])}>
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
    <div className={cn('border border-gray-200 rounded-lg overflow-hidden bg-white', className)}>
      {/* Header */}
      <button
        onClick={toggleOpen}
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        {isOpen ? (
          <ChevronDown className="size-4 text-gray-600 shrink-0" />
        ) : (
          <ChevronRight className="size-4 text-gray-600 shrink-0" />
        )}
        
        {icon || <StatusIcon status={status} />}
        
        <span className="flex-1 text-left font-medium text-gray-900">{title}</span>
        
        <StatusBadge status={status} />
      </button>

      {/* Content */}
      {isOpen && (
        <div className="border-t border-gray-200">
          {/* Input */}
          {input && (
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <div className="text-xs font-medium text-gray-500 mb-2">输入参数</div>
              <div className="text-sm text-gray-700 max-w-4xl">{input}</div>
            </div>
          )}

          {/* Output */}
          {output && !error && (
            <div className="p-4">
              <div className="text-xs font-medium text-gray-500 mb-2">输出结果</div>
              <div className="text-sm text-gray-900 max-w-4xl overflow-x-auto">{output}</div>
            </div>
          )}
          
          {/* 正在运行，但还没有输出 */}
          {!output && !error && status === 'running' && (
            <div className="p-4 flex items-center gap-2 text-gray-500">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-sm">正在执行...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50">
              <div className="text-xs font-medium text-red-600 mb-2">错误信息</div>
              <div className="text-sm text-red-700 font-mono max-w-4xl overflow-x-auto">{error}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
