import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface ErrorStateProps
  extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while loading data. Please try again.',
  onRetry,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'border border-red-200 bg-red-50 rounded-sm p-6 text-neutral-900',
        className,
      )}
      {...props}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-red-800 tracking-tight mb-1">
            {title}
          </h4>
          <p className="text-xs text-red-700 leading-relaxed max-w-xl">
            {message}
          </p>
        </div>

        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="border-red-300 text-red-800 hover:bg-red-100 shrink-0"
          >
            Retry Request
          </Button>
        )}
      </div>
    </div>
  );
}
