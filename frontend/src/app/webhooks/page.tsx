import React from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Webhook } from 'lucide-react';

export default function WebhooksPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        category="INTEGRATION"
        title="Webhooks"
        description="Asynchronous event delivery notifications, HMAC signing secrets, and delivery retry telemetry."
      />

      <EmptyState
        icon={<Webhook className="w-8 h-8" />}
        title="Webhooks Domain Foundation Ready"
        description="Webhook presentation structures and delivery status tokens are defined. Real-time delivery logs and endpoint configuration are scheduled for subsequent frontend phases."
      />
    </div>
  );
}
