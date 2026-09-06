'use client';

import React, { useState } from 'react';
import { Sidebar } from './sidebar';
import { TopHeader } from './top-header';
import { cn } from '@/lib/utils';

export interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white">
      {/* Top Header - full width */}
      <TopHeader onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />

      {/* Main Container below Header: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Sidebar (persistent) */}
        <div className="hidden md:block shrink-0">
          <Sidebar />
        </div>

        {/* Mobile Sidebar Overlay Drawer */}
        {isMobileSidebarOpen && (
          <div
            className="fixed inset-0 z-50 flex md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation drawer"
          >
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => setIsMobileSidebarOpen(false)}
              aria-hidden="true"
            />

            {/* Sliding Drawer */}
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-surface-subtle shadow-xl">
              <Sidebar onCloseMobile={() => setIsMobileSidebarOpen(false)} />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto bg-white p-4 sm:p-6 lg:p-8"
        >
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
