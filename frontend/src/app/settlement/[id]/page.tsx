'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { api } from '@/lib/api-client';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { SettlementPresentation } from '@/types/domain';
import { useAuth } from '@/lib/auth-context';
import { ArrowLeft, Landmark, ShieldCheck } from 'lucide-react';

export default function SettlementDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  
  const [settlement, setSettlement] = useState<SettlementPresentation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettlement = useCallback(async () => {
    if (!isAuthenticated || !id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<{
        status: string;
        data: SettlementPresentation;
      }>(`/settlements/${id}`);
      setSettlement(res.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch settlement details.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, id]);

  useEffect(() => {
    fetchSettlement();
  }, [fetchSettlement]);

  if (error) {
    return (
      <div className="space-y-6">
        <Button variant="outline" size="sm" onClick={() => router.push('/settlement')}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Settlements
        </Button>
        <ErrorState
          title="Unable to Load Settlement"
          message={error}
          onRetry={fetchSettlement}
        />
      </div>
    );
  }

  if (isLoading || !settlement) {
    return (
      <div className="space-y-6">
        <Button variant="outline" size="sm" onClick={() => router.push('/settlement')}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Settlements
        </Button>
        <LoadingState message="Fetching settlement details..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="outline" size="sm" onClick={() => router.push('/settlement')}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back
        </Button>
      </div>

      <PageHeader
        category="SETTLEMENT DETAIL"
        title={settlement.settlementReference}
        description="Detailed view of the settlement batch."
        actions={
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-xs text-neutral-500 uppercase font-semibold">Status</span>
              <StatusBadge status={settlement.status} />
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 col-span-1 md:col-span-2 space-y-8">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <Landmark className="w-5 h-5 text-neutral-700" />
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
              Financial Breakdown
            </h3>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600 font-medium">Gross Volume</span>
              <span className="text-lg font-mono font-medium text-neutral-900">
                {formatCurrency(settlement.grossAmount, settlement.currency)}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600 font-medium">Refunds Deducted</span>
              <span className="text-lg font-mono font-medium text-red-700">
                -{formatCurrency(settlement.refundAmount, settlement.currency)}
              </span>
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-between">
              <span className="text-base font-bold text-neutral-900">Net Payout</span>
              <span className="text-2xl font-mono font-bold text-emerald-700">
                {formatCurrency(settlement.netAmount, settlement.currency)}
              </span>
            </div>
          </div>
          
          <div className="bg-neutral-50 p-4 rounded-sm border border-neutral-200 mt-6">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="text-xs text-neutral-600 leading-relaxed">
                <span className="font-bold text-neutral-900">Backend Authoritative:</span> The net payout is securely calculated as <code>grossAmount - refundAmount</code> strictly by the backend settlement engine.
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 col-span-1 space-y-6 h-fit">
          <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider pb-4 border-b border-border">
            Batch Information
          </h3>

          <div className="space-y-4">
            <div>
              <span className="block text-xs text-neutral-500 font-semibold uppercase mb-1">Batch ID (Internal)</span>
              <span className="block text-sm text-neutral-900 font-mono break-all">{settlement.id}</span>
            </div>

            <div>
              <span className="block text-xs text-neutral-500 font-semibold uppercase mb-1">Reference</span>
              <span className="block text-sm text-neutral-900 font-mono break-all">{settlement.settlementReference}</span>
            </div>

            <div>
              <span className="block text-xs text-neutral-500 font-semibold uppercase mb-1">Period Start</span>
              <span className="block text-sm text-neutral-900 font-mono">{formatDateTime(settlement.periodStart)}</span>
            </div>

            <div>
              <span className="block text-xs text-neutral-500 font-semibold uppercase mb-1">Period End</span>
              <span className="block text-sm text-neutral-900 font-mono">{formatDateTime(settlement.periodEnd)}</span>
            </div>
            
            {settlement.settledAt && (
              <div>
                <span className="block text-xs text-neutral-500 font-semibold uppercase mb-1">Settled At</span>
                <span className="block text-sm text-neutral-900 font-mono">{formatDateTime(settlement.settledAt)}</span>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
