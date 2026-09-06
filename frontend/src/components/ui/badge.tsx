import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'neutral' | 'outline';
}

export function Badge({
  className,
  variant = 'default',
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: 'bg-surface-subtle text-neutral-800 border-border',
    neutral: 'bg-neutral-100 text-neutral-700 border-neutral-300',
    outline: 'bg-transparent text-neutral-800 border-border-dark',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium uppercase tracking-wider',
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
