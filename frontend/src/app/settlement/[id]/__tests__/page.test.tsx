import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SettlementDetailPage from '../page';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useRouter, useParams } from 'next/navigation';

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
  useParams: vi.fn(),
}));

describe('SettlementDetailPage', () => {
  const mockPush = vi.fn();
  
  beforeEach(() => {
    vi.resetAllMocks();
    (useAuth as any).mockReturnValue({ isAuthenticated: true });
    (useRouter as any).mockReturnValue({ push: mockPush });
    (useParams as any).mockReturnValue({ id: 'settlement-123' });
  });

  it('requests correct settlement ID and renders data', async () => {
    const mockData = {
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
    };

    (api.get as any).mockResolvedValue({
      status: 'success',
      data: mockData,
    });

    render(<SettlementDetailPage />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/settlements/settlement-123');
      expect(screen.getAllByText(/SETTLE-XYZ-123/i).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/150/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/20/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/130/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Settled/i).length).toBeGreaterThan(0);
  });

  it('renders error state when API fails', async () => {
    (api.get as any).mockRejectedValue(new Error('Not Found'));
    
    render(<SettlementDetailPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Unable to Load Settlement')).toBeInTheDocument();
      expect(screen.getByText('Not Found')).toBeInTheDocument();
    });
  });

  it('allows back navigation', async () => {
    (api.get as any).mockRejectedValue(new Error('Not Found'));
    
    render(<SettlementDetailPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Back to Settlements')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Back to Settlements'));
    expect(mockPush).toHaveBeenCalledWith('/settlement');
  });
  
  it('does not render sensitive data like merchant identity implicitly', async () => {
    const mockData = {
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
      merchantId: 'hidden-merchant-id',
    };

    (api.get as any).mockResolvedValue({ status: 'success', data: mockData });
    render(<SettlementDetailPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/SETTLE-XYZ-123/i).length).toBeGreaterThan(0);
    });

    const bodyText = document.body.textContent || '';
    expect(bodyText).not.toContain('hidden-merchant-id');
  });
});
