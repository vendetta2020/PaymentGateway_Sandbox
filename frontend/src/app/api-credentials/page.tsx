'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import { maskApiKey, formatDateTime } from '@/lib/formatters';
import { ApiCredentialPresentation } from '@/types/domain';
import {
  Key,
  Plus,
  ShieldCheck,
  Copy,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
  Lock,
  Terminal,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';

interface ProvisionedKeyResult {
  credentialId: string;
  publicKey: string;
  secretKey: string;
}

export default function ApiCredentialsPage() {
  const { merchant, apiKey, credentialId, refreshMerchant } = useAuth();
  const [credentials, setCredentials] = useState<ApiCredentialPresentation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Provisioning state
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [newKeyModalData, setNewKeyModalData] = useState<ProvisionedKeyResult | null>(null);
  const [isSecretRevealed, setIsSecretRevealed] = useState(false);

  // Revocation modal state
  const [credentialToRevoke, setCredentialToRevoke] = useState<ApiCredentialPresentation | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // Copy feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchCredentials = useCallback(async () => {
    if (!merchant?.id) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<{
        status: string;
        data: ApiCredentialPresentation[];
      }>('/api-credentials');

      setCredentials(response.data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load API credentials.');
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.id]);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  const handleCopy = (text: string, identifier: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(identifier);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateCredential = async () => {
    if (!merchant?.id || isProvisioning) return;
    setIsProvisioning(true);
    setProvisionError(null);

    try {
      const response = await api.post<{
        status: string;
        data: ProvisionedKeyResult;
        message: string;
      }>('/api-credentials');

      if (response?.data) {
        setNewKeyModalData(response.data);
        setIsSecretRevealed(false);
        fetchCredentials();
        refreshMerchant();
      }
    } catch (err: any) {
      setProvisionError(err?.message || 'Failed to generate new API credential.');
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleRevoke = async () => {
    if (!credentialToRevoke || isRevoking) return;
    setIsRevoking(true);
    setRevokeError(null);

    try {
      await api.delete(`/api-credentials/${credentialToRevoke.id}`);
      setCredentialToRevoke(null);
      fetchCredentials();
    } catch (err: any) {
      setRevokeError(err?.message || 'Failed to revoke API credential.');
    } finally {
      setIsRevoking(false);
    }
  };

  // Keyboard accessibility: Escape closes open modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (credentialToRevoke && !isRevoking) {
          setCredentialToRevoke(null);
        }
        if (newKeyModalData) {
          setNewKeyModalData(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [credentialToRevoke, isRevoking, newKeyModalData]);

  const activePublicKey = apiKey ? apiKey.split('_')[2] : null;

  return (
    <div className="space-y-6">
      <PageHeader
        category="SETTINGS / API & WEBHOOKS"
        title="API Credentials"
        description="Manage merchant-scoped public and secret keys for checkout, server integration, and API authorization."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCredentials}
              disabled={isLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateCredential}
              isLoading={isProvisioning}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create API key</span>
            </Button>
          </div>
        }
      />

      {/* Zero Plaintext Storage Policy Callout */}
      <Card variant="subtle">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-neutral-800 shrink-0 mt-0.5" />
          <div className="text-xs text-neutral-600 leading-relaxed">
            <span className="font-bold text-neutral-900">
              Zero Plaintext Storage Policy:
            </span>{' '}
            The gateway never stores secret keys in plaintext. Only SHA-256 cryptographic hashes are persisted in the database.
            Secret keys are presented <strong>exactly once</strong> upon creation. If lost, generate a new credential and revoke the old one.
          </div>
        </div>
      </Card>

      {provisionError && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800 rounded-sm">
          {provisionError}
        </div>
      )}

      {/* Active API Credentials Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-neutral-900 uppercase">
            Merchant Credentials
          </h2>
          <span className="text-[10px] font-mono text-neutral-400">
            HMAC-SHA256 Authenticated
          </span>
        </div>

        {error ? (
          <ErrorState
            title="Failed to Load Credentials"
            message={error}
            onRetry={fetchCredentials}
          />
        ) : isLoading ? (
          <LoadingState message="Fetching merchant API credentials..." />
        ) : credentials.length === 0 ? (
          <EmptyState
            icon={<Key className="w-8 h-8" />}
            title="No API credentials found"
            description="Generate a test credential to start making authenticated API requests and processing payments."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateCredential}
                isLoading={isProvisioning}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create First API Key</span>
              </Button>
            }
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key Identifier</TableHead>
                  <TableHead>Public Key ID</TableHead>
                  <TableHead>Secret Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead align="right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credentials.map((cred) => {
                  const isCurrentSessionKey =
                    cred.id === credentialId ||
                    (activePublicKey && cred.publicKey === activePublicKey);

                  return (
                    <TableRow key={cred.id}>
                      <TableCell className="font-medium text-neutral-900">
                        <div className="flex items-center gap-2">
                          <Key className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                          <span className="text-xs font-semibold">
                            {isCurrentSessionKey ? 'Active Session Key' : 'API Key'}
                          </span>
                          <span className="px-1.5 py-0.2 bg-neutral-100 border border-border text-neutral-600 text-[10px] font-mono rounded-sm">
                            test
                          </span>
                        </div>
                      </TableCell>

                      <TableCell isMonospace className="font-semibold text-neutral-800">
                        <div className="flex items-center gap-1.5">
                          <span>pk_test_{cred.publicKey}</span>
                          <button
                            onClick={() => handleCopy(`pk_test_${cred.publicKey}`, cred.id)}
                            title="Copy public key"
                            aria-label="Copy public key"
                            className="p-1 text-neutral-400 hover:text-black rounded-sm"
                          >
                            {copiedKey === cred.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </TableCell>

                      <TableCell isMonospace className="text-neutral-500 text-xs">
                        {isCurrentSessionKey && apiKey
                          ? maskApiKey(apiKey)
                          : 'sk_test_••••••••••••'}
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={cred.status} />
                      </TableCell>

                      <TableCell isMonospace className="text-neutral-500 text-xs">
                        {formatDateTime(cred.createdAt)}
                      </TableCell>

                      <TableCell align="right">
                        {cred.status === 'ACTIVE' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRevokeError(null);
                              setCredentialToRevoke(cred);
                            }}
                            className="text-red-700 hover:text-red-900 hover:border-red-400"
                            title="Revoke API key"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            <span>Revoke</span>
                          </Button>
                        ) : (
                          <span className="text-[11px] text-neutral-400 italic">
                            Revoked
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </div>

      {/* Developer Quickstart Curl Snippet */}
      <Card variant="default">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-neutral-700 flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              <span>Developer Quickstart Snippet</span>
            </CardTitle>
            <button
              onClick={() =>
                handleCopy(
                  `curl -X POST http://localhost:3000/api/v1/payments \\
  -H "Authorization: Bearer ${apiKey || 'sk_test_YOUR_KEY'}" \\
  -H "Idempotency-Key: ${crypto.randomUUID()}" \\
  -H "Content-Type: application/json" \\
  -d '{"orderId":"ORD-901","amount":150000,"currency":"IDR","paymentMethod":"QRIS"}'`,
                  'curlCode',
                )
              }
              className="text-xs font-semibold flex items-center gap-1 text-neutral-700 hover:text-black"
            >
              {copiedKey === 'curlCode' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy cURL</span>
                </>
              )}
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="p-4 bg-neutral-950 text-neutral-100 rounded-sm font-mono text-xs overflow-x-auto leading-relaxed border border-neutral-800">
            <span className="text-neutral-500"># Create an idempotent payment via gateway API:</span>
            <br />
            <span className="text-neutral-300">curl -X POST</span> http://localhost:3000/api/v1/payments \<br />
            &nbsp;&nbsp;<span className="text-neutral-400">-H</span> &quot;Authorization: Bearer {apiKey ? maskApiKey(apiKey) : 'sk_test_YOUR_KEY'}&quot; \<br />
            &nbsp;&nbsp;<span className="text-neutral-400">-H</span> &quot;Idempotency-Key: 7b6e82...&quot; \<br />
            &nbsp;&nbsp;<span className="text-neutral-400">-H</span> &quot;Content-Type: application/json&quot; \<br />
            &nbsp;&nbsp;<span className="text-neutral-400">-d</span> &apos;&#123;&quot;orderId&quot;: &quot;ORD-2026-90412&quot;, &quot;amount&quot;: 150000, &quot;currency&quot;: &quot;IDR&quot;, &quot;paymentMethod&quot;: &quot;QRIS&quot;&#125;&apos;
          </div>
        </CardContent>
      </Card>

      {/* ONE-TIME SECRET KEY DISPLAY MODAL */}
      {newKeyModalData && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-key-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-lg border-2 border-black bg-white p-6 shadow-[6px_6px_0px_#000000] rounded-sm">
            <div className="flex items-center gap-3 pb-4 border-b border-border">
              <div className="w-8 h-8 bg-black text-white flex items-center justify-center rounded-sm">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 id="new-key-title" className="text-base font-bold text-neutral-900 tracking-tight">
                  New API Key Generated
                </h3>
                <p className="text-xs text-neutral-500">
                  Store this secret key safely. It will not be shown again.
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 text-xs text-amber-900 rounded-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>One-Time Secret Visibility:</strong> For security reasons, this secret key is never stored in plaintext by the payment gateway and cannot be recovered if lost.
              </div>
            </div>

            <div className="mt-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                  Public Key ID
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    readOnly
                    value={`pk_test_${newKeyModalData.publicKey}`}
                    className="w-full h-8 px-2.5 font-mono text-xs bg-surface-subtle border border-border rounded-sm select-all"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(`pk_test_${newKeyModalData.publicKey}`, 'newPub')}
                  >
                    {copiedKey === 'newPub' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold uppercase tracking-wider text-neutral-700">
                    Secret API Key
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsSecretRevealed(!isSecretRevealed)}
                    className="text-[11px] text-neutral-600 flex items-center gap-1 hover:text-black font-medium"
                  >
                    {isSecretRevealed ? (
                      <>
                        <EyeOff className="w-3 h-3" />
                        <span>Mask Secret</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" />
                        <span>Reveal Secret</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    readOnly
                    type={isSecretRevealed ? 'text' : 'password'}
                    value={newKeyModalData.secretKey}
                    className="w-full h-9 px-2.5 font-mono text-xs bg-neutral-100 border border-border rounded-sm font-semibold select-all"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleCopy(newKeyModalData.secretKey, 'newSec')}
                  >
                    {copiedKey === 'newSec' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>Copy</span>
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setNewKeyModalData(null)}
              >
                I have saved this key safely
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* REVOCATION CONFIRMATION MODAL */}
      {credentialToRevoke && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-md border-2 border-black bg-white p-6 shadow-[6px_6px_0px_#000000] rounded-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-red-600 text-white flex items-center justify-center rounded-sm">
                  <Trash2 className="w-4 h-4" />
                </div>
                <h3 id="revoke-modal-title" className="text-base font-bold text-neutral-900">
                  Revoke API Credential
                </h3>
              </div>
              <button
                onClick={() => !isRevoking && setCredentialToRevoke(null)}
                className="p-1 text-neutral-400 hover:text-black rounded-sm"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {revokeError && (
              <div className="mt-3 p-2.5 bg-red-50 border border-red-200 text-xs text-red-800 rounded-sm">
                {revokeError}
              </div>
            )}

            <div className="mt-4 space-y-3 text-xs text-neutral-600">
              <p>
                Are you sure you want to revoke key{' '}
                <strong className="font-mono text-neutral-900">
                  pk_test_{credentialToRevoke.publicKey}
                </strong>
                ?
              </p>

              {(credentialToRevoke.id === credentialId ||
                (activePublicKey && credentialToRevoke.publicKey === activePublicKey)) && (
                <div className="p-2.5 bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Warning: Active Session Key.</strong> You are currently authenticated with this key. Revoking it will invalidate your active session.
                  </div>
                </div>
              )}

              <p className="text-[11px] text-neutral-500">
                This action is permanent and immediate. Any client SDKs, server cron jobs, or integrations currently utilizing this key will immediately receive <code>401 Unauthorized</code> errors.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-border flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCredentialToRevoke(null)}
                disabled={isRevoking}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleRevoke}
                isLoading={isRevoking}
                className="bg-red-600 hover:bg-red-700 text-white border-red-700"
              >
                Confirm Revocation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
