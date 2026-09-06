'use client';

import React from 'react';
import { Search, User, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

export interface TopHeaderProps {
  onOpenMobileSidebar?: () => void;
  className?: string;
}

export function TopHeader({ onOpenMobileSidebar, className }: TopHeaderProps) {
  const envLabel = process.env.NEXT_PUBLIC_ENVIRONMENT || 'TEST';
  const { merchant, isAuthenticated } = useAuth();

  return (
    <header
      className={cn(
        'h-14 w-full bg-white border-b border-border flex items-center justify-between px-4 sm:px-6 select-none shrink-0',
        className,
      )}
    >
      {/* Left: Mobile Menu Trigger + Search Bar */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        {onOpenMobileSidebar && (
          <button
            onClick={onOpenMobileSidebar}
            aria-label="Open navigation menu"
            className="md:hidden p-1.5 rounded-sm text-neutral-600 hover:text-neutral-900 hover:bg-surface-subtle"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Global Search Input (Non-functional presentation placeholder) */}
        <div className="relative w-full max-w-md hidden sm:block">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"
            aria-hidden="true"
          />
          <input
            type="text"
            readOnly
            placeholder="Search payments, orders, keys (/)"
            className="w-full h-8 pl-8 pr-3 text-xs bg-surface-subtle border border-border rounded-sm placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:outline-black cursor-pointer"
            aria-label="Search dashboard"
          />
        </div>
      </div>

      {/* Right: Environment badges + User Profile */}
      <div className="flex items-center gap-4 text-xs">
        {/* Environment Badge */}
        <div className="hidden lg:flex items-center px-2.5 py-1 bg-neutral-200/80 text-neutral-800 font-mono font-bold text-[10px] tracking-wider uppercase rounded-sm border border-neutral-300">
          {envLabel} ENVIRONMENT
        </div>

        {/* Simulator Connection Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 text-neutral-600 font-medium text-xs">
          <span
            className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
            aria-hidden="true"
          />
          <span>Simulator connected</span>
        </div>

        <div className="h-4 w-px bg-border hidden sm:block" aria-hidden="true" />

        {/* User Account / Profile */}
        <div className="flex items-center gap-2 text-neutral-800">
          <span className="hidden md:inline-block font-mono text-xs text-neutral-600">
            {merchant?.email || (isAuthenticated ? 'merchant@gateway' : 'Unauthenticated')}
          </span>
          <div
            className="w-7 h-7 bg-black text-white rounded-full flex items-center justify-center font-bold text-xs"
            aria-label={`User profile ${merchant?.email || ''}`}
          >
            <User className="w-4 h-4" />
          </div>
        </div>
      </div>
    </header>
  );
}
