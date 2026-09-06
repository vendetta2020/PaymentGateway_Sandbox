'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
import { api } from '@/lib/api-client';
import { formatDateTime } from '@/lib/formatters';
import { useAuth } from '@/lib/auth-context';
import {
  Webhook,
  Plus,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  ShieldCheck,
  Send,
  AlertCircle,
  X,
  Lock,
} from 'lucide-react';

interface WebhookConfig {
  id: string;
  merchantId: string;
  endpointUrl: string;
  status: string;
  signingSecret?: string;
  createdAt: string;
  updatedAt: string;
}

export default function WebhooksPage() {
  const { isAuthenticated } = useAuth();
  const [configs, setConfigs] = useState<WebhookConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Registration Modal State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [endpointUrl, setEndpointUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [newlyCreatedConfig, setNewlyCreatedConfig] = useState<WebhookConfig | null>(null);

  // Manual delivery trigger tool state
  const [deliveryIdToRetry, setDeliveryIdToRetry] = useState('');
  const [isRetryingDelivery, setIsRetryingDelivery] = useState(false);
  const [retryResult, setRetryResult] = useState<string | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<{ status: string; data: WebhookConfig[] }>(
        '/webhook-configs',
      );
      setConfigs(response.data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch webhook configs from gateway.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endpointUrl.trim()) return;
    setIsSubmitting(true);
    setModalError(null);

    try {
      const response = await api.post<{ status: string; data: WebhookConfig }>(
        '/webhook-configs',
        { endpointUrl: endpointUrl.trim() },
      );

      if (response?.data) {
        setNewlyCreatedConfig(response.data);
        fetchConfigs();
      }
    } catch (err: any) {
      setModalError(err?.message || 'Failed to register webhook endpoint');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to disable this webhook configuration?')) return;
    try {
      await api.delete(`/webhook-configs/${id}`);
      fetchConfigs();
    } catch (err: any) {
      alert(err?.message || 'Failed to disable webhook config');
    }
  };

  const handleManualRetry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryIdToRetry.trim()) return;
    setIsRetryingDelivery(true);
    setRetryResult(null);

    try {
      const res = await api.post<{ status: string; data: any }>(
        `/internal/webhook-deliveries/${deliveryIdToRetry.trim()}/deliver`,
      );
      setRetryResult(`Delivery attempt triggered. Current status: ${res.data?.status || 'dispatched'}`);
    } catch (err: any) {
      setRetryResult(`Retry error: ${err?.message || 'Delivery request failed'}`);
    } finally {
      setIsRetryingDelivery(false);
    }
  };

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        category="INTEGRATION"
        title="Webhooks"
        description="Asynchronous event delivery notifications, HMAC-SHA256 signing secrets, and delivery retry telemetry."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchConfigs}
              disabled={isLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setNewlyCreatedConfig(null);
                setEndpointUrl('');
                setModalError(null);
                setIsRegisterModalOpen(true);
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register Endpoint</span>
            </Button>
          </>
        }
      />

      {/* HMAC Signing Security Notice */}
      <Card variant="subtle">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-neutral-800 shrink-0 mt-0.5" />
          <div className="text-xs text-neutral-600 leading-relaxed">
            <span className="font-bold text-neutral-900">
              Deterministic Event Delivery & Signing:
            </span>{' '}
            Outbound webhooks include a timestamped `X-Signature-SHA256` HTTP header generated from your webhook signing secret.
            All delivery attempts are recorded with response latency and HTTP status telemetry.
          </div>
        </div>
      </Card>

      {/* Webhook Endpoints List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight text-neutral-900 uppercase">
          Configured Webhook Endpoints
        </h2>

        {error ? (
          <ErrorState
            title="Failed to Load Webhook Endpoints"
            message={error}
            onRetry={fetchConfigs}
          />
        ) : isLoading ? (
          <LoadingState message="Fetching registered webhook endpoints..." />
        ) : configs.length === 0 ? (
          <EmptyState
            icon={<Webhook className="w-8 h-8" />}
            title="No webhook endpoints registered"
            description="Configure an HTTP/HTTPS endpoint to start receiving real-time event notifications for payment transitions and refunds."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsRegisterModalOpen(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register First Endpoint</span>
              </Button>
            }
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Config UUID</TableHead>
                  <TableHead align="right">Created At</TableHead>
                  <TableHead align="right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell isMonospace className="font-semibold text-neutral-900 break-all">
                      {c.endpointUrl}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status === 'ACTIVE' ? 'SUCCEEDED' : 'REVOKED'} label={c.status} />
                    </TableCell>
                    <TableCell isMonospace className="text-neutral-500 text-xs">
                      {c.id.slice(0, 16)}...
                    </TableCell>
                    <TableCell align="right" isMonospace className="text-neutral-500 text-xs">
                      {formatDateTime(c.createdAt)}
                    </TableCell>
                    <TableCell align="right">
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-1.5 text-neutral-400 hover:text-red-600 rounded-sm hover:bg-neutral-100"
                        title="Delete webhook endpoint"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </div>

      {/* Manual Delivery Retry Sandbox Tool */}
      <Card variant="default">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-xs uppercase tracking-wider font-semibold text-neutral-700 flex items-center gap-2">
            <Send className="w-3.5 h-3.5" />
            <span>Simulate / Retry Webhook Delivery Record</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <p className="text-xs text-neutral-500 leading-relaxed">
            Trigger a manual redelivery attempt for an existing webhook delivery record by ID:
          </p>
          <form onSubmit={handleManualRetry} className="flex flex-col sm:flex-row gap-2 max-w-xl">
            <Input
              isMonospace
              placeholder="delivery-uuid-here..."
              value={deliveryIdToRetry}
              onChange={(e) => setDeliveryIdToRetry(e.target.value)}
              disabled={isRetryingDelivery}
              required
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              isLoading={isRetryingDelivery}
              disabled={!deliveryIdToRetry.trim()}
              className="shrink-0"
            >
              <span>Retry Delivery</span>
            </Button>
          </form>
          {retryResult && (
            <div className="p-2.5 bg-surface-subtle border border-border text-xs font-mono text-neutral-800 rounded-sm">
              {retryResult}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registration & One-Time Secret Modal */}
      {isRegisterModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-webhook-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-lg border-2 border-black bg-white p-6 shadow-[6px_6px_0px_#000000] rounded-sm">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-black text-white flex items-center justify-center rounded-sm">
                  <Webhook className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="register-webhook-title" className="text-base font-bold text-neutral-900 tracking-tight">
                    {newlyCreatedConfig ? 'Webhook Registered' : 'Register Webhook Endpoint'}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-black rounded-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-xs text-red-800 rounded-sm">
                {modalError}
              </div>
            )}

            {!newlyCreatedConfig ? (
              <form onSubmit={handleRegister} className="mt-5 space-y-4 text-xs">
                <div>
                  <label className="block font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                    Destination Endpoint URL (HTTP/HTTPS)
                  </label>
                  <Input
                    isMonospace
                    type="url"
                    placeholder="https://your-merchant-server.com/api/webhook"
                    value={endpointUrl}
                    onChange={(e) => setEndpointUrl(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                  <p className="text-[11px] text-neutral-500 mt-1 font-mono">
                    Must accept HTTP POST payloads and return 2xx status.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsRegisterModalOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSubmitting}
                  >
                    Register Endpoint
                  </Button>
                </div>
              </form>
            ) : (
              <div className="mt-5 space-y-4 text-xs">
                <div className="p-3 bg-amber-50 border border-amber-200 text-xs text-amber-900 rounded-sm leading-relaxed">
                  <strong>Save your signing secret now!</strong> This secret is required to verify the HMAC signatures of incoming event webhooks. It is shown only once.
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                    Registered Endpoint URL
                  </label>
                  <div className="p-2 bg-surface-subtle border border-border rounded-sm font-mono text-xs break-all">
                    {newlyCreatedConfig.endpointUrl}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                    Webhook Signing Secret (whsec_...)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      readOnly
                      value={newlyCreatedConfig.signingSecret || 'whsec_••••••••••••'}
                      className="w-full h-9 px-2.5 font-mono text-xs bg-neutral-100 border border-border rounded-sm font-bold select-all"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        handleCopy(newlyCreatedConfig.signingSecret || '', 'whsec')
                      }
                    >
                      {copiedKey === 'whsec' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>Copy</span>
                    </Button>
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsRegisterModalOpen(false)}
                  >
                    Done
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
