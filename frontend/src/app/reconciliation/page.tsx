'use client';

import React, { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { api } from '@/lib/api-client';
import { formatDateTime } from '@/lib/formatters';
import { ReconciliationRunPresentation } from '@/types/domain';
import { useAuth } from '@/lib/auth-context';
import { ArrowLeftRight, Play, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function ReconciliationPage() {
  const { isAuthenticated } = useAuth();
  const [lastRun, setLastRun] = useState<ReconciliationRunPresentation | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunReconciliation = async () => {
    if (!isAuthenticated) return;
    setIsRunning(true);
    setError(null);
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const res = await api.post<{
        status: string;
        data: ReconciliationRunPresentation;
      }>('/reconciliations', {
        periodStart: yesterday.toISOString(),
        periodEnd: now.toISOString(),
      });

      setLastRun(res.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to trigger reconciliation run');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        category="FINANCIAL INTEGRITY"
        title="Reconciliation"
        description="Dual-ledger matching engine comparing internal gateway records against external provider statements."
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={handleRunReconciliation}
            isLoading={isRunning}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Run Reconciliation</span>
          </Button>
        }
      />

      <Card variant="subtle">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-neutral-800 shrink-0 mt-0.5" />
          <div className="text-xs text-neutral-600 leading-relaxed">
            <span className="font-bold text-neutral-900">
              Discrepancy Detection:
            </span>{' '}
            Automated reconciliation compares internal payment state and amounts against external clearing records.
            Any mismatch (amount, missing in provider, or status divergence) is classified as a discrepancy.
          </div>
        </div>
      </Card>

      {error && (
        <ErrorState
          title="Reconciliation Error"
          message={error}
          onRetry={handleRunReconciliation}
        />
      )}

      {lastRun ? (
        <div className="space-y-4">
          <div className="p-4 bg-white border border-border rounded-sm space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-900 font-mono">
                  Run ID: {lastRun.id}
                </span>
                <StatusBadge status={lastRun.status} />
              </div>
              <span className="font-mono text-neutral-500">
                Executed: {formatDateTime(lastRun.createdAt)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-sm">
                <span className="text-[11px] font-semibold text-emerald-800 uppercase block mb-1">
                  Matched Transactions
                </span>
                <span className="text-2xl font-bold font-mono text-emerald-900">
                  {lastRun.totalMatched}
                </span>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-sm">
                <span className="text-[11px] font-semibold text-rose-800 uppercase block mb-1">
                  Discrepancies Detected
                </span>
                <span className="text-2xl font-bold font-mono text-rose-900">
                  {lastRun.totalDiscrepancies}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<ArrowLeftRight className="w-8 h-8" />}
          title="No Active Reconciliation Cycle"
          description="Click 'Run Reconciliation' to execute dual-state matching against simulated bank transactions for the last 24 hours."
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={handleRunReconciliation}
              isLoading={isRunning}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Run Reconciliation Now</span>
            </Button>
          }
        />
      )}
    </div>
  );
}
