import { Payment } from '../entities/payment.entity';

export interface ProviderResult {
  status: 'SUCCESS' | 'FAILED';
  reference?: string;
}

export interface ProviderTransactionRecord {
  providerReference: string;
  amount: number;
  currency: string;
  providerStatus: 'SUCCESS' | 'FAILED';
  transactionTime: Date;
}

export interface PaymentProvider {
  process(payment: Payment): Promise<ProviderResult>;
  refund(refund: any, payment: Payment): Promise<ProviderResult>;
  getTransactions(
    merchantId: string,
    periodStart: Date,
    periodEnd: Date,
    scenario?: string,
  ): Promise<ProviderTransactionRecord[]>;
}
