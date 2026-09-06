import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreatePaymentModal } from '../create-payment-modal';
import { api } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  api: {
    post: vi.fn(),
  },
}));

describe('CreatePaymentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with required inputs when open', () => {
    render(
      <CreatePaymentModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Create New Mock Payment')).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount/i)).toBeInTheDocument();

    const options = screen.getAllByRole('option');
    const values = options.map((opt) => (opt as HTMLOptionElement).value);
    expect(values).toEqual(['QRIS', 'VIRTUAL_ACCOUNT', 'EWALLET', 'CARD']);
  });

  it('submits payment with positive integer amount and idempotencyKey without metadata', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    (api.post as any).mockResolvedValueOnce({
      status: 'success',
      data: { id: 'pay_new_001', status: 'PENDING' },
    });

    render(
      <CreatePaymentModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />,
    );

    const submitBtn = screen.getByRole('button', { name: /create payment/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/payments',
        expect.objectContaining({
          amount: expect.any(Number),
          currency: 'IDR',
          paymentMethod: 'QRIS',
        }),
        expect.objectContaining({
          idempotencyKey: expect.any(String),
        }),
      );
      const callPayload = (api.post as any).mock.calls[0][1];
      expect(callPayload).not.toHaveProperty('metadata');
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
