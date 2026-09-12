'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { api } from '@/lib/api-client';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { PaymentPresentation, RefundPresentation } from '@/types/domain';
import {
  X,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Copy,
  Check,
  ShieldAlert,
} from 'lucide-react';

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'idemp_' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
}

export interface RefundModalProps {
  payment: PaymentPresentation;
  existingRefunds: RefundPresentation[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ModalStep = 'input' | 'confirm' | 'success';

export function RefundModal({
  payment,
  existingRefunds,
  isOpen,
  onClose,
  onSuccess,
}: RefundModalProps) {
  const successfulRefundsTotal = payment.totalRefunded ?? 0;
  const maxRefundable = payment.refundableAmount ?? payment.amount;

  const [step, setStep] = useState<ModalStep>('input');
  const [amount, setAmount] = useState(maxRefundable.toString());
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [createdRefund, setCreatedRefund] = useState<RefundPresentation | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Reset state whenever modal opens or payment changes
  useEffect(() => {
    if (isOpen) {
      setStep('input');
      setAmount(maxRefundable.toString());
      setReason('');
      setIsLoading(false);
      setError(null);
      setIdempotencyKey(generateIdempotencyKey());
      setCreatedRefund(null);
      setCopiedKey(false);
    }
  }, [isOpen, maxRefundable]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        if (step === 'success') {
          onSuccess();
        }
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isLoading, step, onClose, onSuccess]);

  if (!isOpen) return null;

  const parsedAmount = parseInt(amount, 10);
  const isAmountValid =
    !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= maxRefundable;

  // Step 1: Validate and move to Confirmation Review
  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Refund amount must be a positive integer');
      return;
    }

    if (parsedAmount > maxRefundable) {
      setError(
        `Refund amount exceeds remaining balance of ${formatCurrency(
          maxRefundable,
          payment.currency,
        )}`,
      );
      return;
    }

    // Generate fresh idempotency key for this intentional review attempt if not already set
    if (!idempotencyKey) {
      setIdempotencyKey(generateIdempotencyKey());
    }

    setStep('confirm');
  };

  // Step 2: Submit refund to backend using preserved idempotencyKey
  const handleExecuteRefund = async () => {
    if (!isAmountValid) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{ status: string; data: RefundPresentation }>(
        `/payments/${payment.id}/refunds`,
        {
          amount: parsedAmount,
          currency: payment.currency,
          reason: reason.trim() || undefined,
        },
        { idempotencyKey },
      );

      const refundData = response.data;
      setCreatedRefund(refundData);
      setStep('success');
    } catch (err: any) {
      setError(err?.message || 'Failed to process refund on backend');
      // Notice: idempotencyKey is intentionally retained so retries reuse the same key!
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyId = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleFinish = () => {
    onSuccess();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="refund-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-lg border-2 border-black bg-white p-6 shadow-[4px_4px_0px_#000000] rounded-sm">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-black text-white flex items-center justify-center rounded-sm shrink-0">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="refund-modal-title"
                className="text-base font-bold text-neutral-900 tracking-tight"
              >
                {step === 'input' && 'Issue Refund'}
                {step === 'confirm' && 'Review & Confirm Refund'}
                {step === 'success' && 'Refund Execution Receipt'}
              </h2>
              <p className="text-[11px] font-mono text-neutral-500">
                Payment: {payment.id.slice(0, 20)}...
              </p>
            </div>
          </div>
          <button
            onClick={step === 'success' ? handleFinish : onClose}
            disabled={isLoading}
            aria-label="Close modal"
            className="p-1 text-neutral-400 hover:text-neutral-900 rounded-sm disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Backend / Client Error Alert */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-xs text-red-800 rounded-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold">{error}</p>
              {step === 'confirm' && (
                <p className="text-[11px] text-red-700 mt-1">
                  Idempotency key has been preserved. You can safely retry submission without creating a duplicate refund.
                </p>
              )}
            </div>
          </div>
        )}

        {/* STEP 1: CONFIGURE REFUND FORM */}
        {step === 'input' && (
          <div className="mt-4 space-y-4 text-xs">
            {/* Authoritative Financial Balance Summary */}
            <div className="p-3 bg-surface-subtle border border-border rounded-sm space-y-1.5 font-sans">
              <div className="flex justify-between text-neutral-600">
                <span>Original Transaction Amount:</span>
                <span className="font-mono font-semibold text-neutral-900">
                  {formatCurrency(payment.amount, payment.currency)}
                </span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Total Previously Refunded:</span>
                <span className="font-mono font-semibold text-neutral-900">
                  {formatCurrency(successfulRefundsTotal, payment.currency)}
                </span>
              </div>
              <div className="flex justify-between text-neutral-900 font-bold pt-1.5 border-t border-border">
                <span>Remaining Refundable:</span>
                <span className="font-mono text-emerald-700 text-sm">
                  {formatCurrency(maxRefundable, payment.currency)}
                </span>
              </div>
            </div>

            {/* Refund Configuration Form */}
            <form onSubmit={handleProceedToConfirm} noValidate className="space-y-4">
              {/* Full vs Partial Option Buttons */}
              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
                  Refund Scope
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAmount(maxRefundable.toString())}
                    className={`p-2.5 text-left border rounded-sm transition-colors ${
                      amount === maxRefundable.toString()
                        ? 'border-black bg-neutral-100 font-bold text-neutral-900'
                        : 'border-border bg-white text-neutral-600 hover:bg-surface-subtle'
                    }`}
                  >
                    <div className="font-semibold text-xs">Full Refund</div>
                    <div className="text-[11px] font-mono text-neutral-500 mt-0.5">
                      {formatCurrency(maxRefundable, payment.currency)}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (amount === maxRefundable.toString()) {
                        setAmount('');
                      }
                    }}
                    className={`p-2.5 text-left border rounded-sm transition-colors ${
                      amount !== maxRefundable.toString()
                        ? 'border-black bg-neutral-100 font-bold text-neutral-900'
                        : 'border-border bg-white text-neutral-600 hover:bg-surface-subtle'
                    }`}
                  >
                    <div className="font-semibold text-xs">Partial Refund</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">Custom amount</div>
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="refund-amount-input"
                    className="font-semibold uppercase tracking-wider text-neutral-700"
                  >
                    Refund Amount ({payment.currency})
                  </label>
                  <button
                    type="button"
                    onClick={() => setAmount(maxRefundable.toString())}
                    className="text-[11px] text-neutral-600 underline hover:text-black font-mono"
                  >
                    Max: {formatCurrency(maxRefundable, payment.currency)}
                  </button>
                </div>
                <Input
                  id="refund-amount-input"
                  type="number"
                  isMonospace
                  min="1"
                  max={maxRefundable}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter integer amount in IDR"
                  required
                  disabled={isLoading || maxRefundable <= 0}
                />
              </div>

              {/* Optional Reason Input */}
              <div>
                <label
                  htmlFor="refund-reason-input"
                  className="block font-semibold uppercase tracking-wider text-neutral-700 mb-1"
                >
                  Refund Reason (Optional)
                </label>
                <Input
                  id="refund-reason-input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Customer return, defective product, order cancellation"
                  maxLength={255}
                  disabled={isLoading || maxRefundable <= 0}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border mt-6">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={maxRefundable <= 0}
                >
                  <span>Review Refund</span>
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 2: REVIEW & CONFIRMATION */}
        {step === 'confirm' && (
          <div className="mt-4 space-y-4 text-xs">
            {/* Warning Callout */}
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-sm flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Irreversible Simulator Action</p>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  Executing this refund will lock the payment row, reserve funds in the gateway database, and dispatch a refund request to the external payment provider simulator.
                </p>
              </div>
            </div>

            {/* Confirmation Summary Card */}
            <div className="p-4 bg-surface-subtle border border-border rounded-sm divide-y divide-border space-y-2">
              <div className="pb-2 flex justify-between items-center">
                <span className="text-neutral-500 uppercase tracking-wider text-[10px] font-semibold">
                  Parent Payment ID
                </span>
                <span className="font-mono text-neutral-900 font-bold">
                  {payment.id}
                </span>
              </div>

              <div className="py-2 flex justify-between items-center">
                <span className="text-neutral-500 uppercase tracking-wider text-[10px] font-semibold">
                  Refund Amount
                </span>
                <span className="font-mono text-base font-bold text-neutral-900">
                  {formatCurrency(parsedAmount, payment.currency)}
                </span>
              </div>

              <div className="py-2 flex justify-between items-center">
                <span className="text-neutral-500 uppercase tracking-wider text-[10px] font-semibold">
                  Current Refundable Balance
                </span>
                <span className="font-mono text-neutral-700">
                  {formatCurrency(maxRefundable, payment.currency)}
                </span>
              </div>

              <div className="py-2 flex justify-between items-center">
                <span className="text-neutral-500 uppercase tracking-wider text-[10px] font-semibold">
                  Estimated Remaining Balance
                </span>
                <span className="font-mono font-bold text-neutral-900">
                  {formatCurrency(Math.max(0, maxRefundable - parsedAmount), payment.currency)}
                </span>
              </div>

              <div className="py-2 flex justify-between items-start">
                <span className="text-neutral-500 uppercase tracking-wider text-[10px] font-semibold">
                  Reason
                </span>
                <span className="text-neutral-800 text-right max-w-xs break-words">
                  {reason.trim() || 'No reason provided'}
                </span>
              </div>

              <div className="pt-2 flex justify-between items-center text-[10px] text-neutral-500 font-mono">
                <span>Idempotency-Key</span>
                <span title={idempotencyKey}>{idempotencyKey.slice(0, 18)}...</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-border mt-6">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null);
                  setStep('input');
                }}
                disabled={isLoading}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back / Edit</span>
              </Button>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleExecuteRefund}
                isLoading={isLoading}
                disabled={isLoading}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{error ? 'Retry Submission' : 'Confirm & Execute Refund'}</span>
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS RECEIPT */}
        {step === 'success' && createdRefund && (
          <div className="mt-4 space-y-4 text-xs">
            {/* Success Status Banner */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-sm flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Refund Successfully Recorded</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  The backend has processed the refund with status{' '}
                  <span className="font-mono font-bold uppercase">{createdRefund.status}</span>.
                </p>
              </div>
            </div>

            {/* Authoritative Receipt Details */}
            <div className="p-4 bg-surface-subtle border border-border rounded-sm divide-y divide-border space-y-2">
              <div className="pb-2 flex justify-between items-center">
                <span className="text-neutral-500 uppercase tracking-wider text-[10px] font-semibold">
                  Refund ID
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-neutral-900">
                    {createdRefund.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyId(createdRefund.id)}
                    className="text-neutral-400 hover:text-black p-0.5 rounded"
                    title="Copy Refund ID"
                  >
                    {copiedKey ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              <div className="py-2 flex justify-between items-center">
                <span className="text-neutral-500 uppercase tracking-wider text-[10px] font-semibold">
                  Authoritative Status
                </span>
                <StatusBadge status={createdRefund.status} />
              </div>

              <div className="py-2 flex justify-between items-center">
                <span className="text-neutral-500 uppercase tracking-wider text-[10px] font-semibold">
                  Amount Refunded
                </span>
                <span className="font-mono text-sm font-bold text-neutral-900">
                  {formatCurrency(createdRefund.amount, createdRefund.currency || payment.currency)}
                </span>
              </div>

              <div className="py-2 flex justify-between items-center">
                <span className="text-neutral-500 uppercase tracking-wider text-[10px] font-semibold">
                  Provider Reference
                </span>
                <span className="font-mono text-neutral-700">
                  {createdRefund.providerReference || 'Pending simulator callback'}
                </span>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <span className="text-neutral-500 uppercase tracking-wider text-[10px] font-semibold">
                  Timestamp
                </span>
                <span className="font-mono text-neutral-500 text-[11px]">
                  {formatDateTime(createdRefund.createdAt)}
                </span>
              </div>
            </div>

            {/* Action Close */}
            <div className="flex items-center justify-end pt-4 border-t border-border mt-6">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleFinish}
              >
                <span>Done & Revalidate</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
