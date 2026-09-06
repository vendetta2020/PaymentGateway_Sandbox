import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PaymentDetailPage from '../page';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

vi.mock('@/lib/api-client', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(),
}));

vi.mock('next/link', () => {
  return {
    default: ({ children, href }: { children: React.ReactNode; href: string }) => {
      return <a href={href}>{children}</a>;
    },
  };
});

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'pay_123' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

describe('PaymentDetailPage', () => {
  const mockParams = Promise.resolve({ id: 'pay_123' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    (useAuth as any).mockReturnValue({ isAuthenticated: true });
    (api.get as any).mockReturnValue(new Promise(() => {}));
    
    render(<PaymentDetailPage />);
    
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders payment details correctly', async () => {
    (useAuth as any).mockReturnValue({ isAuthenticated: true });
    
    const mockPayment = {
      id: 'pay_123',
      orderId: 'ORD-001',
      amount: 150000,
      currency: 'IDR',
      status: 'SUCCEEDED',
      paymentMethod: 'QRIS',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalRefunded: 0,
      refundableAmount: 150000,
    };

    (api.get as any).mockImplementation((url: string) => {
      if (url.endsWith('/refunds')) {
        return Promise.resolve({ status: 'success', data: [] });
      }
      return Promise.resolve({ status: 'success', data: mockPayment });
    });

    render(<PaymentDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('pay_123')).toBeInTheDocument();
    });
    
    expect(screen.getByText('ORD-001')).toBeInTheDocument();
    expect(screen.getByText('Rp 150.000')).toBeInTheDocument();
    expect(screen.getAllByText('QRIS').length).toBeGreaterThan(0);
  });

  it('renders error state on API failure', async () => {
    (useAuth as any).mockReturnValue({ isAuthenticated: true });
    
    (api.get as any).mockRejectedValue(new Error('Failed to fetch'));

    render(<PaymentDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch/i)).toBeInTheDocument();
    });
  });
});
