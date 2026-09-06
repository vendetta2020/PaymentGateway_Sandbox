'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { CreatePaymentModal } from '@/components/payments/create-payment-modal';
import { api } from '@/lib/api-client';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { PaymentPresentation } from '@/types/domain';
import { useAuth } from '@/lib/auth-context';
import {
  Download,
  Plus,
  ArrowUpRight,
  CreditCard,
  CheckCircle2,
  Clock,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';

export default function OverviewPage() {
  const { isAuthenticated, merchant } = useAuth();
  const [payments, setPayments] = useState<PaymentPresentation[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchOverviewData = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<{
        status: string;
        data: PaymentPresentation[];
        meta: { total: number };
      }>('/payments?limit=7&offset=0');

      setPayments(response.data || []);
      setTotalCount(response.meta?.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to load gateway overview metrics.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  // Derive metrics strictly from fetched backend transactions
  const successfulPayments = payments.filter((p) => p.status === 'SUCCEEDED');
  const pendingPayments = payments.filter((p) => p.status === 'PENDING');
  const totalGrossVolume = successfulPayments.reduce((acc, p) => acc + p.amount, 0);

  const handleExportCsv = () => {
    if (payments.length === 0) return;
    const headers = ['ID', 'Order ID', 'Amount', 'Currency', 'Method', 'Status', 'CreatedAt'];
    const rows = payments.map((p) => [
      p.id,
      p.orderId,
      p.amount,
      p.currency,
      p.paymentMethod,
      p.status,
      p.createdAt,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `payments_${merchant?.id || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <PageHeader
        category="SANDBOX ENVIRONMENT • v2.18-sim"
        title="Overview"
        description="Monitor payments, refunds, and settlement activity in the simulator sandbox."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchOverviewData}
              disabled={isLoading}
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={payments.length === 0}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create mock payment</span>
            </Button>
          </>
        }
      />

      {error ? (
        <ErrorState
          title="Overview Data Unavailable"
          message={error}
          onRetry={fetchOverviewData}
        />
      ) : isLoading ? (
        <LoadingState message="Aggregating gateway metrics..." />
      ) : (
        <>
          {/* Real Metrics Grid matching Stitch V2.5 Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card variant="subtle">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Total Volume (Fetched)
                </span>
                <CreditCard className="w-4 h-4 text-neutral-400" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-neutral-900 font-sans">
                {formatCurrency(totalGrossVolume, 'IDR')}
              </div>
              <p className="text-[11px] text-neutral-500 mt-1 font-mono">
                {successfulPayments.length} succeeded txns
              </p>
            </Card>

            <Card variant="default">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Successful Payments
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-neutral-900 font-mono">
                {successfulPayments.length}
              </div>
              <p className="text-[11px] text-neutral-500 mt-1 font-mono">
                {totalCount > 0
                  ? `${((successfulPayments.length / totalCount) * 100).toFixed(0)}% conversion`
                  : '0% conversion'}
              </p>
            </Card>

            <Card variant="default">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Pending Payments
                </span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-neutral-900 font-mono">
                {pendingPayments.length}
              </div>
              <p className="text-[11px] text-neutral-500 mt-1 font-mono">
                awaiting customer / callback
              </p>
            </Card>

            <Card variant="default">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Total Transactions
                </span>
                <RotateCcw className="w-4 h-4 text-neutral-400" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-neutral-900 font-mono">
                {totalCount}
              </div>
              <p className="text-[11px] text-neutral-500 mt-1 font-mono">
                audited in ledger
              </p>
            </Card>
          </div>

          {/* Recent Payments Section */}
          <div className="space-y-3">
            <SectionHeader
              title="Recent Payments"
              description="Real-time transaction activity fetched from authoritative backend ledger."
              actions={
                <Link
                  href="/payments"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-black hover:underline"
                >
                  <span>View all payments</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              }
            />

            {payments.length === 0 ? (
              <EmptyState
                icon={<CreditCard className="w-8 h-8" />}
                title="No recent payment activity"
                description="Create a mock payment transaction to see live state changes in the dashboard."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsCreateModalOpen(true)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Mock Payment</span>
                  </Button>
                }
              />
            ) : (
              <TableContainer>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment Reference</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead align="right">Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead align="right">Created At</TableHead>
                      <TableHead align="right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell isMonospace className="font-semibold text-neutral-900">
                          <Link
                            href={`/payments/${p.id}`}
                            className="hover:underline text-black"
                          >
                            {p.id.slice(0, 18)}...
                          </Link>
                        </TableCell>
                        <TableCell isMonospace className="text-neutral-700">
                          {p.orderId}
                        </TableCell>
                        <TableCell align="right" isMonospace className="font-bold">
                          {formatCurrency(p.amount, p.currency)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.paymentMethod.replace(/_/g, ' ')}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={p.status} />
                        </TableCell>
                        <TableCell align="right" isMonospace className="text-neutral-500 text-xs">
                          {formatDateTime(p.createdAt)}
                        </TableCell>
                        <TableCell align="right">
                          <Link
                            href={`/payments/${p.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 bg-surface-subtle hover:bg-neutral-200 border border-border rounded-sm"
                          >
                            <span>Inspect</span>
                            <ArrowUpRight className="w-3 h-3 text-neutral-500" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </div>
        </>
      )}

      {/* Create Payment Modal */}
      <CreatePaymentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchOverviewData}
      />
    </div>
  );
}
