'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CreditCard,
  RotateCcw,
  Webhook,
  Scale,
  ArrowLeftRight,
  Key,
  SlidersHorizontal,
  X,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const navItems: NavItem[] = [
  { label: 'Overview', href: '/overview', icon: LayoutDashboard },
  { label: 'Payments', href: '/payments', icon: CreditCard },
  { label: 'Refunds', href: '/refunds', icon: RotateCcw },
  { label: 'Webhooks', href: '/webhooks', icon: Webhook },
  { label: 'Settlement', href: '/settlement', icon: Scale },
  { label: 'Reconciliation', href: '/reconciliation', icon: ArrowLeftRight },
  { label: 'API Credentials', href: '/api-credentials', icon: Key },
  { label: 'Settings', href: '/settings', icon: SlidersHorizontal },
];

export interface SidebarProps {
  onCloseMobile?: () => void;
  className?: string;
}

export function Sidebar({ onCloseMobile, className }: SidebarProps) {
  const pathname = usePathname();
  const { merchant, isAuthenticated, logout } = useAuth();

  const merchantDisplayName = merchant?.businessName || merchant?.name || 'Simulator Merchant';
  const merchantIdDisplay = merchant ? `merch_${merchant.id.slice(0, 8)}` : 'Not Authenticated';

  return (
    <aside
      className={cn(
        'flex flex-col h-full w-64 bg-surface-subtle border-r border-border select-none',
        className,
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-black text-white flex items-center justify-center font-bold text-xs rounded-sm">
            FG
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-900 leading-tight">
              Gateway
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 leading-tight">
              Simulator
            </span>
          </div>
        </div>

        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            aria-label="Close mobile navigation"
            className="md:hidden p-1 rounded-sm text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Merchant Switcher / Context */}
      <div className="px-4 py-3 mx-3 my-3 bg-white border border-border rounded-sm flex items-center justify-between">
        <div className="overflow-hidden pr-2">
          <p className="text-xs font-semibold text-neutral-900 truncate" title={merchantDisplayName}>
            {merchantDisplayName}
          </p>
          <p className="text-[10px] font-mono text-neutral-500 truncate">
            {merchantIdDisplay}
          </p>
        </div>
        {isAuthenticated ? (
          <button
            onClick={logout}
            title="Log out / Switch merchant"
            aria-label="Log out"
            className="p-1 text-neutral-400 hover:text-neutral-900 hover:bg-surface-subtle rounded-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        ) : (
          <span
            className="w-2 h-2 rounded-full bg-neutral-400 shrink-0"
            title="Not Authenticated"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Navigation Links */}
      <nav
        aria-label="Dashboard navigation"
        className="flex-1 px-3 space-y-1 overflow-y-auto"
      >
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/overview' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-sm transition-colors',
                isActive
                  ? 'bg-neutral-200/70 text-neutral-900 font-semibold border-l-2 border-black -ml-[2px] pl-[14px]'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4 shrink-0',
                  isActive ? 'text-neutral-900' : 'text-neutral-500',
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Environment & Financial Safety Notice */}
      <div className="p-4 border-t border-border bg-surface-subtle text-[11px] text-neutral-500 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
        <span>Test environment • No real money</span>
      </div>
    </aside>
  );
}
