import React from 'react';
import { cn } from '@/lib/utils';

export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  orientation?: 'horizontal' | 'vertical';
}

export function Divider({
  className,
  orientation = 'horizontal',
  ...props
}: DividerProps) {
  if (orientation === 'vertical') {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={cn('w-px self-stretch bg-border', className)}
        {...props}
      />
    );
  }

  return (
    <hr
      className={cn('w-full border-t border-border my-4', className)}
      {...props}
    />
  );
}
