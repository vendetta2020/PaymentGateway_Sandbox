'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card } from '@/components/ui/card';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { api } from '@/lib/api-client';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { SettlementPresentation } from '@/types/domain';
import { useAuth } from '@/lib/auth-context';
import { Scale, RefreshCw, ShieldCheck } from 'lucide-react';

export default function SettlementPage() {
  const { isAuthenticated } = useAuth();
  const [settlements, setSettlements] = useState<SettlementPresentation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettlements = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<{
        status: string;
        data: SettlementPresentation[];
      }>('/settlements?limit=20&offset=0');
      setSettlements(res.data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch settlements');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  return (
    <div className="space-y-6">
      <PageHeader
        category="FINANCIAL INTEGRITY"
        title="Settlement"
        description="Deterministic gross volume aggregation, refund deductions, and net disbursement calculation."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSettlements}
            disabled={isLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        }
      />

      <Card variant="subtle">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-neutral-800 shrink-0 mt-0.5" />
          <div className="text-xs text-neutral-600 leading-relaxed">
            <span className="font-bold text-neutral-900">
              Settlement Invariant:
            </span>{' '}
            Net settlement is calculated strictly on the backend as <code>grossAmount - refundAmount</code>.
            Settlement batches are immutable once finalized and recorded into the dual-entry ledger.
          </div>
        </div>
      </Card>

      {error ? (
        <ErrorState
          title="Unable to Load Settlements"
          message={error}
          onRetry={fetchSettlements}
        />
      ) : isLoading ? (
        <LoadingState message="Fetching settlement batches from gateway..." />
      ) : settlements.length === 0 ? (
        <EmptyState
          icon={<Scale className="w-8 h-8" />}
          title="No Settlement Batches Found"
          description="There are currently no settlement runs recorded for this merchant account."
        />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch ID</TableHead>
                <TableHead>Period</TableHead>
                <TableHead align="right">Gross Volume</TableHead>
                <TableHead align="right">Refunds Deducted</TableHead>
                <TableHead align="right">Net Payout</TableHead>
                <TableHead>Status</TableHead>
                <TableHead align="right">Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.map((s) => (
                <TableRow key={s.id}>
                  <TableCell isMonospace className="font-semibold text-neutral-900">
                    {s.id.slice(0, 18)}...
                  </TableCell>
                  <TableCell className="text-xs text-neutral-600 font-mono">
                    {formatDateTime(s.periodStart).split(' ')[0]} - {formatDateTime(s.periodEnd).split(' ')[0]}
                  </TableCell>
                  <TableCell align="right" isMonospace className="font-bold text-neutral-900">
                    {formatCurrency(s.grossAmount, s.currency)}
                  </TableCell>
                  <TableCell align="right" isMonospace className="text-red-700">
                    -{formatCurrency(s.refundAmount, s.currency)}
                  </TableCell>
                  <TableCell align="right" isMonospace className="font-bold text-emerald-700">
                    {formatCurrency(s.netAmount, s.currency)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={s.status} />
                  </TableCell>
                  <TableCell align="right" isMonospace className="text-neutral-500 text-xs">
                    {formatDateTime(s.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
