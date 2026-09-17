import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

import WebhooksPage from '../page';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

vi.mock('@/lib/api-client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(),
}));

describe('WebhooksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
      isAuthenticated: true,
      merchant: { id: 'merch-123' },
    });
  });

  it('renders loading state initially', () => {
    (api.get as any).mockReturnValue(new Promise(() => {})); // Never resolves
    render(<WebhooksPage />);

    expect(screen.getByText(/Fetching registered webhook endpoints.../i)).toBeInTheDocument();
    expect(screen.getByText(/Fetching delivery telemetry from gateway.../i)).toBeInTheDocument();
  });

  it('renders configured endpoints and deliveries from API', async () => {
    const mockConfigs = [
      {
        id: 'cfg-1',
        merchantId: 'merch-123',
        endpointUrl: 'https://example.com/webhooks',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const mockDeliveries = [
      {
        id: 'del-1',
        webhookEventId: 'evt-1',
        webhookConfigId: 'cfg-1',
        status: 'DELIVERED',
        attemptCount: 1,
        lastHttpStatus: 200,
        lastError: null,
        deliveredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        webhookEvent: {
          id: 'evt-1',
          eventType: 'payment.succeeded',
          paymentId: 'pay-uuid-456',
          payload: { id: 'evt-1', type: 'payment.succeeded' },
        },
      },
      {
        id: 'del-2',
        webhookEventId: 'evt-2',
        webhookConfigId: 'cfg-1',
        status: 'FAILED',
        attemptCount: 2,
        lastHttpStatus: 500,
        lastError: 'Simulated failure',
        deliveredAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        webhookEvent: {
          id: 'evt-2',
          eventType: 'payment.created',
          paymentId: 'pay-uuid-789',
          payload: { id: 'evt-2', type: 'payment.created' },
        },
      },
    ];

    (api.get as any).mockImplementation((url: string) => {
      if (url === '/webhook-configs') {
        return Promise.resolve({ status: 'success', data: mockConfigs });
      }
      if (url === '/webhook-deliveries') {
        return Promise.resolve({ status: 'success', data: mockDeliveries });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(<WebhooksPage />);

    await waitFor(() => {
      expect(screen.getByText('https://example.com/webhooks')).toBeInTheDocument();
      expect(screen.getByText('payment.succeeded')).toBeInTheDocument();
      expect(screen.getByText('payment.created')).toBeInTheDocument();
    });

    expect(screen.getByText('1 / 5')).toBeInTheDocument();
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
    expect(screen.getByText('HTTP 200')).toBeInTheDocument();
    expect(screen.getByText('HTTP 500')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders empty states when no configs or deliveries exist', async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url === '/webhook-configs') {
        return Promise.resolve({ status: 'success', data: [] });
      }
      if (url === '/webhook-deliveries') {
        return Promise.resolve({ status: 'success', data: [] });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(<WebhooksPage />);

    await waitFor(() => {
      expect(screen.getByText(/No webhook endpoints registered/i)).toBeInTheDocument();
      expect(screen.getByText(/No webhook events recorded yet/i)).toBeInTheDocument();
    });
  });

  it('registers new webhook endpoint and displays one-time signing secret', async () => {
    (api.get as any).mockResolvedValue({ status: 'success', data: [] });
    (api.post as any).mockResolvedValueOnce({
      status: 'success',
      data: {
        id: 'cfg-new',
        merchantId: 'merch-123',
        endpointUrl: 'https://myserver.com/hooks',
        status: 'ACTIVE',
        signingSecret: 'whsec_testsecret1234567890abcdef',
        createdAt: new Date().toISOString(),
      },
    });

    render(<WebhooksPage />);

    await waitFor(() => {
      expect(screen.getByText(/No webhook endpoints registered/i)).toBeInTheDocument();
    });

    // Open register endpoint modal
    const registerBtn = screen.getByRole('button', { name: /register endpoint/i });
    fireEvent.click(registerBtn);

    expect(screen.getByRole('heading', { name: /register webhook endpoint/i })).toBeInTheDocument();

    // Fill form
    const urlInput = screen.getByPlaceholderText(/your-merchant-server/i);
    fireEvent.change(urlInput, { target: { value: 'https://myserver.com/hooks' } });


    // Submit form
    const dialog = screen.getByRole('dialog');
    const submitBtn = within(dialog).getByRole('button', { name: /^register endpoint$/i });
    fireEvent.click(submitBtn);


    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/webhook-configs', {
        endpointUrl: 'https://myserver.com/hooks',
      });
      expect(screen.getByText(/Save your webhook signing secret now!/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('whsec_testsecret1234567890abcdef')).toBeInTheDocument();
    });

    // Dismiss modal
    const doneBtn = screen.getByRole('button', { name: /i have saved this secret safely/i });
    fireEvent.click(doneBtn);

    expect(screen.queryByText(/Save your webhook signing secret now!/i)).not.toBeInTheDocument();
  });

  it('handles disable endpoint confirmation flow', async () => {
    const mockConfigs = [
      {
        id: 'cfg-1',
        merchantId: 'merch-123',
        endpointUrl: 'https://example.com/webhooks',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    (api.get as any).mockImplementation((url: string) => {
      if (url === '/webhook-configs') {
        return Promise.resolve({ status: 'success', data: mockConfigs });
      }
      return Promise.resolve({ status: 'success', data: [] });
    });
    (api.delete as any).mockResolvedValueOnce({
      status: 'success',
      data: { ...mockConfigs[0], status: 'DISABLED' },
    });

    render(<WebhooksPage />);

    await waitFor(() => {
      expect(screen.getByText('https://example.com/webhooks')).toBeInTheDocument();
    });

    // Click disable/trash icon
    const trashBtn = screen.getByRole('button', { name: /disable webhook endpoint/i });
    fireEvent.click(trashBtn);

    // Modal appears
    expect(screen.getByRole('heading', { name: /disable webhook endpoint/i })).toBeInTheDocument();

    // Confirm disable
    const confirmBtn = screen.getByRole('button', { name: /disable endpoint/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/webhook-configs/cfg-1');
    });
  });

  it('inspects webhook delivery detail and handles manual retry', async () => {
    const mockDeliveries = [
      {
        id: 'del-1',
        webhookEventId: 'evt-1',
        webhookConfigId: 'cfg-1',
        status: 'FAILED',
        attemptCount: 1,
        lastHttpStatus: 500,
        lastError: 'Server error 500',
        deliveredAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        webhookEvent: {
          id: 'evt-1',
          eventType: 'payment.created',
          paymentId: 'pay-uuid-456',
          payload: { order_id: 'ORD-999', amount: 50000 },
        },
      },
    ];

    (api.get as any).mockImplementation((url: string) => {
      if (url === '/webhook-deliveries') {
        return Promise.resolve({ status: 'success', data: mockDeliveries });
      }
      return Promise.resolve({ status: 'success', data: [] });
    });

    (api.post as any).mockResolvedValueOnce({
      status: 'success',
      data: {
        ...mockDeliveries[0],
        status: 'DELIVERED',
        lastHttpStatus: 200,
      },
    });

    render(<WebhooksPage />);

    await waitFor(() => {
      expect(screen.getByText('payment.created')).toBeInTheDocument();
    });

    // Click inspect
    const inspectBtn = screen.getByRole('button', { name: /inspect/i });
    fireEvent.click(inspectBtn);

    // Inspection modal appears
    expect(screen.getByRole('heading', { name: /webhook delivery inspection/i })).toBeInTheDocument();
    expect(screen.getByText(/Server error 500/i)).toBeInTheDocument();
    expect(screen.getByText(/"order_id": "ORD-999"/i)).toBeInTheDocument();

    // Trigger retry from inspection modal
    const retryBtn = screen.getByRole('button', { name: /retry delivery now/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/webhook-deliveries/del-1/retry');
      expect(screen.getByText('Delivered')).toBeInTheDocument();
      expect(screen.getByText('HTTP 200')).toBeInTheDocument();
    });
  });
});

