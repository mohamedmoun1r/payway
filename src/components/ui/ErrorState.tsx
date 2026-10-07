import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'حدث خطأ أثناء تحميل البيانات',
  message = 'تعذر الاتصال بالخادم أو جلب المعلومات المطلوبة. يرجى إعادة المحاولة.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50/40 p-10 text-center',
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-3 ring-6 ring-red-50">
        <AlertCircle className="h-6 w-6 stroke-[2]" />
      </div>
      <h3 className="text-base font-bold text-red-900">{title}</h3>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-red-700/80 mb-5">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" icon={<RotateCcw className="w-3.5 h-3.5" />} onClick={onRetry}>
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}
