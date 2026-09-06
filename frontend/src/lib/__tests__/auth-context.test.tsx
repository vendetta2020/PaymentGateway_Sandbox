import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../auth-context';
import { api } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  api: {
    get: vi.fn(),
  },
}));

function TestConsumer() {
  const { isAuthenticated, merchant, error, login } = useAuth();
  return (
    <div>
      <div data-testid="auth-status">
        {isAuthenticated ? 'AUTHENTICATED' : 'ANONYMOUS'}
      </div>
      {merchant && <div data-testid="merchant-name">{merchant.businessName}</div>}
      {error && <div data-testid="auth-error">{error}</div>}
      <button onClick={() => login('sk_test_valid_key')}>Trigger Login</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('starts in anonymous state if no session stored', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('auth-status')).toHaveTextContent('ANONYMOUS');
  });

  it('authenticates successfully when login is called with valid key', async () => {
    (api.get as any)
      .mockResolvedValueOnce({
        status: 'success',
        data: { merchantId: 'm_123', credentialId: 'c_456' },
      })
      .mockResolvedValueOnce({
        id: 'm_123',
        name: 'Toko Elektronik',
        businessName: 'PT Toko Elektronik',
        email: 'dev@tokoelektronik.id',
        status: 'ACTIVE',
      });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await act(async () => {
      screen.getByRole('button').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('AUTHENTICATED');
      expect(screen.getByTestId('merchant-name')).toHaveTextContent('PT Toko Elektronik');
    });
  });

  it('handles invalid API key with descriptive error', async () => {
    (api.get as any).mockRejectedValueOnce(new Error('Invalid API key format'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await act(async () => {
      screen.getByRole('button').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('ANONYMOUS');
      expect(screen.getByTestId('auth-error')).toHaveTextContent('Invalid API key format');
    });
  });
});
