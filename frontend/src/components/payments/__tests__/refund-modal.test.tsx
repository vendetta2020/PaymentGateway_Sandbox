import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RefundModal } from '../refund-modal';
import { api } from '@/lib/api-client';
import { PaymentPresentation, RefundPresentation } from '@/types/domain';

vi.mock('@/lib/api-client', () => ({
  api: {
    post: vi.fn(),
  },
}));

describe('RefundModal', () => {
  const mockPayment: PaymentPresentation = {
    id: 'pay_test_1234567890',
    merchantId: 'merch_123',
    orderId: 'ORD-001',
    amount: 150000,
    currency: 'IDR',
    status: 'SUCCEEDED',
    paymentMethod: 'QRIS',
    providerReference: 'sim_123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockRefunds: RefundPresentation[] = [
    {
      id: 'ref_1',
      paymentId: 'pay_test_1234567890',
      amount: 50000,
      reason: 'Part return',
      status: 'SUCCESS',
      providerReference: 'sim_ref_1',
      createdAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders refund modal with correct remaining refundable balance', () => {
    render(
      <RefundModal
        payment={mockPayment}
        existingRefunds={mockRefunds}
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    // Original: 150.000, already refunded: 50.000 -> remaining: 100.000
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Remaining Refundable:/i)).toBeInTheDocument();
    expect(screen.getByText('Rp 100.000')).toBeInTheDocument();
  });

  it('prevents submitting an over-refund amount exceeding remaining balance', async () => {
    render(
      <RefundModal
        payment={mockPayment}
        existingRefunds={mockRefunds}
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    const amountInput = screen.getByRole('spinbutton');
    fireEvent.change(amountInput, { target: { value: '200000' } });

    const submitBtn = screen.getByRole('button', { name: /submit refund/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/exceeds remaining balance/i)).toBeInTheDocument();
    });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('submits valid refund to backend with Idempotency-Key and calls onSuccess', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    (api.post as any).mockResolvedValueOnce({
      status: 'success',
      data: { id: 'ref_new', status: 'SUCCESS' },
    });

    render(
      <RefundModal
        payment={mockPayment}
        existingRefunds={mockRefunds}
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />,
    );

    const amountInput = screen.getByRole('spinbutton');
    fireEvent.change(amountInput, { target: { value: '50000' } });

    const submitBtn = screen.getByRole('button', { name: /submit refund/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        `/payments/${mockPayment.id}/refunds`,
        expect.objectContaining({
          amount: 50000,
          currency: 'IDR',
        }),
        expect.objectContaining({
          idempotencyKey: expect.any(String),
        }),
      );
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('displays backend error message on failure', async () => {
    (api.post as any).mockRejectedValueOnce(
      new Error('Refund rejected by simulator: payment already finalized'),
    );

    render(
      <RefundModal
        payment={mockPayment}
        existingRefunds={mockRefunds}
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    const amountInput = screen.getByRole('spinbutton');
    fireEvent.change(amountInput, { target: { value: '10000' } });

    const submitBtn = screen.getByRole('button', { name: /submit refund/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Refund rejected by simulator: payment already finalized/i),
      ).toBeInTheDocument();
    });
  });
});
