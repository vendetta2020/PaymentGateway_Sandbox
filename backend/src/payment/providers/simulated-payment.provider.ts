import { Injectable } from '@nestjs/common';
import { PaymentProvider, ProviderResult } from './payment-provider.interface';
import { Payment } from '../entities/payment.entity';
import * as crypto from 'crypto';

@Injectable()
export class SimulatedPaymentProvider implements PaymentProvider {
  async process(payment: Payment): Promise<ProviderResult> {
    // Deterministic simulation based on payment description or orderId
    const triggerString = `${payment.orderId} ${payment.description || ''}`.toUpperCase();

    // Simulate system error (Unexpected provider exception)
    if (triggerString.includes('SIMULATE_SYSTEM_ERROR')) {
      throw new Error('Simulated external provider connection timeout or internal error');
    }

    // Simulate business logic failure
    if (triggerString.includes('SIMULATE_FAILURE')) {
      return {
        status: 'FAILED',
        reference: `sim_fail_${crypto.randomUUID()}`,
      };
    }

    // Simulate success
    return {
      status: 'SUCCESS',
      reference: `sim_succ_${crypto.randomUUID()}`,
    };
  }
}
