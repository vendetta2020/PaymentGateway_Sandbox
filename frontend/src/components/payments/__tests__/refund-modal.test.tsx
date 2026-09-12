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
    totalRefunded: 50000,
    refundableAmount: 100000,
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

  it('renders refund modal with correct backend-provided remaining refundable balance', () => {
    render(
      <RefundModal
        payment={mockPayment}
        existingRefunds={mockRefunds}
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Remaining Refundable:/i)).toBeInTheDocument();
    expect(screen.getAllByText('Rp 100.000').length).toBeGreaterThan(0);
    expect(screen.getByText(/Total Previously Refunded:/i)).toBeInTheDocument();
    expect(screen.getByText('Rp 50.000')).toBeInTheDocument();
  });

  it('allows selecting Full Refund and populates max refundable amount', () => {
    render(
      <RefundModal
        payment={mockPayment}
        existingRefunds={mockRefunds}
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    const amountInput = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '25000' } });
    expect(amountInput.value).toBe('25000');

    const fullRefundBtn = screen.getByRole('button', { name: /full refund/i });
    fireEvent.click(fullRefundBtn);

    expect(amountInput.value).toBe('100000');
  });

  it('prevents proceeding with an over-refund amount exceeding backend refundable balance', async () => {
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

    const reviewBtn = screen.getByRole('button', { name: /review refund/i });
    fireEvent.click(reviewBtn);

    await waitFor(() => {
      expect(screen.getByText(/exceeds remaining balance/i)).toBeInTheDocument();
    });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('prevents proceeding with a non-positive or zero amount', async () => {
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
    fireEvent.change(amountInput, { target: { value: '0' } });

    const reviewBtn = screen.getByRole('button', { name: /review refund/i });
    fireEvent.click(reviewBtn);

    await waitFor(() => {
      expect(screen.getByText(/must be a positive integer/i)).toBeInTheDocument();
    });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('navigates to confirmation step and displays review details before submitting', async () => {
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
    fireEvent.change(amountInput, { target: { value: '40000' } });

    const reasonInput = screen.getByPlaceholderText(/customer return/i);
    fireEvent.change(reasonInput, { target: { value: 'Damaged packaging' } });

    const reviewBtn = screen.getByRole('button', { name: /review refund/i });
    fireEvent.click(reviewBtn);

    await waitFor(() => {
      expect(screen.getByText(/Review & Confirm Refund/i)).toBeInTheDocument();
      expect(screen.getByText(/Irreversible Simulator Action/i)).toBeInTheDocument();
      expect(screen.getByText('Rp 40.000')).toBeInTheDocument();
      expect(screen.getByText('Damaged packaging')).toBeInTheDocument();
      expect(screen.getByText(mockPayment.id)).toBeInTheDocument();
    });

    // Verify back button allows returning to edit
    const backBtn = screen.getByRole('button', { name: /back \/ edit/i });
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(screen.getByText(/Issue Refund/i)).toBeInTheDocument();
    });
  });

  it('submits valid refund to backend with Idempotency-Key and renders success receipt', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    const mockCreatedRefund: RefundPresentation = {
      id: 'ref_new_987654',
      paymentId: mockPayment.id,
      amount: 50000,
      currency: 'IDR',
      reason: 'Part return',
      status: 'SUCCESS',
      providerReference: 'sim_ref_987654',
      createdAt: new Date().toISOString(),
    };

    (api.post as any).mockResolvedValueOnce({
      status: 'success',
      data: mockCreatedRefund,
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

    const reviewBtn = screen.getByRole('button', { name: /review refund/i });
    fireEvent.click(reviewBtn);

    await waitFor(() => {
      expect(screen.getByText(/Review & Confirm Refund/i)).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole('button', { name: /confirm & execute refund/i });
    fireEvent.click(confirmBtn);

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
    });

    // Verify Step 3: Success Receipt is displayed
    await waitFor(() => {
      expect(screen.getByText(/Refund Execution Receipt/i)).toBeInTheDocument();
      expect(screen.getByText('ref_new_987654')).toBeInTheDocument();
      expect(screen.getByText('sim_ref_987654')).toBeInTheDocument();
    });

    // Clicking Done triggers onSuccess and onClose
    const doneBtn = screen.getByRole('button', { name: /done & revalidate/i });
    fireEvent.click(doneBtn);

    expect(handleSuccess).toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalled();
  });

  it('preserves the same Idempotency-Key on retry when backend rejects with an error', async () => {
    (api.post as any)
      .mockRejectedValueOnce(new Error('Simulator timeout on refund endpoint'))
      .mockResolvedValueOnce({
        status: 'success',
        data: {
          id: 'ref_retried_123',
          paymentId: mockPayment.id,
          amount: 30000,
          currency: 'IDR',
          status: 'SUCCESS',
          providerReference: 'sim_retry_123',
          createdAt: new Date().toISOString(),
        },
      });

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
    fireEvent.change(amountInput, { target: { value: '30000' } });

    fireEvent.click(screen.getByRole('button', { name: /review refund/i }));

    await waitFor(() => {
      expect(screen.getByText(/Review & Confirm Refund/i)).toBeInTheDocument();
    });

    // First attempt fails
    fireEvent.click(screen.getByRole('button', { name: /confirm & execute refund/i }));

    await waitFor(() => {
      expect(screen.getByText(/Simulator timeout on refund endpoint/i)).toBeInTheDocument();
      expect(screen.getByText(/Idempotency key has been preserved/i)).toBeInTheDocument();
    });

    const firstCallKey = (api.post as any).mock.calls[0][2].idempotencyKey;
    expect(firstCallKey).toBeDefined();

    // Click retry
    const retryBtn = screen.getByRole('button', { name: /retry submission/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledTimes(2);
    });

    const secondCallKey = (api.post as any).mock.calls[1][2].idempotencyKey;
    expect(secondCallKey).toBe(firstCallKey); // CRITICAL: Reused identical key!

    await waitFor(() => {
      expect(screen.getByText('ref_retried_123')).toBeInTheDocument();
    });
  });

  it('closes modal on Escape key press when not submitting', () => {
    const handleClose = vi.fn();

    render(
      <RefundModal
        payment={mockPayment}
        existingRefunds={mockRefunds}
        isOpen={true}
        onClose={handleClose}
        onSuccess={vi.fn()}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalled();
  });
});
