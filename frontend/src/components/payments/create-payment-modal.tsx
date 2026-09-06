'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api-client';
import { X, Plus, CreditCard } from 'lucide-react';

export interface CreatePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreatePaymentModal({ isOpen, onClose, onSuccess }: CreatePaymentModalProps) {
  const [orderId, setOrderId] = useState(`ORD-${Date.now().toString().slice(-6)}`);
  const [amount, setAmount] = useState('150000');
  const [currency, setCurrency] = useState('IDR');
  const [paymentMethod, setPaymentMethod] = useState<'QRIS' | 'BANK_TRANSFER' | 'E_WALLET' | 'CREDIT_CARD'>('QRIS');
  const [customerEmail, setCustomerEmail] = useState('buyer@example.com');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be a positive integer');
      return;
    }

    setIsLoading(true);
    const idempotencyKey = crypto.randomUUID();

    try {
      await api.post(
        '/payments',
        {
          orderId,
          amount: parsedAmount,
          currency,
          paymentMethod,
          metadata: {
            customerEmail,
          },
        },
        { idempotencyKey },
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create payment');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-payment-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-lg border-2 border-black bg-white p-6 shadow-[4px_4px_0px_#000000] rounded-sm">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-black text-white flex items-center justify-center rounded-sm">
              <CreditCard className="w-4 h-4" />
            </div>
            <h2 id="create-payment-title" className="text-base font-bold text-neutral-900 tracking-tight">
              Create New Mock Payment
            </h2>
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
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-xs text-red-800 rounded-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs">
          <div>
            <label
              htmlFor="order-id-input"
              className="block font-semibold uppercase tracking-wider text-neutral-700 mb-1"
            >
              Order ID
            </label>
            <Input
              id="order-id-input"
              isMonospace
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="amount-input"
                className="block font-semibold uppercase tracking-wider text-neutral-700 mb-1"
              >
                Amount (Integer Rupiah)
              </label>
              <Input
                id="amount-input"
                type="number"
                isMonospace
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div>
              <label
                htmlFor="currency-input"
                className="block font-semibold uppercase tracking-wider text-neutral-700 mb-1"
              >
                Currency
              </label>
              <Input
                id="currency-input"
                isMonospace
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold uppercase tracking-wider text-neutral-700 mb-1">
              Payment Method
            </label>
            <Select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              disabled={isLoading}
              options={[
                { value: 'QRIS', label: 'QRIS (Simulated Static QR)' },
                { value: 'BANK_TRANSFER', label: 'Virtual Account (Bank Transfer)' },
                { value: 'E_WALLET', label: 'E-Wallet (OVO / GoPay / DANA)' },
                { value: 'CREDIT_CARD', label: 'Credit Card (Simulated 3DS)' },
              ]}
            />
          </div>

          <div>
            <label className="block font-semibold uppercase tracking-wider text-neutral-700 mb-1">
              Customer Email
            </label>
            <Input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              disabled={isLoading}
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
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Payment</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
