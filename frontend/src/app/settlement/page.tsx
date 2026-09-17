'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { Scale, RefreshCw, ShieldCheck, ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react';

interface PaginatedSettlementsResponse {
  status: string;
  data: SettlementPresentation[];
  meta: {
    limit: number;
    offset: number;
    total: number;
  };
}

export default function SettlementPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [settlements, setSettlements] = useState<SettlementPresentation[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettlements = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<PaginatedSettlementsResponse>(
        `/settlements?limit=${limit}&offset=${offset}`
      );
      setSettlements(res.data || []);
      setTotal(res.meta?.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch settlements');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, limit, offset]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  const handleNextPage = () => {
    if (offset + limit < total) {
      setOffset((prev) => prev + limit);
    }
  };

  const handlePrevPage = () => {
    if (offset > 0) {
      setOffset((prev) => Math.max(0, prev - limit));
    }
  };

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
        <div className="space-y-3">
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Settlement Reference</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead align="right">Gross Volume</TableHead>
                  <TableHead align="right">Refunds Deducted</TableHead>
                  <TableHead align="right">Net Payout</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead align="right">Created At</TableHead>
                  <TableHead align="right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settlements.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell isMonospace className="font-semibold text-neutral-900">
                      {s.settlementReference}
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
                    <TableCell align="right">
                      <Link 
                        href={`/settlement/${s.id}`} 
                        className="inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none bg-white text-neutral-900 hover:bg-surface-subtle border border-border-dark h-8 px-2.5 text-xs rounded-sm gap-1.5"
                      >
                        <span>View</span>
                        <ArrowUpRight className="w-3.5 h-3.5 ml-1.5" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-neutral-500 font-mono">
              Showing {Math.min(offset + 1, total)} to {Math.min(offset + limit, total)} of {total} records
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={offset === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={offset + limit >= total}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
