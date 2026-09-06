'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
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
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { CreatePaymentModal } from '@/components/payments/create-payment-modal';
import { api } from '@/lib/api-client';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { PaymentPresentation } from '@/types/domain';
import { useAuth } from '@/lib/auth-context';
import { Plus, RefreshCw, CreditCard, ChevronRight, ChevronLeft, ArrowUpRight } from 'lucide-react';

interface PaginatedPaymentsResponse {
  status: string;
  data: PaymentPresentation[];
  meta: {
    limit: number;
    offset: number;
    total: number;
  };
}

export default function PaymentsPage() {
  const { isAuthenticated } = useAuth();
  const [payments, setPayments] = useState<PaymentPresentation[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchPayments = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<PaginatedPaymentsResponse>(
        `/payments?limit=${limit}&offset=${offset}`,
      );
      setPayments(response.data || []);
      setTotal(response.meta?.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch payments from server.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, limit, offset]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

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
        category="TRANSACTIONS"
        title="Payments"
        description="Comprehensive audit of all inbound customer payment transactions and lifecycle state changes."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPayments}
              disabled={isLoading}
              title="Refresh payments list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Payment</span>
            </Button>
          </>
        }
      />

      {error ? (
        <ErrorState
          title="Unable to Load Payments"
          message={error}
          onRetry={fetchPayments}
        />
      ) : isLoading ? (
        <LoadingState message="Fetching payments from gateway..." />
      ) : payments.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="w-8 h-8" />}
          title="No payment records found"
          description="There are currently no payment transactions for this merchant. Create a simulated payment to begin testing."
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Payment</span>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
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
                  <TableHead align="right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell isMonospace className="font-semibold text-neutral-900">
                      <Link
                        href={`/payments/${p.id}`}
                        className="hover:underline flex items-center gap-1 text-black"
                      >
                        <span>{p.id.slice(0, 18)}...</span>
                        <ArrowUpRight className="w-3 h-3 text-neutral-400" />
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
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 bg-surface-subtle hover:bg-neutral-200 border border-border rounded-sm transition-colors"
                      >
                        <span>Detail</span>
                        <ChevronRight className="w-3 h-3 text-neutral-500" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination Navigation */}
          <div className="flex items-center justify-between text-xs text-neutral-600 px-1 pt-1">
            <div>
              Showing{' '}
              <span className="font-mono font-semibold text-neutral-900">
                {total > 0 ? offset + 1 : 0}
              </span>{' '}
              to{' '}
              <span className="font-mono font-semibold text-neutral-900">
                {Math.min(offset + limit, total)}
              </span>{' '}
              of{' '}
              <span className="font-mono font-semibold text-neutral-900">{total}</span>{' '}
              transactions
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={offset === 0 || isLoading}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={offset + limit >= total || isLoading}
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal to create payment */}
      <CreatePaymentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchPayments}
      />
    </div>
  );
}
