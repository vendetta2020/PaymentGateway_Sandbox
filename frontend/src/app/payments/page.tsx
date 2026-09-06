import React from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { CreditCard } from 'lucide-react';

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        category="TRANSACTIONS"
        title="Payments"
        description="Comprehensive audit of all inbound customer payment transactions and lifecycle state changes."
      />

      <EmptyState
        icon={<CreditCard className="w-8 h-8" />}
        title="Payments Domain Foundation Ready"
        description="The application shell and layout primitives are ready. Full business listings and transaction detail views are scheduled for subsequent frontend phases."
      />
    </div>
  );
}
