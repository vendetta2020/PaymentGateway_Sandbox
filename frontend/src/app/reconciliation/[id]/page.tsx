'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { api } from '@/lib/api-client';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { ReconciliationRunPresentation, ReconciliationResultPresentation } from '@/types/domain';
import { useAuth } from '@/lib/auth-context';
import { ArrowLeft, ArrowLeftRight, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function ReconciliationDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  
  const [run, setRun] = useState<ReconciliationRunPresentation | null>(null);
  const [results, setResults] = useState<ReconciliationResultPresentation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated || !id) return;
    setIsLoading(true);
    setError(null);
    try {
      const [runRes, resultsRes] = await Promise.all([
        api.get<{ status: string; data: ReconciliationRunPresentation }>(`/reconciliations/${id}`),
        api.get<{ status: string; data: ReconciliationResultPresentation[] }>(`/reconciliations/${id}/results`)
      ]);
      setRun(runRes.data);
      setResults(resultsRes.data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch reconciliation details.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (error) {
    return (
      <div className="space-y-6">
        <Button variant="outline" size="sm" onClick={() => router.push('/reconciliation')}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Reconciliations
        </Button>
        <ErrorState
          title="Unable to Load Reconciliation Run"
          message={error}
          onRetry={fetchData}
        />
      </div>
    );
  }

  if (isLoading || !run) {
    return (
      <div className="space-y-6">
        <Button variant="outline" size="sm" onClick={() => router.push('/reconciliation')}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Reconciliations
        </Button>
        <LoadingState message="Fetching reconciliation details..." />
      </div>
    );
  }

  // Group discrepancies for highlighting
  const discrepancies = results.filter(r => r.discrepancyType !== 'MATCHED');
  
  const getDiscrepancyBadgeColor = (type: string) => {
    switch (type) {
      case 'MISSING_IN_PROVIDER': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'MISSING_IN_INTERNAL': return 'bg-red-100 text-red-800 border-red-200';
      case 'AMOUNT_MISMATCH': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'STATUS_MISMATCH': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'CURRENCY_MISMATCH': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'DUPLICATE_PROVIDER_REFERENCE': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-neutral-100 text-neutral-800 border-neutral-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="outline" size="sm" onClick={() => router.push('/reconciliation')}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back
        </Button>
      </div>

      <PageHeader
        category="RECONCILIATION DETAIL"
        title={`Run ${run.id.slice(0, 8)}...`}
        description="Detailed view of dual-ledger matching results."
        actions={
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-xs text-neutral-500 uppercase font-semibold">Status</span>
              <StatusBadge status={run.status} />
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-4 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-semibold text-neutral-500 uppercase mb-2">Matched</span>
          <div className="flex items-center text-emerald-700">
            <CheckCircle2 className="w-6 h-6 mr-2" />
            <span className="text-3xl font-bold font-mono">{run.matchedCount}</span>
          </div>
        </Card>
        
        <Card className="p-4 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-semibold text-neutral-500 uppercase mb-2">Discrepancies</span>
          <div className="flex items-center text-rose-700">
            <AlertTriangle className="w-6 h-6 mr-2" />
            <span className="text-3xl font-bold font-mono">{run.discrepancyCount}</span>
          </div>
        </Card>

        <Card className="p-4 col-span-1 md:col-span-2 space-y-3">
          <h3 className="text-xs font-semibold text-neutral-500 uppercase border-b border-border pb-2">
            Run Information
          </h3>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            <div>
              <span className="block text-[10px] text-neutral-500 font-semibold uppercase">Run ID</span>
              <span className="block text-xs text-neutral-900 font-mono break-all">{run.id}</span>
            </div>
            <div>
              <span className="block text-[10px] text-neutral-500 font-semibold uppercase">Executed</span>
              <span className="block text-xs text-neutral-900 font-mono">{formatDateTime(run.createdAt)}</span>
            </div>
            <div>
              <span className="block text-[10px] text-neutral-500 font-semibold uppercase">Period Start</span>
              <span className="block text-xs text-neutral-900 font-mono">{formatDateTime(run.periodStart)}</span>
            </div>
            <div>
              <span className="block text-[10px] text-neutral-500 font-semibold uppercase">Period End</span>
              <span className="block text-xs text-neutral-900 font-mono">{formatDateTime(run.periodEnd)}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-base font-bold text-neutral-900">Discrepancies</h3>
        
        {discrepancies.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="w-8 h-8 text-emerald-600" />}
            title="Perfect Match"
            description="No discrepancies were found during this reconciliation run. All internal records matched the provider's statement perfectly."
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Internal Payment ID</TableHead>
                  <TableHead>Provider Ref</TableHead>
                  <TableHead align="right">Internal Amount</TableHead>
                  <TableHead align="right">Provider Amount</TableHead>
                  <TableHead>Mismatch Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discrepancies.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-semibold border ${getDiscrepancyBadgeColor(d.discrepancyType)}`}>
                        {d.discrepancyType.replace(/_/g, ' ')}
                      </span>
                    </TableCell>
                    <TableCell isMonospace className="text-xs text-neutral-700">
                      {d.paymentId ? `${d.paymentId.slice(0, 13)}...` : '-'}
                    </TableCell>
                    <TableCell isMonospace className="text-xs text-neutral-700">
                      {d.providerReference || '-'}
                    </TableCell>
                    <TableCell align="right" isMonospace className="text-xs">
                      {d.internalAmount !== null && d.internalCurrency
                        ? formatCurrency(d.internalAmount, d.internalCurrency)
                        : '-'}
                    </TableCell>
                    <TableCell align="right" isMonospace className="text-xs">
                      {d.providerAmount !== null && d.providerCurrency
                        ? formatCurrency(d.providerAmount, d.providerCurrency)
                        : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-neutral-600 max-w-xs truncate" title={d.details || ''}>
                      {d.details || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </div>
    </div>
  );
}
