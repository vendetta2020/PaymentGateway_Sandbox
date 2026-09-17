/**
 * Domain presentation models representing backend entities.
 *
 * All financial amounts are integer units from the backend.
 * The frontend does NOT calculate or alter these authoritative values.
 */

export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'EXPIRED';

export type PaymentMethodType =
  | 'QRIS'
  | 'VIRTUAL_ACCOUNT'
  | 'EWALLET'
  | 'CARD';

export interface PaymentPresentation {
  id: string;
  merchantId: string;
  orderId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethodType;
  providerReference: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  totalRefunded?: number;
  refundableAmount?: number;
}

export type RefundStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface RefundPresentation {
  id: string;
  paymentId: string;
  amount: number;
  currency?: string;
  reason: string;
  status: RefundStatus;
  providerReference: string | null;
  createdAt: string;
}

export type SettlementStatus = 'PENDING' | 'PROCESSING' | 'SETTLED' | 'FAILED';

export interface SettlementPresentation {
  id: string;
  merchantId: string;
  status: SettlementStatus;
  grossAmount: number;
  refundAmount: number;
  netAmount: number;
  currency: string;
  settlementReference: string;
  periodStart: string;
  periodEnd: string;
  settledAt?: string;
  createdAt: string;
}

export type ReconciliationStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type DiscrepancyType =
  | 'MATCHED'
  | 'MISSING_IN_PROVIDER'
  | 'MISSING_IN_INTERNAL'
  | 'AMOUNT_MISMATCH'
  | 'CURRENCY_MISMATCH'
  | 'STATUS_MISMATCH'
  | 'DUPLICATE_PROVIDER_REFERENCE';

export interface ReconciliationRunPresentation {
  id: string;
  merchantId: string;
  status: ReconciliationStatus;
  periodStart: string;
  periodEnd: string;
  totalInternalAmount: number;
  totalProviderAmount: number;
  matchedCount: number;
  discrepancyCount: number;
  createdAt: string;
  completedAt?: string;
}

export interface ReconciliationResultPresentation {
  id: string;
  reconciliationRunId: string;
  providerReference: string | null;
  paymentId: string | null;
  discrepancyType: DiscrepancyType;
  internalAmount: number | null;
  providerAmount: number | null;
  internalCurrency: string | null;
  providerCurrency: string | null;
  internalStatus: string | null;
  providerStatus: string | null;
  details: string | null;
  createdAt: string;
}

export type WebhookConfigStatus = 'ACTIVE' | 'DISABLED';

export interface WebhookConfigPresentation {
  id: string;
  merchantId: string;
  endpointUrl: string;
  status: WebhookConfigStatus;
  signingSecret?: string;
  createdAt: string;
  updatedAt: string;
}

export type WebhookDeliveryStatus =
  | 'PENDING'
  | 'DELIVERING'
  | 'DELIVERED'
  | 'FAILED'
  | 'EXHAUSTED';

export interface WebhookDeliveryPresentation {
  id: string;
  webhookEventId: string;
  webhookConfigId: string;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  lastHttpStatus: number | null;
  lastError: string | null;
  deliveredAt: string | null;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  createdAt: string;
  updatedAt: string;
  webhookEvent?: {
    id: string;
    merchantId: string;
    paymentId: string;
    eventType: string;
    eventKey: string;
    payload: Record<string, any>;
    createdAt: string;
  };
  webhookConfig?: {
    id: string;
    merchantId: string;
    endpointUrl: string;
    status: WebhookConfigStatus;
  };
}

export interface ApiCredentialPresentation {
  id: string;
  merchantId?: string;
  publicKey: string;
  status: 'ACTIVE' | 'REVOKED';
  createdAt: string;
  updatedAt: string;
}

