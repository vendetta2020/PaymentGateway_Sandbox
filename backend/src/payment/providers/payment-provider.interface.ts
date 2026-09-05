import { Payment } from '../entities/payment.entity';

export interface ProviderResult {
  status: 'SUCCESS' | 'FAILED';
  reference?: string;
}

export interface PaymentProvider {
  process(payment: Payment): Promise<ProviderResult>;
  refund(refund: any, payment: Payment): Promise<ProviderResult>;
}
