/**
 * Merchant account lifecycle status.
 *
 * - ACTIVE: Merchant is verified and active. Can participate in payments.
 * - SUSPENDED: Merchant is temporarily suspended (e.g. risk review, fraud block).
 * - INACTIVE: Merchant is registered but not active / deactivated.
 */
export enum MerchantStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  INACTIVE = 'INACTIVE',
}
