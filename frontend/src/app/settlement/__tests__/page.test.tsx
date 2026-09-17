import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SettlementPage from '../page';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

vi.mock('@/lib/api-client', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

describe('SettlementPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (useAuth as any).mockReturnValue({ isAuthenticated: true });
    (useRouter as any).mockReturnValue({ push: vi.fn() });
  });

  it('renders loading state initially', async () => {
    (api.get as any).mockImplementation(() => new Promise(() => {})); // Never resolves
    render(<SettlementPage />);
    expect(screen.getByText('Fetching settlement batches from gateway...')).toBeInTheDocument();
  });

  it('renders error state on API failure and allows retry', async () => {
    (api.get as any).mockRejectedValue(new Error('Network error'));
    
    render(<SettlementPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Unable to Load Settlements')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    // Mock success for retry
    (api.get as any).mockResolvedValue({ status: 'success', data: [], meta: { total: 0 } });
    
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    
    await waitFor(() => {
      expect(screen.getByText('No Settlement Batches Found')).toBeInTheDocument();
    });
  });

  it('renders empty state when no records exist', async () => {
    (api.get as any).mockResolvedValue({ status: 'success', data: [], meta: { total: 0 } });
    render(<SettlementPage />);
    await waitFor(() => {
      expect(screen.getByText('No Settlement Batches Found')).toBeInTheDocument();
    });
  });

  it('renders settlement list from API correctly', async () => {
    const mockData = [
      {
        id: 'settlement-123',
        settlementReference: 'SETTLE-XYZ-123',
        status: 'SETTLED',
        grossAmount: 150000,
        refundAmount: 20000,
        netAmount: 130000,
        currency: 'IDR',
        periodStart: '2026-09-01T00:00:00Z',
        periodEnd: '2026-09-02T00:00:00Z',
        createdAt: '2026-09-02T10:00:00Z',
      }
    ];

    (api.get as any).mockResolvedValue({
      status: 'success',
      data: mockData,
      meta: { total: 1, limit: 20, offset: 0 }
    });

    render(<SettlementPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/SETTLE-XYZ-123/i).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/150/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/20/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/130/i).length).toBeGreaterThan(0);
    
    expect(screen.getAllByText(/Settled/i).length).toBeGreaterThan(0);
    
    const viewLink = screen.getByRole('link', { name: /view/i });
    expect(viewLink).toHaveAttribute('href', '/settlement/settlement-123');
  });

  it('handles malformed data gracefully', async () => {
    const mockData = [
      {
        id: 'settlement-456',
        status: 'UNKNOWN_STATUS',
        grossAmount: 50000,
        refundAmount: 0,
        netAmount: 50000,
        currency: 'IDR',
        periodStart: '2026-09-01T00:00:00Z',
        periodEnd: '2026-09-02T00:00:00Z',
        createdAt: '2026-09-02T10:00:00Z',
      }
    ];

    (api.get as any).mockResolvedValue({
      status: 'success',
      data: mockData,
      meta: { total: 1, limit: 20, offset: 0 }
    });

    render(<SettlementPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/50/i).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/UNKNOWN_STATUS/i).length).toBeGreaterThan(0);
  });
});
