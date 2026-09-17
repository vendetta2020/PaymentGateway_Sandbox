import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ReconciliationPage from '../page';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

vi.mock('@/lib/api-client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

describe('ReconciliationPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (useAuth as any).mockReturnValue({ isAuthenticated: true });
    (useRouter as any).mockReturnValue({ push: vi.fn() });
  });

  it('renders loading state initially', async () => {
    (api.get as any).mockImplementation(() => new Promise(() => {}));
    render(<ReconciliationPage />);
    expect(screen.getByText('Fetching reconciliation runs...')).toBeInTheDocument();
  });

  it('renders empty state when no runs exist', async () => {
    (api.get as any).mockResolvedValue({ status: 'success', data: [], meta: { total: 0 } });
    render(<ReconciliationPage />);
    await waitFor(() => {
      expect(screen.getByText('No Reconciliation Cycles Found')).toBeInTheDocument();
    });
  });

  it('renders error state on API failure', async () => {
    (api.get as any).mockRejectedValue(new Error('Network error'));
    render(<ReconciliationPage />);
    await waitFor(() => {
      expect(screen.getByText('Reconciliation Error')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('renders reconciliation list from API correctly', async () => {
    const mockData = [
      {
        id: 'recon-123',
        status: 'COMPLETED',
        matchedCount: 150,
        discrepancyCount: 2,
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

    render(<ReconciliationPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/recon-123/i).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/150/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Completed/i).length).toBeGreaterThan(0);
    
    const viewLink = screen.getByRole('link', { name: /view/i });
    expect(viewLink).toHaveAttribute('href', '/reconciliation/recon-123');
  });

  it('triggers Run Reconciliation and refreshes list', async () => {
    (api.get as any).mockResolvedValue({ status: 'success', data: [], meta: { total: 0 } });
    (api.post as any).mockResolvedValue({ status: 'success', data: { id: 'recon-999' } });

    render(<ReconciliationPage />);

    await waitFor(() => {
      expect(screen.getByText('No Reconciliation Cycles Found')).toBeInTheDocument();
    });

    const runButtons = screen.getAllByRole('button', { name: /Run (First )?Reconciliation/i });
    fireEvent.click(runButtons[0]);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/reconciliations', expect.any(Object));
    });

    expect(api.get).toHaveBeenCalledTimes(2);
  });
});
