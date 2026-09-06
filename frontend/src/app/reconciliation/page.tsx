import React from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ArrowLeftRight } from 'lucide-react';

export default function ReconciliationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        category="FINANCIAL INTEGRITY"
        title="Reconciliation"
        description="Dual-ledger matching engine comparing internal gateway records against external bank mutations."
      />

      <EmptyState
        icon={<ArrowLeftRight className="w-8 h-8" />}
        title="Reconciliation Domain Foundation Ready"
        description="Reconciliation run interfaces and discrepancy tokens (amount mismatch, missing in provider) are established. Reconciliation run controls and discrepancy inspection tables are scheduled for subsequent frontend phases."
      />
    </div>
  );
}
