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
  WebhookConfigPresentation,
  WebhookDeliveryPresentation,
} from '@/types/domain';
import {
  Webhook,
  Plus,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  ShieldCheck,
  X,
  Lock,
  Code,
  AlertTriangle,
  FileJson,
  ExternalLink,
} from 'lucide-react';

export default function WebhooksPage() {
  const { isAuthenticated } = useAuth();

  // Configs state
  const [configs, setConfigs] = useState<WebhookConfigPresentation[]>([]);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(true);
  const [configsError, setConfigsError] = useState<string | null>(null);

  // Deliveries state
  const [deliveries, setDeliveries] = useState<WebhookDeliveryPresentation[]>([]);
  const [isLoadingDeliveries, setIsLoadingDeliveries] = useState(true);
  const [deliveriesError, setDeliveriesError] = useState<string | null>(null);

  // Registration Modal State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [endpointUrl, setEndpointUrl] = useState('');
  const [isSubmittingConfig, setIsSubmittingConfig] = useState(false);
  const [modalConfigError, setModalConfigError] = useState<string | null>(null);
  const [newlyCreatedConfig, setNewlyCreatedConfig] = useState<WebhookConfigPresentation | null>(null);

  // Endpoint Delete/Disable Confirmation Modal
  const [configToDelete, setConfigToDelete] = useState<WebhookConfigPresentation | null>(null);
  const [isDeletingConfig, setIsDeletingConfig] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Delivery Detail Modal State
  const [selectedDelivery, setSelectedDelivery] = useState<WebhookDeliveryPresentation | null>(null);

  // Retry state
  const [retryingDeliveryId, setRetryingDeliveryId] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<{ id: string; text: string; isError: boolean } | null>(null);

  // Copy feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingConfigs(true);
    setConfigsError(null);
    try {
      const response = await api.get<{ status: string; data: WebhookConfigPresentation[] }>(
        '/webhook-configs',
      );
      setConfigs(response.data || []);
    } catch (err: any) {
      setConfigsError(err?.message || 'Failed to fetch webhook configs from gateway.');
    } finally {
      setIsLoadingConfigs(false);
    }
  }, [isAuthenticated]);

  const fetchDeliveries = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingDeliveries(true);
    setDeliveriesError(null);
    try {
      const response = await api.get<{ status: string; data: WebhookDeliveryPresentation[] }>(
        '/webhook-deliveries',
      );
      setDeliveries(response.data || []);
    } catch (err: any) {
      setDeliveriesError(err?.message || 'Failed to fetch webhook delivery records.');
    } finally {
      setIsLoadingDeliveries(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchConfigs();
    fetchDeliveries();
  }, [fetchConfigs, fetchDeliveries]);

  const handleRefreshAll = () => {
    fetchConfigs();
    fetchDeliveries();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endpointUrl.trim() || isSubmittingConfig) return;
    setIsSubmittingConfig(true);
    setModalConfigError(null);

    try {
      const response = await api.post<{ status: string; data: WebhookConfigPresentation }>(
        '/webhook-configs',
        { endpointUrl: endpointUrl.trim() },
      );

      if (response?.data) {
        setNewlyCreatedConfig(response.data);
        fetchConfigs();
      }
    } catch (err: any) {
      setModalConfigError(err?.message || 'Failed to register webhook endpoint');
    } finally {
      setIsSubmittingConfig(false);
    }
  };

  const handleDeleteConfig = async () => {
    if (!configToDelete || isDeletingConfig) return;
    setIsDeletingConfig(true);
    setDeleteError(null);

    try {
      await api.delete(`/webhook-configs/${configToDelete.id}`);
      setConfigToDelete(null);
      fetchConfigs();
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to disable webhook config');
    } finally {
      setIsDeletingConfig(false);
    }
  };

  const handleRetryDelivery = async (deliveryId: string) => {
    if (retryingDeliveryId) return;
    setRetryingDeliveryId(deliveryId);
    setRetryMessage(null);

    try {
      const res = await api.post<{ status: string; data: WebhookDeliveryPresentation }>(
        `/webhook-deliveries/${deliveryId}/retry`,
      );
      setRetryMessage({
        id: deliveryId,
        text: `Retry dispatched: Status is now ${res.data?.status || 'dispatched'}`,
        isError: false,
      });
      fetchDeliveries();
      if (selectedDelivery && selectedDelivery.id === deliveryId && res.data) {
        setSelectedDelivery(res.data);
      }
    } catch (err: any) {
      setRetryMessage({
        id: deliveryId,
        text: `Retry failed: ${err?.message || 'Delivery request failed'}`,
        isError: true,
      });
    } finally {
      setRetryingDeliveryId(null);
    }
  };

  const handleCopy = (text: string, identifier: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(identifier);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Keyboard accessibility: Escape closes open dialogs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isRegisterModalOpen && !isSubmittingConfig) setIsRegisterModalOpen(false);
        if (configToDelete && !isDeletingConfig) setConfigToDelete(null);
        if (selectedDelivery) setSelectedDelivery(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRegisterModalOpen, isSubmittingConfig, configToDelete, isDeletingConfig, selectedDelivery]);

  return (
    <div className="space-y-8">
      <PageHeader
        category="INTEGRATION"
        title="Webhooks & Events"
        description="Configure HTTP notification destinations, inspect real-time delivery telemetry, and verify HMAC-SHA256 signatures."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              disabled={isLoadingConfigs || isLoadingDeliveries}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isLoadingConfigs || isLoadingDeliveries ? 'animate-spin' : ''
                }`}
              />
              <span>Refresh</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setNewlyCreatedConfig(null);
                setEndpointUrl('');
                setModalConfigError(null);
                setIsRegisterModalOpen(true);
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register Endpoint</span>
            </Button>
          </div>
        }
      />

      {/* HMAC Signing Security Notice */}
      <Card variant="subtle">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-neutral-800 shrink-0 mt-0.5" />
          <div className="text-xs text-neutral-600 leading-relaxed">
            <span className="font-bold text-neutral-900">
              Deterministic HMAC-SHA256 Event Delivery:
            </span>{' '}
            Every outbound webhook payload contains a cryptographic signature in the <code>X-Webhook-Signature</code> header generated using your secret. Delivery attempts are recorded with HTTP response codes, latency, and exponential backoff retry schedules.
          </div>
        </div>
      </Card>

      {/* SECTION 1: CONFIGURED WEBHOOK ENDPOINTS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-neutral-900 uppercase">
            Configured Webhook Endpoints
          </h2>
          <span className="text-[10px] font-mono text-neutral-400">
            {configs.length} {configs.length === 1 ? 'Destination' : 'Destinations'} Registered
          </span>
        </div>

        {configsError ? (
          <ErrorState
            title="Failed to Load Webhook Endpoints"
            message={configsError}
            onRetry={fetchConfigs}
          />
        ) : isLoadingConfigs ? (
          <LoadingState message="Fetching registered webhook endpoints..." />
        ) : configs.length === 0 ? (
          <EmptyState
            icon={<Webhook className="w-8 h-8" />}
            title="No webhook endpoints registered"
            description="Register an HTTPS/HTTP endpoint to start receiving real-time event notifications for payment transitions and refunds."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setNewlyCreatedConfig(null);
                  setEndpointUrl('');
                  setModalConfigError(null);
                  setIsRegisterModalOpen(true);
                }}
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
                  <TableHead>Destination URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Endpoint UUID</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead align="right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell isMonospace className="font-semibold text-neutral-900 break-all">
                      <div className="flex items-center gap-2">
                        <span>{c.endpointUrl}</span>
                        <button
                          onClick={() => handleCopy(c.endpointUrl, `url-${c.id}`)}
                          title="Copy endpoint URL"
                          className="text-neutral-400 hover:text-black shrink-0"
                        >
                          {copiedKey === `url-${c.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell isMonospace className="text-neutral-400 text-xs">
                      {c.id.slice(0, 16)}...
                    </TableCell>
                    <TableCell isMonospace className="text-neutral-500 text-xs">
                      {formatDateTime(c.createdAt)}
                    </TableCell>
                    <TableCell align="right">
                      {c.status === 'ACTIVE' ? (
                        <button
                          onClick={() => {
                            setDeleteError(null);
                            setConfigToDelete(c);
                          }}
                          className="p-1.5 text-neutral-400 hover:text-red-600 rounded-sm hover:bg-neutral-100"
                          title="Disable webhook endpoint"
                          aria-label="Disable webhook endpoint"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-[11px] text-neutral-400 italic">Disabled</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </div>

      {/* SECTION 2: WEBHOOK EVENT & DELIVERY TELEMETRY LOG */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-neutral-900 uppercase">
            Delivery History & Event Log
          </h2>
          <span className="text-[10px] font-mono text-neutral-400">
            Real Backend Telemetry ({deliveries.length} Records)
          </span>
        </div>

        {retryMessage && (
          <div
            className={`p-3 text-xs rounded-sm border ${
              retryMessage.isError
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {retryMessage.text}
          </div>
        )}

        {deliveriesError ? (
          <ErrorState
            title="Failed to Load Webhook Deliveries"
            message={deliveriesError}
            onRetry={fetchDeliveries}
          />
        ) : isLoadingDeliveries ? (
          <LoadingState message="Fetching delivery telemetry from gateway..." />
        ) : deliveries.length === 0 ? (
          <EmptyState
            icon={<FileJson className="w-8 h-8" />}
            title="No webhook events recorded yet"
            description="When payment state transitions or refund operations occur, outbound webhook attempts and delivery results will appear here automatically."
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>HTTP Code</TableHead>
                  <TableHead>Related Payment</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead align="right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((del) => {
                  const event = del.webhookEvent;
                  const isRetrying = retryingDeliveryId === del.id;
                  const isFailedOrExhausted =
                    del.status === 'FAILED' || del.status === 'EXHAUSTED';

                  return (
                    <TableRow key={del.id}>
                      <TableCell className="font-medium text-neutral-900">
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <Code className="w-3 h-3 text-neutral-400 shrink-0" />
                          <span className="font-semibold text-neutral-800">
                            {event?.eventType || 'payment.event'}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={del.status} />
                      </TableCell>

                      <TableCell isMonospace className="text-neutral-700 text-xs font-semibold">
                        {del.attemptCount} / 5
                      </TableCell>

                      <TableCell isMonospace className="text-xs">
                        {del.lastHttpStatus ? (
                          <span
                            className={
                              del.lastHttpStatus >= 200 && del.lastHttpStatus < 300
                                ? 'text-emerald-700 font-bold'
                                : 'text-red-700 font-bold'
                            }
                          >
                            HTTP {del.lastHttpStatus}
                          </span>
                        ) : (
                          <span className="text-neutral-400">None</span>
                        )}
                      </TableCell>

                      <TableCell isMonospace className="text-neutral-500 text-xs">
                        {event?.paymentId ? (
                          <span>pay_{event.paymentId.slice(0, 8)}...</span>
                        ) : (
                          'N/A'
                        )}
                      </TableCell>

                      <TableCell isMonospace className="text-neutral-500 text-xs">
                        {formatDateTime(del.createdAt)}
                      </TableCell>

                      <TableCell align="right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedDelivery(del)}
                            title="Inspect webhook payload & telemetry"
                          >
                            <span>Inspect</span>
                          </Button>

                          {isFailedOrExhausted && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetryDelivery(del.id)}
                              isLoading={isRetrying}
                              disabled={isRetrying}
                              className="text-neutral-700 hover:text-black"
                              title="Trigger immediate redelivery attempt"
                            >
                              <span>Retry</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </div>

      {/* SECTION 3: DEVELOPER HMAC-SHA256 SIGNATURE VERIFICATION GUIDE */}
      <Card variant="default">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-neutral-700 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <span>Webhook Signature Verification Standard</span>
            </CardTitle>
            <span className="text-[10px] font-mono bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-sm border border-border">
              HMAC-SHA256
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <p className="text-xs text-neutral-600 leading-relaxed">
            To prevent spoofing and replay attacks, verify each incoming webhook request on your backend using your endpoint&apos;s signing secret (<code>whsec_...</code>).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-3 text-xs">
            <div className="p-3 bg-surface-subtle border border-border rounded-sm">
              <span className="font-mono font-bold text-neutral-900 block mb-1">
                X-Webhook-Signature
              </span>
              <p className="text-neutral-500 text-[11px]">
                Hex-encoded HMAC-SHA256 hash of <code>{'{timestamp}.{rawPayload}'}</code>.
              </p>
            </div>
            <div className="p-3 bg-surface-subtle border border-border rounded-sm">
              <span className="font-mono font-bold text-neutral-900 block mb-1">
                X-Webhook-Timestamp
              </span>
              <p className="text-neutral-500 text-[11px]">
                Unix epoch timestamp in seconds. Replays older than 300s should be rejected.
              </p>
            </div>
            <div className="p-3 bg-surface-subtle border border-border rounded-sm">
              <span className="font-mono font-bold text-neutral-900 block mb-1">
                X-Webhook-Id
              </span>
              <p className="text-neutral-500 text-[11px]">
                Unique UUID of the event record for idempotent deduplication.
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="p-4 bg-neutral-950 text-neutral-100 rounded-sm font-mono text-xs overflow-x-auto leading-relaxed border border-neutral-800">
              <span className="text-neutral-500">{'// Example Node.js Verification:'}</span>

              <br />
              <span className="text-purple-400">const</span> crypto = require(
              <span className="text-emerald-400">&apos;crypto&apos;</span>);
              <br />
              <br />
              <span className="text-blue-400">function</span>{' '}
              <span className="text-yellow-300">verifySignature</span>(rawBody, signature, timestamp, secret) &#123;
              <br />
              &nbsp;&nbsp;<span className="text-purple-400">const</span> expected = crypto
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;.createHmac(<span className="text-emerald-400">&apos;sha256&apos;</span>, secret)
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;.update(<span className="text-emerald-400">&apos;`&#36;&#123;timestamp&#125;.&#36;&#123;rawBody&#125;`&apos;</span>)

              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;.digest(<span className="text-emerald-400">&apos;hex&apos;</span>);
              <br />
              &nbsp;&nbsp;<span className="text-purple-400">return</span> crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
              <br />
              &#125;
            </div>
            <button
              onClick={() =>
                handleCopy(
                  "const crypto = require('crypto');\\n\\nfunction verifySignature(rawBody, signature, timestamp, secret) {\\n  const expected = crypto\\n    .createHmac('sha256', secret)\\n    .update(`${timestamp}.${rawBody}`)\\n    .digest('hex');\\n  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));\\n}",
                  'verifySnippet',
                )
              }
              className="absolute top-2.5 right-2.5 px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded-sm flex items-center gap-1 font-sans font-medium"
            >

              {copiedKey === 'verifySnippet' ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* REGISTRATION & ONE-TIME SECRET MODAL */}
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
                onClick={() => !isSubmittingConfig && setIsRegisterModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-black rounded-sm"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalConfigError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-xs text-red-800 rounded-sm">
                {modalConfigError}
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
                    disabled={isSubmittingConfig}
                  />
                  <p className="text-[11px] text-neutral-500 mt-1 font-mono">
                    Must be reachable via HTTP POST and return 2xx status.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsRegisterModalOpen(false)}
                    disabled={isSubmittingConfig}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSubmittingConfig}
                  >
                    Register Endpoint
                  </Button>
                </div>
              </form>
            ) : (
              <div className="mt-5 space-y-4 text-xs">
                <div className="p-3 bg-amber-50 border border-amber-200 text-xs text-amber-900 rounded-sm leading-relaxed flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>One-Time Secret Visibility:</strong> Save your webhook signing secret now! It will never be displayed again by the gateway.
                  </div>
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                    Registered Endpoint URL
                  </label>
                  <div className="p-2.5 bg-surface-subtle border border-border rounded-sm font-mono text-xs break-all text-neutral-900">
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
                    I have saved this secret safely
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ENDPOINT DISABLE CONFIRMATION MODAL */}
      {configToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="disable-config-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-md border-2 border-black bg-white p-6 shadow-[6px_6px_0px_#000000] rounded-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-red-600 text-white flex items-center justify-center rounded-sm">
                  <Trash2 className="w-4 h-4" />
                </div>
                <h3 id="disable-config-title" className="text-base font-bold text-neutral-900">
                  Disable Webhook Endpoint
                </h3>
              </div>
              <button
                onClick={() => !isDeletingConfig && setConfigToDelete(null)}
                className="p-1 text-neutral-400 hover:text-black rounded-sm"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {deleteError && (
              <div className="mt-3 p-2.5 bg-red-50 border border-red-200 text-xs text-red-800 rounded-sm">
                {deleteError}
              </div>
            )}

            <div className="mt-4 space-y-3 text-xs text-neutral-600">
              <p>
                Are you sure you want to disable destination URL:
              </p>
              <div className="p-2 bg-surface-subtle border border-border rounded-sm font-mono text-xs break-all text-neutral-900">
                {configToDelete.endpointUrl}
              </div>
              <p className="text-[11px] text-neutral-500">
                Future webhook event dispatches will not be delivered to this URL once disabled.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-border flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfigToDelete(null)}
                disabled={isDeletingConfig}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleDeleteConfig}
                isLoading={isDeletingConfig}
                className="bg-red-600 hover:bg-red-700 text-white border-red-700"
              >
                Disable Endpoint
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* WEBHOOK DELIVERY INSPECTION MODAL */}
      {selectedDelivery && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delivery-detail-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col border-2 border-black bg-white shadow-[6px_6px_0px_#000000] rounded-sm">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-black text-white flex items-center justify-center rounded-sm">
                  <FileJson className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="delivery-detail-title" className="text-base font-bold text-neutral-900">
                    Webhook Delivery Inspection
                  </h3>
                  <p className="text-xs font-mono text-neutral-500">
                    ID: {selectedDelivery.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDelivery(null)}
                className="p-1 text-neutral-400 hover:text-black rounded-sm"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs">
              {/* Telemetry Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-surface-subtle border border-border rounded-sm">
                  <span className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">
                    Status
                  </span>
                  <StatusBadge status={selectedDelivery.status} />
                </div>
                <div className="p-3 bg-surface-subtle border border-border rounded-sm">
                  <span className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">
                    Attempts
                  </span>
                  <span className="font-mono font-bold text-neutral-900 text-sm">
                    {selectedDelivery.attemptCount} / 5
                  </span>
                </div>
                <div className="p-3 bg-surface-subtle border border-border rounded-sm">
                  <span className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">
                    Last HTTP Code
                  </span>
                  <span
                    className={`font-mono font-bold text-sm ${
                      selectedDelivery.lastHttpStatus &&
                      selectedDelivery.lastHttpStatus >= 200 &&
                      selectedDelivery.lastHttpStatus < 300
                        ? 'text-emerald-700'
                        : 'text-red-700'
                    }`}
                  >
                    {selectedDelivery.lastHttpStatus
                      ? `HTTP ${selectedDelivery.lastHttpStatus}`
                      : 'None'}
                  </span>
                </div>
                <div className="p-3 bg-surface-subtle border border-border rounded-sm">
                  <span className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">
                    Created
                  </span>
                  <span className="font-mono text-[11px] text-neutral-700 block">
                    {formatDateTime(selectedDelivery.createdAt)}
                  </span>
                </div>
              </div>

              {/* Destination & Event details */}
              <div className="space-y-2 border border-border p-3 rounded-sm bg-neutral-50">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500 font-semibold uppercase tracking-wider text-[10px]">
                    Event Type:
                  </span>
                  <span className="font-mono font-bold text-neutral-900">
                    {selectedDelivery.webhookEvent?.eventType || 'payment.event'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500 font-semibold uppercase tracking-wider text-[10px]">
                    Payment UUID:
                  </span>
                  <span className="font-mono text-neutral-700">
                    {selectedDelivery.webhookEvent?.paymentId || 'N/A'}
                  </span>
                </div>
                {selectedDelivery.lastError && (
                  <div className="pt-2 border-t border-border text-xs">
                    <span className="text-red-700 font-semibold block mb-0.5">
                      Last Delivery Error:
                    </span>
                    <p className="font-mono text-[11px] text-red-900 bg-red-50 p-2 rounded-sm border border-red-200 break-all">
                      {selectedDelivery.lastError}
                    </p>
                  </div>
                )}
              </div>

              {/* JSON Payload representation */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-700">
                    Signed Webhook Payload (JSON)
                  </span>
                  <button
                    onClick={() =>
                      handleCopy(
                        JSON.stringify(
                          selectedDelivery.webhookEvent?.payload || {},
                          null,
                          2,
                        ),
                        'modalPayload',
                      )
                    }
                    className="text-[11px] font-semibold flex items-center gap-1 text-neutral-700 hover:text-black"
                  >
                    {copiedKey === 'modalPayload' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied Payload</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 bg-neutral-950 text-neutral-100 rounded-sm font-mono text-xs overflow-x-auto max-h-56 leading-relaxed border border-neutral-800 select-all">
                  {JSON.stringify(
                    selectedDelivery.webhookEvent?.payload || {
                      message: 'No payload data available',
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border flex items-center justify-between bg-surface-subtle">
              <div>
                {(selectedDelivery.status === 'FAILED' ||
                  selectedDelivery.status === 'EXHAUSTED') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRetryDelivery(selectedDelivery.id)}
                    isLoading={retryingDeliveryId === selectedDelivery.id}
                    className="text-neutral-900 hover:text-black"
                  >
                    <span>Retry Delivery Now</span>
                  </Button>
                )}
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setSelectedDelivery(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
