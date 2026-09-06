import React from 'react';
import { cn } from '@/lib/utils';

export interface SectionHeaderProps
  extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  badge?: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
}

export function SectionHeader({
  title,
  badge,
  description,
  actions,
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-3',
        className,
      )}
      {...props}
    >
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
            {title}
          </h2>
          {badge}
        </div>
        {description && (
          <p className="text-xs text-neutral-500 pt-0.5">{description}</p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
