'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { api } from '@/lib/api-client';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { PaymentPresentation, RefundPresentation } from '@/types/domain';
import { useAuth } from '@/lib/auth-context';
import { RotateCcw, Search, ArrowUpRight, ShieldCheck, RefreshCw } from 'lucide-react';

export default function RefundsPage() {
  const { isAuthenticated } = useAuth();
  const [payments, setPayments] = useState<PaymentPresentation[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>('');
  const [refunds, setRefunds] = useState<RefundPresentation[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);
  const [isLoadingRefunds, setIsLoadingRefunds] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load recent successful/refunded payments for merchant
  const loadPayments = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingPayments(true);
    setError(null);
    try {
      const res = await api.get<{ data: PaymentPresentation[] }>('/payments?limit=20&offset=0');
      const allPayments = res.data || [];
      setPayments(allPayments);

      // Select first payment by default if none selected
      if (allPayments.length > 0 && !selectedPaymentId) {
        setSelectedPaymentId(allPayments[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load payments for refund inspection');
    } finally {
      setIsLoadingPayments(false);
    }
  }, [isAuthenticated, selectedPaymentId]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // Load refunds whenever selectedPaymentId changes
  const loadRefundsForPayment = useCallback(async (paymentId: string) => {
    if (!paymentId) {
      setRefunds([]);
      return;
    }
    setIsLoadingRefunds(true);
    setError(null);
    try {
      const res = await api.get<{ status: string; data: RefundPresentation[] }>(
        `/payments/${paymentId}/refunds`,
      );
      setRefunds(res.data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch refunds for payment');
      setRefunds([]);
    } finally {
      setIsLoadingRefunds(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPaymentId) {
      loadRefundsForPayment(selectedPaymentId);
    }
  }, [selectedPaymentId, loadRefundsForPayment]);

  const selectedPayment = payments.find((p) => p.id === selectedPaymentId);

  return (
    <div className="space-y-6">
      <PageHeader
        category="TRANSACTIONS"
        title="Refunds"
        description="Pessimistically-locked refund lifecycle with remaining balance validation and external simulator sync."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={loadPayments}
            disabled={isLoadingPayments}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPayments ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        }
      />

      {/* Backend Authority Architectural Notice */}
      <Card variant="subtle" className="border-border">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-neutral-800 shrink-0 mt-0.5" />
          <div className="text-xs text-neutral-600 leading-relaxed">
            <span className="font-bold text-neutral-900">
              Backend Integrity Invariant:
            </span>{' '}
            Refund eligibility and remaining balances are computed exclusively on the PostgreSQL backend using
            row-level pessimistic locking (`SELECT ... FOR UPDATE`). Refunds are linked to specific parent payment transactions.
          </div>
        </div>
      </Card>

      {/* Payment Selector & Lookup */}
      <Card variant="default">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-xs uppercase tracking-wider font-semibold text-neutral-500">
            Select Parent Payment to Inspect Refunds
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                Recent Transactions
              </label>
              <select
                aria-label="Select payment for refund inspection"
                value={selectedPaymentId}
                onChange={(e) => setSelectedPaymentId(e.target.value)}
                className="w-full h-9 border border-border bg-white px-3 py-1.5 text-xs font-mono rounded-sm text-neutral-900 focus-visible:outline-2 focus-visible:outline-black"
                disabled={isLoadingPayments || payments.length === 0}
              >
                {payments.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id.slice(0, 16)}... | Order: {p.orderId} | {p.status} | {formatCurrency(p.amount, p.currency)}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:w-72">
              <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                Direct Payment UUID Lookup
              </label>
              <div className="flex gap-1.5">
                <Input
                  isMonospace
                  placeholder="pay_uuid..."
                  value={selectedPaymentId}
                  onChange={(e) => setSelectedPaymentId(e.target.value.trim())}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => loadRefundsForPayment(selectedPaymentId)}
                  disabled={!selectedPaymentId || isLoadingRefunds}
                >
                  <Search className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Payment Summary & Refunds Table */}
      {selectedPayment && (
        <div className="p-4 bg-surface-subtle border border-border rounded-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <div>
            <span className="font-semibold text-neutral-900 font-mono">
              Selected: {selectedPayment.id}
            </span>
            <div className="text-neutral-500 font-mono mt-0.5">
              Order: {selectedPayment.orderId} • Original Amount:{' '}
              <strong className="text-neutral-900">
                {formatCurrency(selectedPayment.amount, selectedPayment.currency)}
              </strong>{' '}
              • Status: <StatusBadge status={selectedPayment.status} />
            </div>
          </div>

          <Link
            href={`/payments/${selectedPayment.id}`}
            className="inline-flex items-center gap-1 font-semibold text-black hover:underline"
          >
            <span>Open Payment Detail & Issue Refund</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Refunds List Section */}
      {error && (
        <ErrorState
          title="Error Loading Refunds"
          message={error}
          onRetry={() => loadRefundsForPayment(selectedPaymentId)}
        />
      )}

      {isLoadingRefunds ? (
        <LoadingState message="Loading refund ledger records..." />
      ) : refunds.length === 0 ? (
        <EmptyState
          icon={<RotateCcw className="w-8 h-8" />}
          title="No Refunds Found for this Payment"
          description="This transaction currently has no associated refund attempts or executions."
          action={
            selectedPayment?.status === 'SUCCEEDED' ? (
              <Link href={`/payments/${selectedPayment.id}`}>
                <Button variant="primary" size="sm">
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Issue Refund via Payment Detail</span>
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Refund ID</TableHead>
                <TableHead>Parent Payment</TableHead>
                <TableHead align="right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Provider Reference</TableHead>
                <TableHead align="right">Executed At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {refunds.map((r) => (
                <TableRow key={r.id}>
                  <TableCell isMonospace className="font-semibold text-neutral-900">
                    {r.id.slice(0, 18)}...
                  </TableCell>
                  <TableCell isMonospace className="text-neutral-700">
                    <Link
                      href={`/payments/${r.paymentId}`}
                      className="hover:underline flex items-center gap-1 text-black"
                    >
                      <span>{r.paymentId.slice(0, 14)}...</span>
                      <ArrowUpRight className="w-3 h-3 text-neutral-400" />
                    </Link>
                  </TableCell>
                  <TableCell align="right" isMonospace className="font-bold text-neutral-900">
                    {formatCurrency(r.amount, selectedPayment?.currency || 'IDR')}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-neutral-600 text-xs max-w-xs truncate">
                    {r.reason || 'N/A'}
                  </TableCell>
                  <TableCell isMonospace className="text-neutral-500 text-xs">
                    {r.providerReference || 'Pending'}
                  </TableCell>
                  <TableCell align="right" isMonospace className="text-neutral-500 text-xs">
                    {formatDateTime(r.createdAt)}
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
