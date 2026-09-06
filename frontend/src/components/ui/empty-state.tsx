import React from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps
  extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      role="region"
      aria-label={title}
      className={cn(
        'flex flex-col items-center justify-center border border-dashed border-border rounded-sm p-8 sm:p-12 text-center bg-surface-subtle',
        className,
      )}
      {...props}
    >
      {icon && (
        <div
          className="mb-3 text-neutral-400 flex items-center justify-center"
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-neutral-900 tracking-tight mb-1">
        {title}
      </h3>
      <p className="text-xs text-neutral-500 max-w-sm mb-4 leading-relaxed">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
