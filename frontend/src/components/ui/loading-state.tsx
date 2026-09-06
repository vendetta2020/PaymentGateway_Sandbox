import React from 'react';
import { cn } from '@/lib/utils';

export interface LoadingStateProps
  extends React.HTMLAttributes<HTMLDivElement> {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingState({
  message = 'Loading data...',
  size = 'md',
  className,
  ...props
}: LoadingStateProps) {
  const sizeStyles = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center text-neutral-600',
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'border-neutral-300 border-t-black rounded-full animate-spin mb-3',
          sizeStyles[size],
        )}
        aria-hidden="true"
      />
      <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        {message}
      </span>
    </div>
  );
}
