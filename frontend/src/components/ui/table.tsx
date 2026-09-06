import React from 'react';
import { cn } from '@/lib/utils';

export function TableContainer({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'w-full overflow-x-auto border border-border rounded-sm bg-white',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Table({
  className,
  children,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn('w-full caption-bottom text-sm text-left border-collapse', className)}
      {...props}
    >
      {children}
    </table>
  );
}

export function TableHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('bg-surface-subtle border-b border-border', className)}
      {...props}
    >
      {children}
    </thead>
  );
}

export function TableBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn('divide-y divide-border bg-white', className)}
      {...props}
    >
      {children}
    </tbody>
  );
}

export function TableRow({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'transition-colors hover:bg-surface-subtle focus-within:bg-surface-subtle',
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export interface TableHeadProps
  extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right';
}

export function TableHead({
  className,
  align = 'left',
  children,
  ...props
}: TableHeadProps) {
  const alignStyles = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <th
      scope="col"
      className={cn(
        'h-9 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 select-none whitespace-nowrap',
        alignStyles[align],
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export interface TableCellProps
  extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right';
  isMonospace?: boolean;
}

export function TableCell({
  className,
  align = 'left',
  isMonospace = false,
  children,
  ...props
}: TableCellProps) {
  const alignStyles = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <td
      className={cn(
        'px-3.5 py-3 align-middle text-sm text-neutral-900 whitespace-nowrap',
        alignStyles[align],
        isMonospace && 'font-mono text-xs tabular-nums',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

export function TableCaption({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption
      className={cn('mt-3 text-xs text-neutral-500', className)}
      {...props}
    >
      {children}
    </caption>
  );
}
