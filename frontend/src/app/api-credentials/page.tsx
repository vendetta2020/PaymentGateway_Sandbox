import React from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Key } from 'lucide-react';

export default function ApiCredentialsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        category="SETTINGS / CREDENTIALS"
        title="API Credentials"
        description="Public and secret API keys with prefix recognition, secure masking, and rotation capabilities."
      />

      <EmptyState
        icon={<Key className="w-8 h-8" />}
        title="API Credentials Domain Foundation Ready"
        description="Credential presentation structures and secret masking guidelines are defined. Key generation, rotation, and revocation actions are scheduled for subsequent frontend phases."
      />
    </div>
  );
}
