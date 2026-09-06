import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none';

    const variantStyles = {
      primary:
        'bg-black text-white hover:bg-neutral-800 active:bg-neutral-900 border border-black',
      secondary:
        'bg-surface-subtle text-neutral-900 hover:bg-neutral-200 border border-border',
      outline:
        'bg-white text-neutral-900 hover:bg-surface-subtle border border-border-dark',
      ghost:
        'bg-transparent text-neutral-900 hover:bg-surface-subtle border border-transparent',
      destructive:
        'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 border border-red-700',
    };

    const sizeStyles = {
      sm: 'h-8 px-2.5 text-xs rounded-sm gap-1.5',
      md: 'h-9 px-3.5 text-sm rounded-sm gap-2',
      lg: 'h-10 px-5 text-base rounded-md gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading && (
          <span
            className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1"
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
