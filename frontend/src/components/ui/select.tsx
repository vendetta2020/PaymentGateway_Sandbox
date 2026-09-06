import React from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options?: Array<{ value: string; label: string }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, options, disabled, ...props }, ref) => {
    return (
      <select
        ref={ref}
        disabled={disabled}
        className={cn(
          'flex h-9 w-full rounded-sm border border-border bg-white px-3 py-1.5 text-sm text-neutral-900',
          'focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-1',
          'disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:opacity-60',
          className,
        )}
        {...props}
      >
        {options
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))
          : children}
      </select>
    );
  },
);

Select.displayName = 'Select';
