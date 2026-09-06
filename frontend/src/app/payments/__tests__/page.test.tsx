import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PaymentsPage from '../page';
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

describe('PaymentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially when authenticated', () => {
    (useAuth as any).mockReturnValue({ isAuthenticated: true });
    (api.get as any).mockReturnValue(new Promise(() => {})); // Never resolves
    
    render(<PaymentsPage />);
    
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Fetching payments/i)).toBeInTheDocument();
  });

  it('renders payments list correctly', async () => {
    (useAuth as any).mockReturnValue({ isAuthenticated: true });
    
    const mockPayments = [
      {
        id: 'pay_123',
        orderId: 'ORD-001',
        amount: 150000,
        currency: 'IDR',
        paymentMethod: 'QRIS',
        status: 'SUCCEEDED',
        createdAt: new Date().toISOString(),
      }
    ];

    (api.get as any).mockResolvedValueOnce({
      status: 'success',
      data: mockPayments,
      meta: { limit: 10, offset: 0, total: 1 }
    });

    render(<PaymentsPage />);

    await waitFor(() => {
      expect(screen.getByText('pay_123...')).toBeInTheDocument();
    });
    expect(screen.getByText('ORD-001')).toBeInTheDocument();
    expect(screen.getByText('Rp 150.000')).toBeInTheDocument();
    expect(screen.getByText('QRIS')).toBeInTheDocument();
  });

  it('renders empty state if no payments', async () => {
    (useAuth as any).mockReturnValue({ isAuthenticated: true });
    
    (api.get as any).mockResolvedValueOnce({
      status: 'success',
      data: [],
      meta: { limit: 10, offset: 0, total: 0 }
    });

    render(<PaymentsPage />);

    await waitFor(() => {
      expect(screen.getByText(/No payment records found/i)).toBeInTheDocument();
    });
  });

  it('renders API error state', async () => {
    (useAuth as any).mockReturnValue({ isAuthenticated: true });
    
    (api.get as any).mockRejectedValueOnce(new Error('Gateway Timeout'));

    render(<PaymentsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Gateway Timeout/i)).toBeInTheDocument();
    });
  });
});
