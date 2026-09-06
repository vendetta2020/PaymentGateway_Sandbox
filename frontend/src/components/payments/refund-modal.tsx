'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/formatters';
import { PaymentPresentation, RefundPresentation } from '@/types/domain';
import { X, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface RefundModalProps {
  payment: PaymentPresentation;
  existingRefunds: RefundPresentation[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RefundModal({
  payment,
  existingRefunds,
  isOpen,
  onClose,
  onSuccess,
}: RefundModalProps) {
  const successfulRefundsTotal = payment.totalRefunded ?? 0;
  const maxRefundable = payment.refundableAmount ?? payment.amount;

  const [amount, setAmount] = useState(maxRefundable.toString());
  const [reason, setReason] = useState('Customer requested refund');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseInt(amount, 10);
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

    setIsLoading(true);
    const idempotencyKey = crypto.randomUUID();

    try {
      await api.post(
        `/payments/${payment.id}/refunds`,
        {
          amount: parsedAmount,
          currency: payment.currency,
          reason,
        },
        { idempotencyKey },
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to process refund on backend');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="refund-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-md border-2 border-black bg-white p-6 shadow-[4px_4px_0px_#000000] rounded-sm">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-black text-white flex items-center justify-center rounded-sm">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h2 id="refund-modal-title" className="text-base font-bold text-neutral-900 tracking-tight">
                Issue Refund
              </h2>
              <p className="text-[11px] font-mono text-neutral-500">
                {payment.id.slice(0, 20)}...
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-neutral-400 hover:text-neutral-900 rounded-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-xs text-red-800 rounded-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-4 p-3 bg-surface-subtle border border-border rounded-sm text-xs space-y-1">
          <div className="flex justify-between text-neutral-600">
            <span>Original Transaction:</span>
            <span className="font-mono font-semibold text-neutral-900">
              {formatCurrency(payment.amount, payment.currency)}
            </span>
          </div>
          <div className="flex justify-between text-neutral-600">
            <span>Already Refunded:</span>
            <span className="font-mono font-semibold text-neutral-900">
              {formatCurrency(successfulRefundsTotal, payment.currency)}
            </span>
          </div>
          <div className="flex justify-between text-neutral-900 font-bold pt-1 border-t border-border">
            <span>Remaining Refundable:</span>
            <span className="font-mono text-emerald-700">
              {formatCurrency(maxRefundable, payment.currency)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4 text-xs">
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
                className="text-[11px] text-neutral-600 underline hover:text-black"
              >
                Max ({formatCurrency(maxRefundable, payment.currency)})
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
              required
              disabled={isLoading || maxRefundable <= 0}
            />
          </div>

          <div>
            <label className="block font-semibold uppercase tracking-wider text-neutral-700 mb-1">
              Refund Reason
            </label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer return, defective product"
              disabled={isLoading || maxRefundable <= 0}
            />
          </div>

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
              isLoading={isLoading}
              disabled={maxRefundable <= 0}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Submit Refund</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
