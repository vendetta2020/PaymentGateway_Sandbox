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
}

export type RefundStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface RefundPresentation {
  id: string;
  paymentId: string;
  amount: number;
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
  periodStart: string;
  periodEnd: string;
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
  status: ReconciliationStatus;
  totalMatched: number;
  totalDiscrepancies: number;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

export interface WebhookDeliveryPresentation {
  id: string;
  merchantId: string;
  eventType: string;
  status: 'SUCCESS' | 'FAILED';
  attemptCount: number;
  responseStatus: number | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface ApiCredentialPresentation {
  id: string;
  name: string;
  publicKey: string;
  maskedSecretKey: string;
  status: 'ACTIVE' | 'REVOKED';
  createdAt: string;
  lastUsedAt: string | null;
}
