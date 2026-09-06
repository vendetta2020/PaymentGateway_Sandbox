'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { RefundModal } from '@/components/payments/refund-modal';
import { api } from '@/lib/api-client';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { PaymentPresentation, RefundPresentation } from '@/types/domain';
import { useAuth } from '@/lib/auth-context';
import {
  ArrowLeft,
  RotateCcw,
  Play,
  Code,
  Copy,
  Check,
  Clock,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [payment, setPayment] = useState<PaymentPresentation | null>(null);
  const [refunds, setRefunds] = useState<RefundPresentation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isRawJsonOpen, setIsRawJsonOpen] = useState(false);
  const [isTechDetailsOpen, setIsTechDetailsOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchPaymentDetails = useCallback(async () => {
    if (!id || !isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch Payment
      const paymentResponse = await api.get<{ status: string; data: PaymentPresentation }>(
        `/payments/${id}`,
      );
      setPayment(paymentResponse.data);

      // 2. Fetch Refunds for this payment
      try {
        const refundsResponse = await api.get<{ status: string; data: RefundPresentation[] }>(
          `/payments/${id}/refunds`,
        );
        setRefunds(refundsResponse.data || []);
      } catch {
        setRefunds([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch payment details from gateway.');
    } finally {
      setIsLoading(false);
    }
  }, [id, isAuthenticated]);

  useEffect(() => {
    fetchPaymentDetails();
  }, [fetchPaymentDetails]);

  const handleProcessPayment = async () => {
    if (!payment) return;
    setIsProcessing(true);
    setActionMessage(null);
    setError(null);
    const idempotencyKey = crypto.randomUUID();

    try {
      const response = await api.post<{ status: string; data: PaymentPresentation }>(
        `/payments/${payment.id}/process`,
        {},
        { idempotencyKey },
      );
      setPayment(response.data);
      setActionMessage('Payment successfully processed via simulator engine!');
      fetchPaymentDetails();
    } catch (err: any) {
      setError(err?.message || 'Failed to simulate payment processing');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (isLoading) {
    return <LoadingState message="Loading payment transaction records..." />;
  }

  if (error && !payment) {
    return (
      <div className="space-y-4">
        <Link
          href="/payments"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-600 hover:text-black font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Payments</span>
        </Link>
        <ErrorState
          title="Payment Not Found"
          message={error}
          onRetry={fetchPaymentDetails}
        />
      </div>
    );
  }

  if (!payment) return null;

  const totalRefunded = payment.totalRefunded ?? 0;
  const remainingBalance = payment.refundableAmount ?? payment.amount;

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono">
          <Link href="/payments" className="hover:underline text-neutral-800">
            Payments
          </Link>
          <span>/</span>
          <span className="text-black font-semibold">{payment.id.slice(0, 20)}...</span>
        </div>
        <Link
          href="/payments"
          className="inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-black"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Payments</span>
        </Link>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between rounded-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-emerald-700 font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800 flex items-center justify-between rounded-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-700 font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold font-mono text-neutral-900 tracking-tight break-all">
              {payment.id}
            </h1>
            <StatusBadge status={payment.status} />
            <span className="px-2 py-0.5 bg-neutral-200 text-neutral-700 font-mono text-[10px] font-bold uppercase tracking-wider rounded-sm">
              TEST DATA
            </span>
          </div>
          <p className="text-xs text-neutral-500 font-mono">
            Order: {payment.orderId} • Created: {formatDateTime(payment.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {payment.status === 'PENDING' && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleProcessPayment}
              isLoading={isProcessing}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Simulate Callback</span>
            </Button>
          )}

          {payment.status === 'SUCCEEDED' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRefundModalOpen(true)}
              disabled={remainingBalance <= 0}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Refund</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRawJsonOpen(!isRawJsonOpen)}
          >
            <Code className="w-3.5 h-3.5" />
            <span>View raw JSON</span>
          </Button>
        </div>
      </div>

      {/* Raw JSON viewer modal/drawer */}
      {isRawJsonOpen && (
        <div className="p-4 bg-neutral-900 text-neutral-100 rounded-sm font-mono text-xs overflow-x-auto border border-neutral-800">
          <div className="flex justify-between items-center pb-2 mb-2 border-b border-neutral-800">
            <span className="text-neutral-400 font-bold uppercase tracking-wider text-[10px]">
              Raw Gateway Response
            </span>
            <button
              onClick={() => handleCopy(JSON.stringify(payment, null, 2), 'rawJson')}
              className="text-neutral-400 hover:text-white text-[11px] flex items-center gap-1"
            >
              {copiedKey === 'rawJson' ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          </div>
          <pre>{JSON.stringify(payment, null, 2)}</pre>
        </div>
      )}

      {/* Main 2-Column Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Gross Transaction Volume */}
          <Card variant="subtle">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
              Gross Transaction Volume
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-bold font-sans tracking-tight text-neutral-900">
                {formatCurrency(payment.amount, payment.currency)}
              </span>
              <span className="text-sm font-semibold text-neutral-500 font-mono">
                {payment.currency}
              </span>
            </div>
            <div className="mt-2 text-xs text-neutral-600 font-mono">
              Status: <span className="font-bold text-neutral-900">{payment.status}</span> •
              Method: <span className="font-bold text-neutral-900">{payment.paymentMethod}</span>
            </div>
          </Card>

          {/* Payment Specifications */}
          <Card variant="default">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs uppercase tracking-wider font-semibold text-neutral-500">
                  Payment Specifications
                </CardTitle>
                <span className="text-[10px] font-mono text-neutral-400 uppercase">
                  SIMULATOR_V1
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-4 divide-y divide-border text-xs">
              <div className="py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="text-neutral-500">Payment Method</span>
                <span className="font-semibold text-neutral-900 font-mono">
                  {payment.paymentMethod.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="text-neutral-500">Order ID</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-neutral-900 font-semibold">
                    {payment.orderId}
                  </span>
                  <button
                    onClick={() => handleCopy(payment.orderId, 'orderId')}
                    title="Copy Order ID"
                    className="text-neutral-400 hover:text-black"
                  >
                    {copiedKey === 'orderId' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="text-neutral-500">Provider Reference</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-neutral-900">
                    {payment.providerReference || 'Pending assignment'}
                  </span>
                  {payment.providerReference && (
                    <button
                      onClick={() => handleCopy(payment.providerReference!, 'providerRef')}
                      title="Copy Provider Reference"
                      className="text-neutral-400 hover:text-black"
                    >
                      {copiedKey === 'providerRef' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="text-neutral-500">Created (ISO / UTC)</span>
                <span className="font-mono text-neutral-800">
                  {payment.createdAt}
                </span>
              </div>

              <div className="py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="text-neutral-500">Last State Transition</span>
                <span className="font-mono text-neutral-800">
                  {payment.updatedAt}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Refund Status Card */}
          <Card variant="default">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs uppercase tracking-wider font-semibold text-neutral-500">
                  Refund Status
                </CardTitle>
                {payment.status === 'SUCCEEDED' && remainingBalance > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsRefundModalOpen(true)}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Issue refund</span>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              <div className="p-3 bg-surface-subtle border border-border rounded-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="font-semibold text-neutral-900 font-mono text-sm">
                    {formatCurrency(remainingBalance, payment.currency)} refundable remaining
                  </p>
                  <p className="text-neutral-500 text-[11px] font-mono">
                    {formatCurrency(totalRefunded, payment.currency)} previously returned across{' '}
                    {refunds.length} refund request(s)
                  </p>
                </div>
                <div className="text-right font-mono font-bold text-xs text-neutral-700">
                  {payment.amount > 0
                    ? `${((totalRefunded / payment.amount) * 100).toFixed(1)}% REFUNDED`
                    : '0% REFUNDED'}
                </div>
              </div>

              {refunds.length === 0 ? (
                <p className="text-xs text-neutral-500 italic">
                  No refunds recorded for this payment.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="font-semibold text-neutral-700 uppercase tracking-wider text-[11px]">
                    Refund Execution History:
                  </p>
                  <div className="divide-y divide-border border border-border rounded-sm">
                    {refunds.map((r) => (
                      <div
                        key={r.id}
                        className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-surface-subtle"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-neutral-900">
                              {formatCurrency(r.amount, payment.currency)}
                            </span>
                            <StatusBadge status={r.status} />
                          </div>
                          <p className="text-neutral-500 text-[11px] mt-0.5">
                            Reason: {r.reason || 'No reason provided'}
                          </p>
                        </div>
                        <div className="text-right text-[11px] font-mono text-neutral-500">
                          <div>Ref: {r.id.slice(0, 16)}...</div>
                          <div>{formatDateTime(r.createdAt)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (Span 1) */}
        <div className="space-y-6">
          {/* Activity Timeline */}
          <Card variant="default">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs uppercase tracking-wider font-semibold text-neutral-900 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Activity Timeline</span>
                </CardTitle>
                <span className="text-[10px] font-mono text-neutral-400">UTC</span>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="relative pl-5 border-l-2 border-neutral-300 space-y-6 my-2 text-xs">
                {/* Event 1: Initialized */}
                <div className="relative">
                  <div className="absolute -left-[27px] top-0.5 w-3 h-3 bg-black rounded-full border-2 border-white" />
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-neutral-900">Payment Intent Initialized</p>
                    <span className="text-[10px] font-mono text-neutral-500">
                      {formatDateTime(payment.createdAt).split(' ')[1]}
                    </span>
                  </div>
                  <p className="text-neutral-500 text-[11px] mt-0.5">
                    Order {payment.orderId} registered with amount {formatCurrency(payment.amount, payment.currency)}
                  </p>
                </div>

                {/* Event 2: Method assigned */}
                <div className="relative">
                  <div className="absolute -left-[27px] top-0.5 w-3 h-3 bg-black rounded-full border-2 border-white" />
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-neutral-900">Method Assigned</p>
                    <span className="text-[10px] font-mono text-neutral-500">
                      {formatDateTime(payment.createdAt).split(' ')[1]}
                    </span>
                  </div>
                  <p className="text-neutral-500 text-[11px] mt-0.5">
                    {payment.paymentMethod.replace(/_/g, ' ')} channel assigned
                  </p>
                </div>

                {/* Event 3: Current State */}
                <div className="relative">
                  <div
                    className={`absolute -left-[27px] top-0.5 w-3 h-3 rounded-full border-2 border-white ${
                      payment.status === 'SUCCEEDED'
                        ? 'bg-emerald-600'
                        : payment.status === 'FAILED'
                        ? 'bg-red-600'
                        : 'bg-amber-500'
                    }`}
                  />
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-neutral-900">State: {payment.status}</p>
                    <span className="text-[10px] font-mono text-neutral-500">
                      {formatDateTime(payment.updatedAt).split(' ')[1]}
                    </span>
                  </div>
                  <p className="text-neutral-500 text-[11px] mt-0.5">
                    Provider ref: {payment.providerReference || 'awaiting execution'}
                  </p>
                </div>

                {/* Event 4: Refunds if any */}
                {refunds.map((r, i) => (
                  <div key={r.id} className="relative">
                    <div className="absolute -left-[27px] top-0.5 w-3 h-3 bg-purple-600 rounded-full border-2 border-white" />
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-neutral-900">
                        Refund #{i + 1} ({r.status})
                      </p>
                      <span className="text-[10px] font-mono text-neutral-500">
                        {formatDateTime(r.createdAt).split(' ')[1]}
                      </span>
                    </div>
                    <p className="text-neutral-500 text-[11px] mt-0.5">
                      {formatCurrency(r.amount, payment.currency)} refunded. Reason: {r.reason || 'N/A'}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Technical Details & Idempotency */}
          <Card variant="default">
            <button
              onClick={() => setIsTechDetailsOpen(!isTechDetailsOpen)}
              className="w-full flex items-center justify-between text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider"
            >
              <span>Technical & Idempotency Details</span>
              {isTechDetailsOpen ? (
                <ChevronUp className="w-4 h-4 text-neutral-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-neutral-500" />
              )}
            </button>
            {isTechDetailsOpen && (
              <div className="pt-4 mt-3 border-t border-border space-y-2 text-xs font-mono">
                <div>
                  <span className="text-neutral-400 block text-[10px]">Payment UUID:</span>
                  <span className="text-neutral-800 break-all">{payment.id}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[10px]">Merchant UUID:</span>
                  <span className="text-neutral-800 break-all">{payment.merchantId}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[10px]">Currency:</span>
                  <span className="text-neutral-800">{payment.currency}</span>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Refund Modal */}
      <RefundModal
        payment={payment}
        existingRefunds={refunds}
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        onSuccess={fetchPaymentDetails}
      />
    </div>
  );
}
