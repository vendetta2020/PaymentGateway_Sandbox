import React from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { RotateCcw } from 'lucide-react';

export default function RefundsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        category="TRANSACTIONS"
        title="Refunds"
        description="Full and partial refund records with remaining balance validation and lifecycle audit."
      />

      <EmptyState
        icon={<RotateCcw className="w-8 h-8" />}
        title="Refunds Domain Foundation Ready"
        description="The refund presentation interfaces and status badges are configured. Interactive refund execution and history tables are scheduled for subsequent frontend phases."
      />
    </div>
  );
}
