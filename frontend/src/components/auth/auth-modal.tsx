'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, MerchantProfile } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api-client';
import { Key, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';

export function AuthModal() {
  const { isAuthenticated, isLoading, error, login } = useAuth();
  const [inputKey, setInputKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [merchants, setMerchants] = useState<MerchantProfile[]>([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>('');
  const [provisioningError, setProvisioningError] = useState<string | null>(null);

  useEffect(() => {
    // Load existing active merchants to assist testing
    async function loadMerchants() {
      try {
        const response = await api.get<{ data: MerchantProfile[] }>('/merchants?limit=10&offset=0');
        if (response?.data?.length > 0) {
          setMerchants(response.data);
          setSelectedMerchantId(response.data[0].id);
        }
      } catch {
        // Silent catch for demo selector
      }
    }
    if (!isAuthenticated) {
      loadMerchants();
    }
  }, [isAuthenticated]);

  if (isLoading || isAuthenticated) {
    return null;
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) return;
    setIsSubmitting(true);
    await login(inputKey.trim());
    setIsSubmitting(false);
  };

  const handleProvisionDevKey = async () => {
    if (!selectedMerchantId) return;
    setIsSubmitting(true);
    setProvisioningError(null);
    try {
      const response = await api.post<{
        status: string;
        data: { credentialId: string; publicKey: string; secretKey: string };
      }>(`/internal/merchants/${selectedMerchantId}/api-credentials`);

      if (response?.data?.secretKey) {
        setInputKey(response.data.secretKey);
        await login(response.data.secretKey);
      }
    } catch (err: any) {
      setProvisioningError(err?.message || 'Failed to provision dev key');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-lg border-2 border-black bg-white p-6 sm:p-8 shadow-[4px_4px_0px_#000000] rounded-sm">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="w-9 h-9 bg-black text-white flex items-center justify-center rounded-sm">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 id="auth-modal-title" className="text-lg font-bold tracking-tight text-neutral-900">
              Merchant Authentication
            </h2>
            <p className="text-xs text-neutral-500">
              Enter an active API secret key to access the gateway dashboard.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2 rounded-sm">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {provisioningError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2 rounded-sm">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <span>{provisioningError}</span>
          </div>
        )}

        <form onSubmit={handleManualSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="api-key-input"
              className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
            >
              API Secret Key (Bearer Token)
            </label>
            <Input
              id="api-key-input"
              type="password"
              isMonospace
              placeholder="sk_test_..."
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              required
              disabled={isSubmitting}
            />
            <p className="text-[11px] text-neutral-500 mt-1 font-mono">
              Format: sk_test_&lt;publicKey&gt;_&lt;secret&gt;
            </p>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full"
            isLoading={isSubmitting}
          >
            Authenticate & Access Dashboard
          </Button>
        </form>

        {merchants.length > 0 && (
          <div className="mt-6 pt-5 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                Development Quick Provision
              </span>
              <span className="text-[10px] font-mono text-neutral-400">Sandbox Helper</span>
            </div>
            <p className="text-xs text-neutral-500 mb-3">
              Select an existing merchant below to automatically provision and authenticate with a fresh test API key:
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                aria-label="Select demo merchant"
                value={selectedMerchantId}
                onChange={(e) => setSelectedMerchantId(e.target.value)}
                className="flex-1 h-9 border border-border bg-surface-subtle px-2.5 py-1 text-xs rounded-sm text-neutral-800 focus-visible:outline-2 focus-visible:outline-black"
                disabled={isSubmitting}
              >
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.businessName} ({m.id.slice(0, 8)}...)
                  </option>
                ))}
              </select>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleProvisionDevKey}
                disabled={isSubmitting}
                className="shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Provision Key</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
