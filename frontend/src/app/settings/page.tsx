'use client';

import React from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/lib/auth-context';
import { Building2, Mail, Shield, Key, LogOut } from 'lucide-react';

export default function SettingsPage() {
  const { merchant, isAuthenticated, logout } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        category="PREFERENCES"
        title="Settings"
        description="Merchant account profile configuration, environment parameters, and active session."
        actions={
          isAuthenticated ? (
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </Button>
          ) : undefined
        }
      />

      {merchant ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card variant="default">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-xs uppercase tracking-wider font-semibold text-neutral-500 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span>Merchant Profile</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 divide-y divide-border text-xs">
              <div className="py-2.5 flex justify-between">
                <span className="text-neutral-500">Business Name</span>
                <span className="font-semibold text-neutral-900">{merchant.businessName}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-neutral-500">Legal Entity Name</span>
                <span className="font-semibold text-neutral-900">{merchant.name}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-neutral-500">Contact Email</span>
                <span className="font-mono text-neutral-800">{merchant.email}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-neutral-500">Merchant UUID</span>
                <span className="font-mono text-neutral-800 text-[11px] break-all">{merchant.id}</span>
              </div>
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-neutral-500">Account Status</span>
                <StatusBadge status={merchant.status === 'ACTIVE' ? 'SUCCEEDED' : 'REVOKED'} label={merchant.status} />
              </div>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-xs uppercase tracking-wider font-semibold text-neutral-500 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>Gateway Environment Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div className="p-3 bg-surface-subtle border border-border rounded-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Simulator Environment:</span>
                  <span className="font-bold text-neutral-900 font-mono">SANDBOX / TEST</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Financial Integrity Mode:</span>
                  <span className="font-bold text-emerald-700 font-mono">ENFORCED (DUAL-ENTRY)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">PCI DSS Scope:</span>
                  <span className="font-bold text-neutral-600 font-mono">EDUCATIONAL SIMULATOR</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card variant="default">
          <p className="text-xs text-neutral-500">Please authenticate to view account preferences.</p>
        </Card>
      )}
    </div>
  );
}
