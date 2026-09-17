import React from 'react';
import { cn } from '@/lib/utils';

export type StatusType =
  | 'SUCCEEDED'
  | 'PENDING'
  | 'PROCESSING'
  | 'FAILED'
  | 'REFUNDED'
  | 'REVOKED'
  | 'MATCHED'
  | 'DISCREPANCY'
  | 'EXPIRED'
  | 'ACTIVE'
  | 'DELIVERED'
  | 'DELIVERING'
  | 'EXHAUSTED'
  | 'DISABLED'
  | 'SETTLED'
  | 'COMPLETED'
  | 'RUNNING';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusType | string;
  showDot?: boolean;
  label?: string;
}

interface StatusConfig {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
}

const statusConfigs: Record<string, StatusConfig> = {
  SUCCEEDED: {
    label: 'Succeeded',
    bgClass: 'bg-[#EEF2FF]',
    textClass: 'text-[#3730A3]',
    borderClass: 'border-[#C7D2FE]',
    dotClass: 'bg-[#4F46E5]',
  },
  ACTIVE: {
    label: 'Active',
    bgClass: 'bg-[#ECFDF5]',
    textClass: 'text-[#065F46]',
    borderClass: 'border-[#A7F3D0]',
    dotClass: 'bg-[#10B981]',
  },
  DELIVERED: {
    label: 'Delivered',
    bgClass: 'bg-[#ECFDF5]',
    textClass: 'text-[#065F46]',
    borderClass: 'border-[#A7F3D0]',
    dotClass: 'bg-[#10B981]',
  },
  MATCHED: {
    label: 'Matched',
    bgClass: 'bg-[#ECFDF5]',
    textClass: 'text-[#065F46]',
    borderClass: 'border-[#A7F3D0]',
    dotClass: 'bg-[#10B981]',
  },
  SETTLED: {
    label: 'Settled',
    bgClass: 'bg-[#EEF2FF]',
    textClass: 'text-[#3730A3]',
    borderClass: 'border-[#C7D2FE]',
    dotClass: 'bg-[#4F46E5]',
  },
  COMPLETED: {
    label: 'Completed',
    bgClass: 'bg-[#ECFDF5]',
    textClass: 'text-[#065F46]',
    borderClass: 'border-[#A7F3D0]',
    dotClass: 'bg-[#10B981]',
  },
  RUNNING: {
    label: 'Running',
    bgClass: 'bg-[#FEF3C7]',
    textClass: 'text-[#78350F]',
    borderClass: 'border-[#FCD34D]',
    dotClass: 'bg-[#D97706]',
  },
  PENDING: {
    label: 'Pending',
    bgClass: 'bg-[#FFFBEB]',
    textClass: 'text-[#92400E]',
    borderClass: 'border-[#FDE68A]',
    dotClass: 'bg-[#F59E0B]',
  },
  DELIVERING: {
    label: 'Delivering',
    bgClass: 'bg-[#FEF3C7]',
    textClass: 'text-[#78350F]',
    borderClass: 'border-[#FCD34D]',
    dotClass: 'bg-[#D97706]',
  },
  PROCESSING: {
    label: 'Processing',
    bgClass: 'bg-[#FEF3C7]',
    textClass: 'text-[#78350F]',
    borderClass: 'border-[#FCD34D]',
    dotClass: 'bg-[#D97706]',
  },
  FAILED: {
    label: 'Failed',
    bgClass: 'bg-[#FEF2F2]',
    textClass: 'text-[#991B1B]',
    borderClass: 'border-[#FECACA]',
    dotClass: 'bg-[#DC2626]',
  },
  EXHAUSTED: {
    label: 'Exhausted',
    bgClass: 'bg-[#FFF1F2]',
    textClass: 'text-[#9F1239]',
    borderClass: 'border-[#FECDD3]',
    dotClass: 'bg-[#E11D48]',
  },
  DISCREPANCY: {
    label: 'Discrepancy',
    bgClass: 'bg-[#FFF1F2]',
    textClass: 'text-[#9F1239]',
    borderClass: 'border-[#FECDD3]',
    dotClass: 'bg-[#E11D48]',
  },
  REFUNDED: {
    label: 'Refunded',
    bgClass: 'bg-[#F1F5F9]',
    textClass: 'text-[#334155]',
    borderClass: 'border-[#CBD5E1]',
    dotClass: 'bg-[#64748B]',
  },
  REVOKED: {
    label: 'Revoked',
    bgClass: 'bg-[#F3F4F6]',
    textClass: 'text-[#4B5563]',
    borderClass: 'border-[#E5E7EB]',
    dotClass: 'bg-[#9CA3AF]',
  },
  DISABLED: {
    label: 'Disabled',
    bgClass: 'bg-[#F3F4F6]',
    textClass: 'text-[#4B5563]',
    borderClass: 'border-[#E5E7EB]',
    dotClass: 'bg-[#9CA3AF]',
  },
  EXPIRED: {
    label: 'Expired',
    bgClass: 'bg-[#F3F4F6]',
    textClass: 'text-[#4B5563]',
    borderClass: 'border-[#E5E7EB]',
    dotClass: 'bg-[#9CA3AF]',
  },
};


const defaultConfig: StatusConfig = {
  label: 'Unknown',
  bgClass: 'bg-gray-100',
  textClass: 'text-gray-700',
  borderClass: 'border-gray-200',
  dotClass: 'bg-gray-400',
};

export function StatusBadge({
  status,
  showDot = true,
  label,
  className,
  ...props
}: StatusBadgeProps) {
  const normalizedKey = status.toUpperCase();
  const config = statusConfigs[normalizedKey] || {
    ...defaultConfig,
    label: status,
  };

  const displayText = label || config.label;

  return (
    <span
      role="status"
      aria-label={`Status: ${displayText}`}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-xs font-medium select-none',
        config.bgClass,
        config.textClass,
        config.borderClass,
        className,
      )}
      {...props}
    >
      {showDot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full shrink-0', config.dotClass)}
          aria-hidden="true"
        />
      )}
      <span>{displayText}</span>
    </span>
  );
}
