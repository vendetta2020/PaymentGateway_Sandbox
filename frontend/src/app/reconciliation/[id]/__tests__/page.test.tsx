import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ReconciliationDetailPage from '../page';
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

describe('ReconciliationDetailPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (useAuth as any).mockReturnValue({ isAuthenticated: true });
    (useRouter as any).mockReturnValue({ push: vi.fn() });
    (useParams as any).mockReturnValue({ id: 'recon-123' });
  });

  it('requests correct reconciliation ID and renders run summary', async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url === '/reconciliations/recon-123') {
        return Promise.resolve({
          status: 'success',
          data: {
            id: 'recon-123',
            status: 'COMPLETED',
            matchedCount: 150,
            discrepancyCount: 3,
            periodStart: '2026-09-01T00:00:00Z',
            periodEnd: '2026-09-02T00:00:00Z',
            createdAt: '2026-09-02T10:00:00Z',
          }
        });
      }
      if (url === '/reconciliations/recon-123/results') {
        return Promise.resolve({ status: 'success', data: [] });
      }
    });

    render(<ReconciliationDetailPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/Completed/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/150/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/3/i).length).toBeGreaterThan(0);
    });
  });

  it('renders perfect match empty state when no discrepancies exist', async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url === '/reconciliations/recon-123') {
        return Promise.resolve({
          status: 'success',
          data: { id: 'recon-123', status: 'COMPLETED', matchedCount: 150, discrepancyCount: 0 }
        });
      }
      if (url === '/reconciliations/recon-123/results') {
        return Promise.resolve({ 
          status: 'success', 
          data: [{ id: 'res-1', discrepancyType: 'MATCHED' }] 
        });
      }
    });

    render(<ReconciliationDetailPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/Perfect Match/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/No discrepancies were found/i).length).toBeGreaterThan(0);
    });
  });

  it('renders discrepancy classifications correctly', async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url === '/reconciliations/recon-123') {
        return Promise.resolve({
          status: 'success',
          data: { id: 'recon-123', status: 'COMPLETED', matchedCount: 0, discrepancyCount: 5 }
        });
      }
      if (url === '/reconciliations/recon-123/results') {
        return Promise.resolve({
          status: 'success',
          data: [
            { id: 'res-1', discrepancyType: 'AMOUNT_MISMATCH', internalAmount: 150000, providerAmount: 100000, internalCurrency: 'IDR', providerCurrency: 'IDR' },
            { id: 'res-2', discrepancyType: 'MISSING_IN_PROVIDER' },
            { id: 'res-3', discrepancyType: 'MISSING_IN_INTERNAL' },
            { id: 'res-4', discrepancyType: 'STATUS_MISMATCH' },
            { id: 'res-5', discrepancyType: 'CURRENCY_MISMATCH' },
            { id: 'res-6', discrepancyType: 'DUPLICATE_PROVIDER_REFERENCE' },
          ]
        });
      }
    });

    render(<ReconciliationDetailPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/AMOUNT MISMATCH/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/150/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/100/i).length).toBeGreaterThan(0);
      
      expect(screen.getAllByText(/MISSING IN PROVIDER/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/MISSING IN INTERNAL/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/STATUS MISMATCH/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/CURRENCY MISMATCH/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/DUPLICATE PROVIDER REFERENCE/i).length).toBeGreaterThan(0);
    });
  });

  it('renders error state on API failure', async () => {
    (api.get as any).mockRejectedValue(new Error('Internal Server Error'));
    render(<ReconciliationDetailPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Unable to Load Reconciliation Run')).toBeInTheDocument();
      expect(screen.getByText('Internal Server Error')).toBeInTheDocument();
    });
  });
});
