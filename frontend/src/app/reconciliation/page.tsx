'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
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
import { formatDateTime } from '@/lib/formatters';
import { ReconciliationRunPresentation } from '@/types/domain';
import { useAuth } from '@/lib/auth-context';
import { ArrowLeftRight, Play, ShieldCheck, ChevronLeft, ChevronRight, ArrowUpRight, RefreshCw } from 'lucide-react';

interface PaginatedReconciliationsResponse {
  status: string;
  data: ReconciliationRunPresentation[];
  meta: {
    limit: number;
    offset: number;
    total: number;
  };
}

export default function ReconciliationPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [runs, setRuns] = useState<ReconciliationRunPresentation[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<PaginatedReconciliationsResponse>(
        `/reconciliations?limit=${limit}&offset=${offset}`
      );
      setRuns(res.data || []);
      setTotal(res.meta?.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch reconciliation runs');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, limit, offset]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

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

  const handleRunReconciliation = async () => {
    if (!isAuthenticated) return;
    setIsRunning(true);
    setError(null);
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await api.post<{
        status: string;
        data: ReconciliationRunPresentation;
      }>('/reconciliations', {
        periodStart: yesterday.toISOString(),
        periodEnd: now.toISOString(),
      });

      // Reset to first page and refresh list
      if (offset !== 0) {
        setOffset(0);
      } else {
        await fetchRuns();
      }
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchRuns}
              disabled={isLoading || isRunning}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRunReconciliation}
              isLoading={isRunning}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Run Reconciliation</span>
            </Button>
          </div>
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

      {error ? (
        <ErrorState
          title="Reconciliation Error"
          message={error}
          onRetry={fetchRuns}
        />
      ) : isLoading ? (
        <LoadingState message="Fetching reconciliation runs..." />
      ) : runs.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight className="w-8 h-8" />}
          title="No Reconciliation Cycles Found"
          description="Click 'Run Reconciliation' to execute dual-state matching against simulated bank transactions for the last 24 hours."
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={handleRunReconciliation}
              isLoading={isRunning}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Run First Reconciliation</span>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead align="right">Matched</TableHead>
                  <TableHead align="right">Discrepancies</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead align="right">Executed At</TableHead>
                  <TableHead align="right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell isMonospace className="font-semibold text-neutral-900">
                      {r.id.slice(0, 18)}...
                    </TableCell>
                    <TableCell className="text-xs text-neutral-600 font-mono">
                      {formatDateTime(r.periodStart).split(' ')[0]} - {formatDateTime(r.periodEnd).split(' ')[0]}
                    </TableCell>
                    <TableCell align="right" isMonospace className="font-bold text-emerald-700">
                      {r.matchedCount}
                    </TableCell>
                    <TableCell align="right" isMonospace className={`font-bold ${r.discrepancyCount > 0 ? 'text-rose-700' : 'text-neutral-500'}`}>
                      {r.discrepancyCount}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell align="right" isMonospace className="text-neutral-500 text-xs">
                      {formatDateTime(r.createdAt)}
                    </TableCell>
                    <TableCell align="right">
                      <Link 
                        href={`/reconciliation/${r.id}`}
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
