import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ApiCredentialsPage from '../page';
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

describe('ApiCredentialsPage', () => {
  const mockMerchant = {
    id: 'merchant-uuid-1',
    name: 'Test Merchant',
    businessName: 'Test Business',
    email: 'merchant@example.com',
    status: 'ACTIVE',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
      merchant: mockMerchant,
      apiKey: 'sk_test_mockpublickey123_mocksecret456',
      credentialId: 'cred-1',
      refreshMerchant: vi.fn(),
    });
  });

  it('renders loading state initially', () => {
    (api.get as any).mockReturnValue(new Promise(() => {})); // Never resolves
    render(<ApiCredentialsPage />);

    expect(screen.getByText(/Fetching merchant API credentials.../i)).toBeInTheDocument();
  });

  it('renders credentials table with active and revoked keys', async () => {
    const mockCredentials = [
      {
        id: 'cred-1',
        publicKey: 'mockpublickey123',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'cred-2',
        publicKey: 'otherpubkey789',
        status: 'REVOKED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    (api.get as any).mockResolvedValueOnce({
      status: 'success',
      data: mockCredentials,
    });

    render(<ApiCredentialsPage />);

    await waitFor(() => {
      expect(screen.getByText('pk_test_mockpublickey123')).toBeInTheDocument();
      expect(screen.getByText('pk_test_otherpubkey789')).toBeInTheDocument();
    });

    // Check session indicator
    expect(screen.getByText('Active Session Key')).toBeInTheDocument();

    // Check status badges
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getAllByText('Revoked').length).toBeGreaterThanOrEqual(1);


    // Check actions: Active has Revoke button, Revoked has Revoked label
    expect(screen.getByRole('button', { name: /revoke/i })).toBeInTheDocument();
  });

  it('renders empty state if no credentials are returned', async () => {
    (api.get as any).mockResolvedValueOnce({
      status: 'success',
      data: [],
    });

    render(<ApiCredentialsPage />);

    await waitFor(() => {
      expect(screen.getByText(/No API credentials found/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create first api key/i })).toBeInTheDocument();
    });
  });

  it('renders error state on API failure', async () => {
    (api.get as any).mockRejectedValueOnce(new Error('Network failure'));

    render(<ApiCredentialsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to Load Credentials/i)).toBeInTheDocument();
      expect(screen.getByText(/Network failure/i)).toBeInTheDocument();
    });
  });

  it('provisions new API credential and presents one-time secret modal', async () => {
    (api.get as any).mockResolvedValue({
      status: 'success',
      data: [],
    });

    const newKeyData = {
      credentialId: 'new-cred-uuid',
      publicKey: 'newpub123',
      secretKey: 'sk_test_newpub123_randomsecret999',
    };

    (api.post as any).mockResolvedValueOnce({
      status: 'success',
      data: newKeyData,
      message: 'Store this secret key safely.',
    });

    render(<ApiCredentialsPage />);

    await waitFor(() => {
      expect(screen.getByText(/No API credentials found/i)).toBeInTheDocument();
    });

    // Click "Create API key"
    const createBtn = screen.getByRole('button', { name: /create first api key/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api-credentials');
      expect(screen.getByText(/New API Key Generated/i)).toBeInTheDocument();
      expect(screen.getByText(/One-Time Secret Visibility/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('pk_test_newpub123')).toBeInTheDocument();
    });

    // Verify secret mask/reveal toggle
    const toggleBtn = screen.getByRole('button', { name: /reveal secret/i });
    fireEvent.click(toggleBtn);
    expect(screen.getByRole('button', { name: /mask secret/i })).toBeInTheDocument();

    // Dismiss modal
    const dismissBtn = screen.getByRole('button', { name: /i have saved this key safely/i });
    fireEvent.click(dismissBtn);

    expect(screen.queryByText(/New API Key Generated/i)).not.toBeInTheDocument();
  });

  it('executes revocation flow with confirmation modal', async () => {
    const mockCredentials = [
      {
        id: 'cred-1',
        publicKey: 'mockpublickey123',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    (api.get as any).mockResolvedValue({
      status: 'success',
      data: mockCredentials,
    });
    (api.delete as any).mockResolvedValueOnce({
      status: 'success',
      message: 'API credential successfully revoked',
    });

    render(<ApiCredentialsPage />);

    await waitFor(() => {
      expect(screen.getByText('pk_test_mockpublickey123')).toBeInTheDocument();
    });

    // Click revoke button
    const revokeBtn = screen.getByRole('button', { name: /revoke/i });
    fireEvent.click(revokeBtn);

    // Modal appears
    expect(screen.getByText(/Revoke API Credential/i)).toBeInTheDocument();
    expect(screen.getByText(/Warning: Active Session Key/i)).toBeInTheDocument();

    // Confirm revocation
    const confirmBtn = screen.getByRole('button', { name: /confirm revocation/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/api-credentials/cred-1');
    });
  });
});
