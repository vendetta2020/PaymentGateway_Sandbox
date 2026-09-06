import React from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  category?: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  category,
  description,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-border mb-6',
        className,
      )}
      {...props}
    >
      <div className="space-y-1">
        {category && (
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            {category}
          </p>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-neutral-600 max-w-3xl pt-0.5">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 shrink-0 pt-2 sm:pt-0">
          {actions}
        </div>
      )}
    </div>
  );
}
