import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  isMonospace?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', isMonospace = false, disabled, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        disabled={disabled}
        className={cn(
          'flex h-9 w-full rounded-sm border border-border bg-white px-3 py-1.5 text-sm placeholder:text-neutral-400',
          'focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-1',
          'disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:opacity-60',
          isMonospace && 'font-mono text-xs',
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';
